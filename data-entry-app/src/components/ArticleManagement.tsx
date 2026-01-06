import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Trash2, Search, Filter, X, Save, Download } from 'lucide-react';
import {
  fetchAllArticles,
  createArticle,
  updateArticle,
  toggleArticleStatus,
  ArticleRecord,
} from '../services/articlesService';
import { exportToCSV } from '../utils/csvExport';
import { logAction } from '../services/auditLogService';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { CURRENCY_SYMBOL } from '../constants/currency';

const ArticleManagement: React.FC = () => {
  const { user } = useAuth();
  const { showError, showSuccess, showWarning } = useNotifications();
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<ArticleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormMode, setIsFormMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // all, active, inactive

  // Form state
  const [formData, setFormData] = useState({
    article_name: '',
    cost_per_unit: 0,
    item_type: 'Article',
    category: '',
  });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load articles on component mount
  useEffect(() => {
    loadArticles();
  }, []);

  // Apply filters when articles or filters change
  useEffect(() => {
    applyFilters();
  }, [articles, searchQuery, itemTypeFilter, categoryFilter, statusFilter]);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const data = await fetchAllArticles(true);
      setArticles(data);
    } catch (error) {
      console.error('Failed to load articles:', error);
      showError('Failed to load articles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...articles];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (article) =>
          article.article_name.toLowerCase().includes(query) ||
          (article.category && article.category.toLowerCase().includes(query))
      );
    }

    // Item type filter
    if (itemTypeFilter !== 'all') {
      filtered = filtered.filter((article) => article.item_type === itemTypeFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((article) => article.category === categoryFilter);
    }

    // Status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter((article) => article.is_active);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter((article) => !article.is_active);
    }

    setFilteredArticles(filtered);
  };

  // Get unique item types
  const getItemTypes = (): string[] => {
    const types = new Set(articles.map((a) => a.item_type).filter(Boolean));
    return Array.from(types).sort();
  };

  // Get unique categories
  const getCategories = (): string[] => {
    const categories = new Set(
      articles.map((a) => a.category).filter((c): c is string => Boolean(c))
    );
    return Array.from(categories).sort();
  };

  const resetForm = () => {
    setFormData({
      article_name: '',
      cost_per_unit: 0,
      item_type: 'Article',
      category: '',
    });
    setErrors({});
    setEditingId(null);
  };

  const handleAdd = () => {
    resetForm();
    setIsFormMode(true);
  };

  const handleEdit = (article: ArticleRecord) => {
    setFormData({
      article_name: article.article_name,
      cost_per_unit: article.cost_per_unit,
      item_type: article.item_type,
      category: article.category || '',
    });
    setEditingId(article.id);
    setIsFormMode(true);
  };

  const handleCancel = () => {
    resetForm();
    setIsFormMode(false);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.article_name.trim()) {
      newErrors.article_name = 'Article name is required';
    }

    if (formData.cost_per_unit < 0) {
      newErrors.cost_per_unit = 'Cost per unit cannot be negative';
    }

    if (!formData.item_type) {
      newErrors.item_type = 'Item type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      if (editingId) {
        await updateArticle(editingId, formData);
      } else {
        await createArticle(formData);
      }
      await loadArticles();
      resetForm();
      setIsFormMode(false);
      showSuccess(editingId ? 'Article updated successfully' : 'Article created successfully');
    } catch (error: any) {
      console.error('Failed to save article:', error);
      showError(error.message || 'Failed to save article. Please try again.');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const action = currentStatus ? 'inactivate' : 'reactivate';
    setConfirmDialog({
      isOpen: true,
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Article`,
      message: `Are you sure you want to ${action} this article?`,
      type: 'warning',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
    try {
      await toggleArticleStatus(id, !currentStatus);
      await loadArticles();
          showSuccess(`Article ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error: any) {
      console.error('Failed to toggle article status:', error);
          showError(error.message || 'Failed to update article status. Please try again.');
    }
      },
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setItemTypeFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    itemTypeFilter !== 'all' ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all';

  const handleExport = async () => {
    try {
      const exportData = filteredArticles.map((article) => ({
        article_name: article.article_name,
        cost_per_unit: article.cost_per_unit,
        item_type: article.item_type,
        category: article.category || '',
        is_active: article.is_active ? 'Active' : 'Inactive',
        created_at: article.created_at ? new Date(article.created_at).toLocaleDateString() : '',
      }));

      exportToCSV(exportData, 'articles', [
        'article_name',
        'cost_per_unit',
        'item_type',
        'category',
        'is_active',
        'created_at',
      ], showWarning);

      // Log export action
      if (user) {
        await logAction(user.id, 'EXPORT', 'article', null, {
          exported_count: exportData.length,
          filters_applied: hasActiveFilters,
        });
      }
      showSuccess(`Exported ${exportData.length} articles successfully`);
    } catch (error) {
      console.error('Error exporting articles:', error);
      showError('Failed to export articles. Please try again.');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
        <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Article Management
        </h1>
        </div>
        {!isFormMode && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Article
          </button>
          </div>
        )}
      </div>

      {isFormMode ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            {editingId ? 'Edit Article' : 'Add New Article'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Article Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.article_name}
                onChange={(e) =>
                  setFormData({ ...formData, article_name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter article name"
              />
              {errors.article_name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.article_name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cost Per Unit <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cost_per_unit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cost_per_unit: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {errors.cost_per_unit && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.cost_per_unit}
                  </p>
                )}
      </div>
      
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Item Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.item_type}
                  onChange={(e) =>
                    setFormData({ ...formData, item_type: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="Article">Article</option>
                  <option value="Aid">Aid</option>
                </select>
                {errors.item_type && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.item_type}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter category (optional)"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-auto text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or category..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Item Type
                </label>
                <select
                  value={itemTypeFilter}
                  onChange={(e) => setItemTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="all">All Types</option>
                  {getItemTypes().map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="all">All Categories</option>
                  {getCategories().map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
      </div>
          </div>

          {/* Articles Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            {loading ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                Loading articles...
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                {hasActiveFilters
                  ? 'No articles found matching the filters'
                  : 'No articles found. Add your first article to get started.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                        Article Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                        Cost Per Unit
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                        Item Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredArticles.map((article) => (
                      <tr
                        key={article.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                          !article.is_active ? 'opacity-60' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                          {article.article_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {CURRENCY_SYMBOL}{article.cost_per_unit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {article.item_type}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {article.category || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              article.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}
                          >
                            {article.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(article)}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                              aria-label="Edit"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(article.id, article.is_active)}
                              className={`p-1.5 rounded transition-colors ${
                                article.is_active
                                  ? 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                                  : 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                              }`}
                              aria-label={article.is_active ? 'Inactivate' : 'Reactivate'}
                              title={article.is_active ? 'Inactivate' : 'Reactivate'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!loading && filteredArticles.length > 0 && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredArticles.length} of {articles.length} article(s)
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ArticleManagement;
