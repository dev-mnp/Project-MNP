import { supabase } from '../lib/supabase';
import { logAction } from './auditLogService';
import { createOrderEntry, type OrderEntry } from './orderService';

export interface FundRequest {
  id?: string;
  fund_request_type: 'Aid' | 'Article';
  fund_request_number: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'completed';
  total_amount: number;
  aid_type?: string; // Type of aid (e.g., 'Medical Aid', 'Education Aid', 'Accident Aid', etc.)
  gst_number?: string; // GST number for Article type fund requests (applies to all articles)
  supplier_name?: string; // Supplier name for Article type fund requests
  supplier_address?: string; // Supplier address for Article type fund requests
  supplier_city?: string; // Supplier city for Article type fund requests
  supplier_state?: string; // Supplier state for Article type fund requests
  supplier_pincode?: string; // Supplier pincode for Article type fund requests
  notes?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface FundRequestRecipient {
  id?: string;
  fund_request_id: string;
  beneficiary_type?: 'District' | 'Public' | 'Institutions' | 'Others';
  recipient_name: string;
  beneficiary?: string;
  name_of_beneficiary?: string;
  name_of_institution?: string;
  details?: string;
  fund_requested?: number;
  aadhar_number?: string;
  address?: string;
  cheque_in_favour?: string;
  cheque_sl_no?: string;
  notes?: string;
  created_at?: string;
}

export interface FundRequestArticle {
  id?: string;
  fund_request_id: string;
  article_id: string;
  sl_no?: number;
  beneficiary?: string;
  article_name: string;
  gst_no?: string;
  quantity: number;
  unit_price: number;
  price_including_gst: number;
  value: number;
  cumulative: number;
  cheque_in_favour?: string;
  cheque_sl_no?: string;
  supplier_article_name?: string;
  created_at?: string;
}

export interface FundRequestWithDetails extends FundRequest {
  recipients?: FundRequestRecipient[];
  articles?: FundRequestArticle[];
}

/**
 * Get current user ID from session
 */
const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch {
    return null;
  }
};

/**
 * Generate fund request number
 * Format: FR-001, FR-002, etc.
 */
export const generateFundRequestNumber = async (): Promise<string> => {
  try {
    // Get all fund requests to find the highest sequence number
    const { data, error } = await supabase
      .from('fund_request')
      .select('fund_request_number')
      .order('created_at', { ascending: false });

    if (error) throw error;

    let maxSequence = 0;

    if (data && data.length > 0) {
      // Extract sequence numbers from all fund request numbers
      // Handle both old format (FR-2026-0001) and new format (FR-001)
      data.forEach((item) => {
        const number = item.fund_request_number;
        
        // Try new format first: FR-001, FR-002, etc.
        const newFormatMatch = number.match(/^FR-(\d+)$/);
        if (newFormatMatch) {
          const seq = parseInt(newFormatMatch[1], 10);
          if (seq > maxSequence) {
            maxSequence = seq;
          }
        } else {
          // Try old format: FR-2026-0001, etc.
          const oldFormatMatch = number.match(/^FR-\d{4}-(\d+)$/);
          if (oldFormatMatch) {
            const seq = parseInt(oldFormatMatch[1], 10);
            if (seq > maxSequence) {
              maxSequence = seq;
            }
          }
        }
      });
    }

    // Generate next sequence number
    const nextSequence = maxSequence + 1;
    return `FR-${nextSequence.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating fund request number:', error);
    // Fallback: use timestamp-based number
    const timestamp = Date.now().toString().slice(-6);
    return `FR-${timestamp}`;
  }
};

/**
 * Fetch total amount of all previous fund requests (before the given fund request)
 */
export const fetchPreviousFundRequestTotal = async (currentFundRequestId: string, currentCreatedAt: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('fund_request')
      .select('total_amount')
      .lt('created_at', currentCreatedAt)
      .neq('id', currentFundRequestId);

    if (error) {
      console.error('Error fetching previous fund request totals:', error);
      throw error;
    }

    const total = (data || []).reduce((sum, fr) => sum + (parseFloat(fr.total_amount) || 0), 0);
    return total;
  } catch (error) {
    console.error('Failed to fetch previous fund request totals:', error);
    throw error;
  }
};

/**
 * Fetch all unique aid types from existing fund requests
 */
export const fetchExistingAidTypes = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('fund_request')
      .select('aid_type')
      .eq('fund_request_type', 'Aid')
      .not('aid_type', 'is', null);

    if (error) {
      console.error('Error fetching aid types:', error);
      throw error;
    }

    // Extract unique aid types and sort them
    const uniqueAidTypes = Array.from(
      new Set(
        (data || [])
          .map(item => item.aid_type)
          .filter((type): type is string => !!type)
      )
    ).sort();

    return uniqueAidTypes;
  } catch (error) {
    console.error('Failed to fetch aid types:', error);
    throw error;
  }
};

/**
 * Fetch all fund requests with optional filters
 */
export const fetchFundRequests = async (filters?: {
  fund_request_type?: 'Aid' | 'Article';
  status?: string;
  start_date?: string;
  end_date?: string;
}): Promise<FundRequest[]> => {
  try {
    let query = supabase
      .from('fund_request')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.fund_request_type) {
      query = query.eq('fund_request_type', filters.fund_request_type);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.start_date) {
      query = query.gte('created_at', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('created_at', filters.end_date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching fund requests:', error);
      throw error;
    }

    return (data || []).map(item => ({
      ...item,
      total_amount: parseFloat(item.total_amount) || 0,
    }));
  } catch (error) {
    console.error('Failed to fetch fund requests:', error);
    throw error;
  }
};

/**
 * Fetch single fund request with recipients/articles
 */
export const fetchFundRequestById = async (id: string): Promise<FundRequestWithDetails | null> => {
  try {
    const { data: fundRequest, error: fundRequestError } = await supabase
      .from('fund_request')
      .select('*')
      .eq('id', id)
      .single();

    if (fundRequestError) {
      console.error('Error fetching fund request:', fundRequestError);
      throw fundRequestError;
    }

    if (!fundRequest) return null;

    const result: FundRequestWithDetails = {
      ...fundRequest,
      total_amount: parseFloat(fundRequest.total_amount) || 0,
    };

    // Fetch recipients if Aid type
    if (fundRequest.fund_request_type === 'Aid') {
      const { data: recipients, error: recipientsError } = await supabase
        .from('fund_request_recipients')
        .select('*')
        .eq('fund_request_id', id)
        .order('created_at', { ascending: true });

      if (!recipientsError && recipients) {
        result.recipients = recipients.map(r => ({
          ...r,
          fund_requested: parseFloat(r.fund_requested) || 0,
        }));
      }
    }

    // Fetch articles if Article type
    if (fundRequest.fund_request_type === 'Article') {
      const { data: articles, error: articlesError } = await supabase
        .from('fund_request_articles')
        .select('*')
        .eq('fund_request_id', id)
        .order('sl_no', { ascending: true })
        .order('created_at', { ascending: true });

      if (!articlesError && articles) {
        result.articles = articles.map(item => ({
          ...item,
          quantity: parseInt(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          price_including_gst: parseFloat(item.price_including_gst) || 0,
          value: parseFloat(item.value) || 0,
          cumulative: parseFloat(item.cumulative) || 0,
        }));
      }
    }

    return result;
  } catch (error) {
    console.error('Failed to fetch fund request:', error);
    throw error;
  }
};

/**
 * Create fund request with recipients/articles
 */
export const createFundRequest = async (data: {
  fundRequest: Omit<FundRequest, 'id' | 'created_at' | 'updated_at'>;
  recipients?: Omit<FundRequestRecipient, 'id' | 'fund_request_id' | 'created_at'>[];
  articles?: Omit<FundRequestArticle, 'id' | 'fund_request_id' | 'created_at'>[];
}): Promise<FundRequestWithDetails> => {
  try {
    const userId = await getCurrentUserId();
    
    // Generate fund request number if not provided
    if (!data.fundRequest.fund_request_number) {
      data.fundRequest.fund_request_number = await generateFundRequestNumber();
    }

    // Insert fund request
    const { data: fundRequest, error: fundRequestError } = await supabase
      .from('fund_request')
      .insert([{
        ...data.fundRequest,
        created_by: userId,
      }])
      .select()
      .single();

    if (fundRequestError) {
      console.error('Error creating fund request:', fundRequestError);
      throw fundRequestError;
    }

    const result: FundRequestWithDetails = {
      ...fundRequest,
      total_amount: parseFloat(fundRequest.total_amount) || 0,
    };

    // Insert recipients if Aid type
    if (data.fundRequest.fund_request_type === 'Aid' && data.recipients && data.recipients.length > 0) {
      const { data: recipients, error: recipientsError } = await supabase
        .from('fund_request_recipients')
        .insert(
          data.recipients.map(recipient => ({
            ...recipient,
            fund_request_id: fundRequest.id,
          }))
        )
        .select();

      if (recipientsError) {
        console.error('Error creating recipients:', recipientsError);
        throw recipientsError;
      }

      result.recipients = recipients?.map(r => ({
        ...r,
        fund_requested: parseFloat(r.fund_requested) || 0,
      })) || [];
    }

    // Insert articles if Article type
    if (data.fundRequest.fund_request_type === 'Article' && data.articles && data.articles.length > 0) {
      // Use cumulative from article data (set to 0 in form, but keep for backward compatibility)
      const articlesWithCumulative = data.articles.map(article => ({
        ...article,
        cumulative: article.cumulative || 0, // Use provided cumulative or default to 0
      }));

      const { data: articles, error: articlesError } = await supabase
        .from('fund_request_articles')
        .insert(
          articlesWithCumulative.map(article => ({
            ...article,
            fund_request_id: fundRequest.id,
          }))
        )
        .select();

      if (articlesError) {
        console.error('Error creating articles:', articlesError);
        throw articlesError;
      }

      result.articles = articles?.map(item => ({
        ...item,
        quantity: parseInt(item.quantity) || 0,
        unit_price: parseFloat(item.unit_price) || 0,
        price_including_gst: parseFloat(item.price_including_gst) || 0,
        value: parseFloat(item.value) || 0,
        cumulative: parseFloat(item.cumulative) || 0,
      })) || [];

      // Create order entries for each article
      if (articles && articles.length > 0) {
        try {
          const orderPromises = articles.map(article => {
            const orderData: Omit<OrderEntry, 'id' | 'created_at' | 'updated_at'> = {
              article_id: article.article_id,
              quantity_ordered: article.quantity,
              order_date: new Date().toISOString().split('T')[0],
              status: 'pending',
              supplier_name: null,
              supplier_contact: null,
              unit_price: article.unit_price,
              total_amount: article.value,
              notes: `Created from Fund Request: ${fundRequest.fund_request_number}`,
              fund_request_id: fundRequest.id,
            };
            return createOrderEntry(orderData);
          });

          await Promise.all(orderPromises);
        } catch (orderError) {
          console.error('Error creating order entries:', orderError);
          // Don't throw - order creation failure shouldn't fail fund request creation
        }
      }
    }

    // Log audit action
    await logAction(userId, 'CREATE', 'fund_request', fundRequest.id, {
      entity_name: fundRequest.fund_request_number,
      entity_summary: `Fund Request: ${fundRequest.fund_request_number} (${fundRequest.fund_request_type})`,
      new_values: {
        fund_request_type: fundRequest.fund_request_type,
        fund_request_number: fundRequest.fund_request_number,
        total_amount: fundRequest.total_amount,
      },
    });

    return result;
  } catch (error) {
    console.error('Failed to create fund request:', error);
    throw error;
  }
};

/**
 * Update fund request with recipients/articles
 */
export const updateFundRequest = async (
  id: string,
  data: {
    fundRequest: Partial<Omit<FundRequest, 'id' | 'created_at' | 'updated_at'>>;
    recipients?: Omit<FundRequestRecipient, 'id' | 'fund_request_id' | 'created_at'>[];
    articles?: Omit<FundRequestArticle, 'id' | 'fund_request_id' | 'created_at'>[];
  }
): Promise<FundRequestWithDetails> => {
  try {
    const userId = await getCurrentUserId();

    // Get existing fund request for audit log
    const existing = await fetchFundRequestById(id);
    if (!existing) {
      throw new Error('Fund request not found');
    }

    // Update fund request
    const { data: fundRequest, error: fundRequestError } = await supabase
      .from('fund_request')
      .update(data.fundRequest)
      .eq('id', id)
      .select()
      .single();

    if (fundRequestError) {
      console.error('Error updating fund request:', fundRequestError);
      throw fundRequestError;
    }

    const result: FundRequestWithDetails = {
      ...fundRequest,
      total_amount: parseFloat(fundRequest.total_amount) || 0,
    };

    // Update recipients if Aid type
    if (data.fundRequest.fund_request_type === 'Aid' && data.recipients !== undefined) {
      // Delete existing recipients
      await supabase
        .from('fund_request_recipients')
        .delete()
        .eq('fund_request_id', id);

      // Insert new recipients
      if (data.recipients.length > 0) {
        const { data: recipients, error: recipientsError } = await supabase
          .from('fund_request_recipients')
          .insert(
            data.recipients.map(recipient => ({
              ...recipient,
              fund_request_id: id,
            }))
          )
          .select();

        if (recipientsError) {
          console.error('Error updating recipients:', recipientsError);
          throw recipientsError;
        }

        result.recipients = recipients?.map(r => ({
          ...r,
          fund_requested: parseFloat(r.fund_requested) || 0,
        })) || [];
      } else {
        result.recipients = [];
      }
    }

    // Update articles if Article type
    if (data.fundRequest.fund_request_type === 'Article' && data.articles !== undefined) {
      // Delete existing articles
      await supabase
        .from('fund_request_articles')
        .delete()
        .eq('fund_request_id', id);

      // Insert new articles
      if (data.articles.length > 0) {
        // Use cumulative from article data (set to 0 in form, but keep for backward compatibility)
        const articlesWithCumulative = data.articles.map(article => ({
          ...article,
          cumulative: article.cumulative || 0, // Use provided cumulative or default to 0
        }));

        const { data: articles, error: articlesError } = await supabase
          .from('fund_request_articles')
          .insert(
            articlesWithCumulative.map(article => ({
              ...article,
              fund_request_id: id,
            }))
          )
          .select();

        if (articlesError) {
          console.error('Error updating articles:', articlesError);
          throw articlesError;
        }

        result.articles = articles?.map(item => ({
          ...item,
          quantity: parseInt(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          price_including_gst: parseFloat(item.price_including_gst) || 0,
          value: parseFloat(item.value) || 0,
          cumulative: parseFloat(item.cumulative) || 0,
        })) || [];
      } else {
        result.articles = [];
      }
    }

    // Log audit action
    await logAction(userId, 'UPDATE', 'fund_request', id, {
      entity_name: fundRequest.fund_request_number,
      entity_summary: `Fund Request: ${fundRequest.fund_request_number} (${fundRequest.fund_request_type})`,
      old_values: {
        status: existing.status,
        total_amount: existing.total_amount,
      },
      new_values: {
        status: fundRequest.status,
        total_amount: fundRequest.total_amount,
      },
    });

    return result;
  } catch (error) {
    console.error('Failed to update fund request:', error);
    throw error;
  }
};

/**
 * Delete fund request (hard delete)
 */
export const deleteFundRequest = async (id: string): Promise<void> => {
  try {
    const userId = await getCurrentUserId();

    // Get existing fund request for audit log
    const existing = await fetchFundRequestById(id);
    if (!existing) {
      throw new Error('Fund request not found');
    }

    // Delete fund request (cascade will delete recipients/articles)
    const { error } = await supabase
      .from('fund_request')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting fund request:', error);
      throw error;
    }

    // Log audit action
    await logAction(userId, 'DELETE', 'fund_request', id, {
      entity_name: existing.fund_request_number,
      entity_summary: `Fund Request: ${existing.fund_request_number} (${existing.fund_request_type})`,
      old_values: {
        fund_request_type: existing.fund_request_type,
        fund_request_number: existing.fund_request_number,
        status: existing.status,
      },
    });
  } catch (error) {
    console.error('Failed to delete fund request:', error);
    throw error;
  }
};

