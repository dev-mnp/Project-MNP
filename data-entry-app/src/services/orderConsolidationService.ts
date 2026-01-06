import { supabase } from '../lib/supabase';
import { fetchDistrictBeneficiaryEntriesGrouped } from './districtBeneficiaryService';
import { fetchInstitutionBeneficiaryEntriesGrouped } from './institutionBeneficiaryService';
import { fetchAllArticles } from './articlesService';
import type { MasterEntryRecord, ArticleSelection } from '../data/mockData';
import { getOrderSummaryByArticle } from './orderService';
import type { ArticleOrderSummary } from './orderService';

export interface ConsolidatedArticle {
  articleId: string;
  articleName: string;
  totalQuantity: number;
  breakdown: {
    district: number;
    public: number;
    institutions: number;
  };
  totalValue: number;
  // Add order tracking fields
  quantityOrdered?: number;
  quantityReceived?: number;
  quantityPending?: number;
  orderSummary?: ArticleOrderSummary;
}

export interface OrderConsolidation {
  articles: ConsolidatedArticle[];
  totalArticles: number;
  totalValue: number;
}

/**
 * Fetch all entries from all beneficiary types and consolidate articles
 */
export const getConsolidatedOrders = async (): Promise<OrderConsolidation> => {
  try {
    // Fetch all articles to get article names
    const allArticles = await fetchAllArticles(true);
    const articleMapById = new Map(allArticles.map(a => [a.id, a]));
    
    // Helper to get article name
    const getArticleName = (articleId: string): string => {
      const article = articleMapById.get(articleId);
      return article?.article_name || articleId;
    };
    
    // Fetch district entries from database
    const districtRecords = await fetchDistrictBeneficiaryEntriesGrouped();
    
    // Fetch public entries from database
    const { data: publicData, error: publicError } = await supabase
      .from('public_beneficiary_entries')
      .select(`
        id,
        application_number,
        name,
        aadhar_number,
        is_handicapped,
        address,
        mobile,
        article_id,
        quantity,
        total_amount,
        notes,
        status,
        created_at
      `);

    if (publicError) {
      console.error('Failed to fetch public entries:', publicError);
    }

    // Transform public entries to MasterEntryRecord format
    const publicRecords: MasterEntryRecord[] = (publicData || []).map((entry: any) => ({
      id: entry.id,
      applicationNumber: entry.application_number || '',
      beneficiaryType: 'public' as const,
      createdAt: entry.created_at,
      aadharNumber: entry.aadhar_number,
      name: entry.name,
      handicapped: entry.is_handicapped,
      address: entry.address,
      mobile: entry.mobile,
      articleId: entry.article_id,
      quantity: entry.quantity,
      costPerUnit: entry.quantity > 0 ? (entry.total_amount / entry.quantity) : 0,
      totalValue: entry.total_amount,
      comments: entry.notes || '',
    }));
    
    // Fetch institutions entries from database
    const institutionsRecords = await fetchInstitutionBeneficiaryEntriesGrouped();
    
    // Consolidate articles by article ID
    const consolidatedMap = new Map<string, ConsolidatedArticle>();
    
    // Process district entries
    districtRecords.forEach((record) => {
      if (record.selectedArticles) {
        record.selectedArticles.forEach((article: ArticleSelection) => {
          const key = article.articleId;
          if (!consolidatedMap.has(key)) {
            consolidatedMap.set(key, {
              articleId: article.articleId,
              articleName: article.articleName || getArticleName(article.articleId),
              totalQuantity: 0,
              breakdown: {
                district: 0,
                public: 0,
                institutions: 0,
              },
              totalValue: 0,
            });
          }
          const consolidated = consolidatedMap.get(key)!;
          consolidated.totalQuantity += article.quantity;
          consolidated.breakdown.district += article.quantity;
          consolidated.totalValue += article.totalValue;
        });
      }
    });
    
    // Process public entries
    publicRecords.forEach((record) => {
      if (record.articleId && record.quantity) {
        const key = record.articleId;
        if (!consolidatedMap.has(key)) {
          consolidatedMap.set(key, {
            articleId: record.articleId,
            articleName: getArticleName(record.articleId),
            totalQuantity: 0,
            breakdown: {
              district: 0,
              public: 0,
              institutions: 0,
            },
            totalValue: 0,
          });
        }
        const consolidated = consolidatedMap.get(key)!;
        consolidated.totalQuantity += record.quantity || 0;
        consolidated.breakdown.public += record.quantity || 0;
        consolidated.totalValue += record.totalValue || 0;
      }
    });
    
    // Process institutions entries
    institutionsRecords.forEach((record) => {
      if (record.selectedArticles) {
        record.selectedArticles.forEach((article: ArticleSelection) => {
          const key = article.articleId;
          if (!consolidatedMap.has(key)) {
            consolidatedMap.set(key, {
              articleId: article.articleId,
              articleName: article.articleName || getArticleName(article.articleId),
              totalQuantity: 0,
              breakdown: {
                district: 0,
                public: 0,
                institutions: 0,
              },
              totalValue: 0,
            });
          }
          const consolidated = consolidatedMap.get(key)!;
          consolidated.totalQuantity += article.quantity;
          consolidated.breakdown.institutions += article.quantity;
          consolidated.totalValue += article.totalValue;
        });
      }
    });
    
    // Convert map to array and sort by article name
    const articles = Array.from(consolidatedMap.values()).sort((a, b) =>
      a.articleName.localeCompare(b.articleName)
    );
    
    // Calculate totals
    const totalArticles = articles.length;
    const totalValue = articles.reduce((sum, article) => sum + article.totalValue, 0);
    
    return {
      articles,
      totalArticles,
      totalValue,
    };
  } catch (error) {
    console.error('Failed to consolidate orders:', error);
    throw error;
  }
};

// Update the function to include order data
export const getConsolidatedOrdersWithTracking = async (): Promise<OrderConsolidation> => {
  try {
    // First get the consolidated orders
    const consolidation = await getConsolidatedOrders();
    
    // Get order summaries for all articles
    const articleIds = consolidation.articles.map(a => a.articleId);
    const orderSummaries = await getOrderSummaryByArticle(articleIds);
    
    // Merge order data with consolidated articles
    const articlesWithOrders = consolidation.articles.map(article => {
      const orderSummary = orderSummaries.get(article.articleId);
      return {
        ...article,
        quantityOrdered: orderSummary?.totalQuantityOrdered || 0,
        quantityReceived: orderSummary?.totalQuantityReceived || 0,
        quantityPending: Math.max(0, article.totalQuantity - (orderSummary?.totalQuantityOrdered || 0)),
        orderSummary,
      };
    });
    
    return {
      articles: articlesWithOrders,
      totalArticles: consolidation.totalArticles,
      totalValue: consolidation.totalValue,
    };
  } catch (error) {
    console.error('Failed to consolidate orders with tracking:', error);
    throw error;
  }
};
