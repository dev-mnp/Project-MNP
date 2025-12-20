import { supabase } from '../lib/supabase';
import { Article } from '../data/mockData';

export interface ArticleRecord {
  id: string;
  article_name: string;
  cost_per_unit: number;
  item_type: string;
  category?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Fetch all articles from the database (including inactive)
 */
export const fetchAllArticles = async (includeInactive: boolean = true): Promise<ArticleRecord[]> => {
  try {
    let query = supabase
      .from('articles')
      .select('*')
      .order('article_name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching articles:', error);
      throw error;
    }

    return (data || []).map((record) => ({
      id: record.id,
      article_name: record.article_name,
      cost_per_unit: parseFloat(record.cost_per_unit) || 0,
      item_type: record.item_type || 'Article',
      category: record.category || null,
      is_active: record.is_active ?? true,
      created_at: record.created_at,
      updated_at: record.updated_at,
    }));
  } catch (error) {
    console.error('Failed to fetch articles:', error);
    throw error;
  }
};

/**
 * Fetch all active articles from the database
 */
export const fetchArticles = async (): Promise<Article[]> => {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('is_active', true)
      .order('article_name', { ascending: true });

    if (error) {
      console.error('Error fetching articles:', error);
      throw error;
    }

    // Transform database records to Article interface
    return (data || []).map((record) => ({
      id: record.id,
      name: record.article_name,
      costPerUnit: parseFloat(record.cost_per_unit) || 0,
      itemType: record.item_type || 'Article',
      category: record.category || undefined,
    }));
  } catch (error) {
    console.error('Failed to fetch articles:', error);
    throw error;
  }
};

/**
 * Fetch a single article by ID
 */
export const fetchArticleById = async (id: string): Promise<Article | null> => {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching article:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.article_name,
      costPerUnit: parseFloat(data.cost_per_unit) || 0,
      itemType: data.item_type || 'Article',
      category: data.category || undefined,
    };
  } catch (error) {
    console.error('Failed to fetch article:', error);
    return null;
  }
};

/**
 * Create a new article
 */
export const createArticle = async (article: {
  article_name: string;
  cost_per_unit: number;
  item_type: string;
  category?: string;
}): Promise<ArticleRecord> => {
  try {
    const { data, error } = await supabase
      .from('articles')
      .insert([article])
      .select()
      .single();

    if (error) {
      console.error('Error creating article:', error);
      throw error;
    }

    return {
      id: data.id,
      article_name: data.article_name,
      cost_per_unit: parseFloat(data.cost_per_unit) || 0,
      item_type: data.item_type || 'Article',
      category: data.category || null,
      is_active: data.is_active ?? true,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  } catch (error) {
    console.error('Failed to create article:', error);
    throw error;
  }
};

/**
 * Update an existing article
 */
export const updateArticle = async (
  id: string,
  updates: {
    article_name?: string;
    cost_per_unit?: number;
    item_type?: string;
    category?: string;
  }
): Promise<ArticleRecord> => {
  try {
    const { data, error } = await supabase
      .from('articles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating article:', error);
      throw error;
    }

    return {
      id: data.id,
      article_name: data.article_name,
      cost_per_unit: parseFloat(data.cost_per_unit) || 0,
      item_type: data.item_type || 'Article',
      category: data.category || null,
      is_active: data.is_active ?? true,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  } catch (error) {
    console.error('Failed to update article:', error);
    throw error;
  }
};

/**
 * Toggle article active status (inactivate/reactivate)
 */
export const toggleArticleStatus = async (id: string, isActive: boolean): Promise<ArticleRecord> => {
  try {
    const { data, error } = await supabase
      .from('articles')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error toggling article status:', error);
      throw error;
    }

    return {
      id: data.id,
      article_name: data.article_name,
      cost_per_unit: parseFloat(data.cost_per_unit) || 0,
      item_type: data.item_type || 'Article',
      category: data.category || null,
      is_active: data.is_active ?? true,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  } catch (error) {
    console.error('Failed to toggle article status:', error);
    throw error;
  }
};
