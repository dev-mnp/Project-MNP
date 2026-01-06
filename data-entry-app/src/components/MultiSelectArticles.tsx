import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { Article, ArticleSelection } from '../data/mockData';
import ArticleRow from './ArticleRow';
import { getCustomCostsForDistrict } from '../services/districtBeneficiaryService';
import { useNotifications } from '../contexts/NotificationContext';
import { CURRENCY_SYMBOL } from '../constants/currency';

interface MultiSelectArticlesProps {
  articles: Article[];
  selectedArticles: ArticleSelection[];
  onArticlesChange: (articles: ArticleSelection[]) => void;
  label?: string;
  required?: boolean;
  districtId?: string;
}

const MultiSelectArticles: React.FC<MultiSelectArticlesProps> = ({
  articles,
  selectedArticles,
  onArticlesChange,
  label = 'Select Articles',
  required = false,
  districtId,
}) => {
  const { showWarning } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customCosts, setCustomCosts] = useState<Map<string, number>>(new Map());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load custom costs when district changes
  useEffect(() => {
    const loadCustomCosts = async () => {
      if (!districtId) {
        setCustomCosts(new Map());
        return;
      }

      try {
        const costs = await getCustomCostsForDistrict(districtId);
        setCustomCosts(costs);

        // Update selected articles with custom costs if available
        // Only update articles that have original cost = 0 and custom cost exists
        const updatedArticles = selectedArticles.map(article => {
          const customCost = costs.get(article.articleId);
          if (customCost !== undefined) {
            // Only update if the article's original cost was 0 (editable)
            const originalArticle = articles.find(a => a.id === article.articleId);
            if (originalArticle && originalArticle.costPerUnit === 0 && article.costPerUnit === 0) {
              return {
                ...article,
                costPerUnit: customCost,
                totalValue: customCost * article.quantity,
              };
            }
          }
          return article;
        });

        // Check if any article was updated
        const hasChanges = updatedArticles.some((article, index) => 
          article.costPerUnit !== selectedArticles[index]?.costPerUnit
        );

        if (hasChanges) {
          onArticlesChange(updatedArticles);
        }
      } catch (error) {
        console.error('Failed to load custom costs:', error);
      }
    };

    loadCustomCosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districtId]); // Only reload when district changes

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter articles based on search query
  const filteredArticles = articles.filter(article =>
    article.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Allow selecting same article multiple times (especially for zero cost items)
  // So we don't filter out already selected articles
  const availableArticles = filteredArticles;

  const handleArticleSelect = async (article: Article) => {
    // Check if article already exists in selected articles
    const existingArticle = selectedArticles.find(
      a => a.articleId === article.id
    );
    
    // If article exists and has cost > 0, prevent duplicate
    if (existingArticle && article.costPerUnit > 0) {
      showWarning(`${article.name} is already selected. Articles with cost cannot be added multiple times.`);
      return; // Prevent adding duplicate
    }
    
    let costPerUnit = article.costPerUnit;
    
    // If district is selected and article has original cost = 0, check for custom cost
    if (districtId && article.costPerUnit === 0) {
      const customCost = customCosts.get(article.id);
      if (customCost !== undefined) {
        costPerUnit = customCost;
      }
    }
    
    const newArticle: ArticleSelection = {
      articleId: article.id,
      articleName: article.name,
      quantity: 1,
      costPerUnit: costPerUnit,
      totalValue: costPerUnit,
      comments: '',
    };
    onArticlesChange([...selectedArticles, newArticle]);
    setSearchQuery('');
  };

  const handleArticleUpdate = (index: number, updatedArticle: ArticleSelection) => {
    const updated = [...selectedArticles];
    updated[index] = updatedArticle;
    onArticlesChange(updated);
  };

  const handleArticleRemove = (index: number) => {
    const updated = selectedArticles.filter((_, i) => i !== index);
    onArticlesChange(updated);
  };

  return (
    <div className="w-full" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Selected Articles Chips */}
      {selectedArticles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedArticles.map((article, index) => (
            <div
              key={`${article.articleId}-${index}`}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-lg text-sm"
            >
              <span>{article.articleName}</span>
              <button
                type="button"
                onClick={() => handleArticleRemove(index)}
                className="hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded p-0.5 transition-colors"
                aria-label={`Remove ${article.articleName}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:border-blue-500 dark:hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          <span className="text-sm">
            {selectedArticles.length > 0
              ? `${selectedArticles.length} article(s) selected`
              : 'Search and select articles...'}
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-hidden">
            {/* Search Input */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  autoFocus
                />
              </div>
            </div>

            {/* Article List */}
            <div className="max-h-48 overflow-y-auto">
              {availableArticles.length > 0 ? (
                <ul className="py-1">
                  {availableArticles.map((article) => (
                    <li key={article.id}>
                      <button
                        type="button"
                        onClick={() => handleArticleSelect(article)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-900 dark:text-white">
                            {article.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {CURRENCY_SYMBOL}{article.costPerUnit.toLocaleString('en-IN')}
                          </span>
                        </div>
                        {article.category && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {article.category}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery
                    ? 'No articles found matching your search'
                    : 'No articles available'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Article Rows */}
      {selectedArticles.length > 0 && (
        <div className="mt-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Selected Articles Details
          </h4>
          {selectedArticles.map((article, index) => {
            // Find the original article to get original cost
            const originalArticle = articles.find(a => a.id === article.articleId);
            return (
              <ArticleRow
                key={`${article.articleId}-${index}`}
                article={article}
                onUpdate={(updated) => handleArticleUpdate(index, updated)}
                onRemove={() => handleArticleRemove(index)}
                originalCostPerUnit={originalArticle?.costPerUnit}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MultiSelectArticles;
