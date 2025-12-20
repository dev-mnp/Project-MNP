import { supabase } from '../lib/supabase';

export interface OrderEntry {
  id?: string;
  article_id: string;
  quantity_ordered: number;
  order_date: string; // Date in YYYY-MM-DD format
  status: 'pending' | 'ordered' | 'received' | 'cancelled';
  supplier_name?: string | null;
  supplier_contact?: string | null;
  unit_price?: number | null;
  total_amount: number;
  expected_delivery_date?: string | null; // Date in YYYY-MM-DD format
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
}

export interface OrderEntryWithArticle extends OrderEntry {
  articles?: {
    article_name: string;
    cost_per_unit: number;
  };
}

export interface ArticleOrderSummary {
  articleId: string;
  articleName: string;
  totalQuantityNeeded: number;
  totalQuantityOrdered: number;
  totalQuantityReceived: number;
  totalQuantityPending: number;
  totalValueNeeded: number;
  totalValueOrdered: number;
  orders: OrderEntryWithArticle[];
}

/**
 * Create a new order entry
 */
export const createOrderEntry = async (
  order: Omit<OrderEntry, 'id' | 'created_at' | 'updated_at'>
): Promise<OrderEntry> => {
  try {
    const { data, error } = await supabase
      .from('order_entries')
      .insert(order)
      .select()
      .single();

    if (error) {
      console.error('Error creating order entry:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to create order entry:', error);
    throw error;
  }
};

/**
 * Update an existing order entry
 */
export const updateOrderEntry = async (
  id: string,
  updates: Partial<OrderEntry>
): Promise<OrderEntry> => {
  try {
    const { data, error } = await supabase
      .from('order_entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating order entry:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to update order entry:', error);
    throw error;
  }
};

/**
 * Delete an order entry
 */
export const deleteOrderEntry = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('order_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting order entry:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete order entry:', error);
    throw error;
  }
};

/**
 * Fetch all order entries for a specific article
 */
export const fetchOrderEntriesByArticle = async (
  articleId: string
): Promise<OrderEntryWithArticle[]> => {
  try {
    const { data, error } = await supabase
      .from('order_entries')
      .select(`
        *,
        articles:article_id (
          article_name,
          cost_per_unit
        )
      `)
      .eq('article_id', articleId)
      .order('order_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching order entries:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch order entries:', error);
    throw error;
  }
};

/**
 * Check if a string is a valid UUID format
 */
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Get order summary for all articles
 * This aggregates order entries by article and calculates totals
 */
export const getOrderSummaryByArticle = async (
  articleIds: string[]
): Promise<Map<string, ArticleOrderSummary>> => {
  try {
    if (articleIds.length === 0) {
      return new Map();
    }

    // Filter to only valid UUIDs for database query (mock data may have non-UUID IDs)
    const validUUIDs = articleIds.filter(id => isValidUUID(id));
    
    // Initialize summary for all articles (including non-UUIDs from mock data)
    const summaryMap = new Map<string, ArticleOrderSummary>();
    articleIds.forEach((articleId) => {
      summaryMap.set(articleId, {
        articleId,
        articleName: '',
        totalQuantityNeeded: 0,
        totalQuantityOrdered: 0,
        totalQuantityReceived: 0,
        totalQuantityPending: 0,
        totalValueNeeded: 0,
        totalValueOrdered: 0,
        orders: [],
      });
    });

    // Only query database if we have valid UUIDs
    if (validUUIDs.length === 0) {
      return summaryMap;
    }

    const { data, error } = await supabase
      .from('order_entries')
      .select(`
        *,
        articles:article_id (
          article_name,
          cost_per_unit
        )
      `)
      .in('article_id', validUUIDs)
      .order('order_date', { ascending: false });

    if (error) {
      console.error('Error fetching order summary:', error);
      throw error;
    }

    const entries = (data || []) as OrderEntryWithArticle[];

    // Aggregate order entries by article
    entries.forEach((entry) => {
      const summary = summaryMap.get(entry.article_id);
      if (!summary) return;

      if (!summary.articleName && entry.articles?.article_name) {
        summary.articleName = entry.articles.article_name;
      }

      summary.orders.push(entry);

      // Calculate totals based on status (exclude cancelled orders)
      if (entry.status === 'cancelled') {
        // Skip cancelled orders in totals
      } else if (entry.status === 'received') {
        summary.totalQuantityReceived += entry.quantity_ordered;
        summary.totalQuantityOrdered += entry.quantity_ordered;
      } else if (entry.status === 'ordered' || entry.status === 'pending') {
        summary.totalQuantityOrdered += entry.quantity_ordered;
      }

      // Only count value for non-cancelled orders
      if (entry.status !== 'cancelled') {
        const amount = typeof entry.total_amount === 'string'
          ? parseFloat(entry.total_amount)
          : (entry.total_amount || 0);
        summary.totalValueOrdered += amount;
      }
    });

    return summaryMap;
  } catch (error) {
    console.error('Failed to get order summary:', error);
    throw error;
  }
};