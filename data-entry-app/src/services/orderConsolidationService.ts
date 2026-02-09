import { supabase, withTimeoutAndRetry } from '../lib/supabase';
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
  const startTime = Date.now();
  console.debug('getConsolidatedOrders: Starting consolidation');
  
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
    const publicStartTime = Date.now();
    console.debug('getConsolidatedOrders: Fetching public entries');
    let publicData = null;
    let publicError = null;
    
    try {
      const result = await withTimeoutAndRetry(async () => {
        const { data, error } = await supabase
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
        
        if (error) {
          throw error;
        }
        return data;
      }, 1, 15000); // 1 retry, 15 second timeout
      
      publicData = result;
      const duration = Date.now() - publicStartTime;
      console.debug(`getConsolidatedOrders: Public entries fetched in ${duration}ms, count: ${publicData?.length || 0}`);
    } catch (error: any) {
      publicError = error;
      const duration = Date.now() - publicStartTime;
      console.error(`getConsolidatedOrders: Failed to fetch public entries after ${duration}ms:`, publicError);
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
    
    const duration = Date.now() - startTime;
    const result = {
      articles,
      totalArticles,
      totalValue,
    };
    console.debug(`getConsolidatedOrders: Consolidation completed in ${duration}ms, articles: ${result.articles.length}, totalValue: ${totalValue}`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`getConsolidatedOrders: Failed after ${duration}ms:`, error);
    throw error;
  }
};

// Update the function to include order data
export const getConsolidatedOrdersWithTracking = async (): Promise<OrderConsolidation> => {
  const startTime = Date.now();
  console.debug('getConsolidatedOrdersWithTracking: Starting fetch with tracking');
  
  try {
    // First get the consolidated orders
    const consolidation = await getConsolidatedOrders();
    
    // Get order summaries for all articles
    const articleIds = consolidation.articles.map(a => a.articleId);
    console.debug(`getConsolidatedOrdersWithTracking: Fetching order summaries for ${articleIds.length} articles`);
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
    
    const duration = Date.now() - startTime;
    console.debug(`getConsolidatedOrdersWithTracking: Completed in ${duration}ms, articles: ${articlesWithOrders.length}`);
    
    return {
      articles: articlesWithOrders,
      totalArticles: consolidation.totalArticles,
      totalValue: consolidation.totalValue,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`getConsolidatedOrdersWithTracking: Failed after ${duration}ms:`, error);
    throw error;
  }
};
