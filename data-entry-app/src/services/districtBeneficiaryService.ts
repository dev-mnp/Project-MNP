import { supabase } from '../lib/supabase';
import type { MasterEntryRecord, ArticleSelection } from '../data/mockData';

export interface DistrictBeneficiaryEntry {
  id?: string;
  district_id: string;
  application_number?: string;
  article_id: string;
  quantity: number;
  article_cost_per_unit?: number;
  total_amount: number;
  notes?: string | null;
  status?: 'pending' | 'approved' | 'rejected' | 'completed';
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface DistrictBeneficiaryEntryWithJoins extends DistrictBeneficiaryEntry {
  district_master?: {
    district_name: string;
  };
  articles?: {
    article_name: string;
    cost_per_unit: number;
  };
}

/**
 * Create district beneficiary entries
 * For district type, we create one entry per article
 */
export const createDistrictBeneficiaryEntries = async (
  entries: Omit<DistrictBeneficiaryEntry, 'id' | 'created_at' | 'updated_at'>[]
): Promise<DistrictBeneficiaryEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('district_beneficiary_entries')
      .insert(entries)
      .select();

    if (error) {
      console.error('Error creating district beneficiary entries:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to create district beneficiary entries:', error);
    throw error;
  }
};

/**
 * Fetch district beneficiary entries
 */
export const fetchDistrictBeneficiaryEntries = async (
  districtId?: string
): Promise<DistrictBeneficiaryEntry[]> => {
  try {
    let query = supabase
      .from('district_beneficiary_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (districtId) {
      query = query.eq('district_id', districtId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching district beneficiary entries:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch district beneficiary entries:', error);
    throw error;
  }
};

/**
 * Fetch district beneficiary entry by district ID (for checking if district already has an entry)
 * Returns the first entry found for that district, grouped by application number
 */
export const fetchDistrictBeneficiaryEntryByDistrictId = async (
  districtId: string
): Promise<MasterEntryRecord | null> => {
  try {
    const { data, error } = await supabase
      .from('district_beneficiary_entries')
      .select(`
        *,
        district_master:district_id (
          district_name,
          allotted_budget
        ),
        articles:article_id (
          article_name,
          cost_per_unit
        )
      `)
      .eq('district_id', districtId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching district beneficiary entry by district ID:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Group by application_number (should be same for all entries of a district)
    const groupedByAppNumber = new Map<string, any[]>();
    data.forEach((entry: any) => {
      const appNumber = entry.application_number;
      if (!appNumber) return;
      if (!groupedByAppNumber.has(appNumber)) {
        groupedByAppNumber.set(appNumber, []);
      }
      groupedByAppNumber.get(appNumber)!.push(entry);
    });

    // Get the first application number group (most recent)
    const firstAppNumber = Array.from(groupedByAppNumber.keys())[0];
    const entries = groupedByAppNumber.get(firstAppNumber) || [];

    if (entries.length === 0) return null;

    const firstEntry = entries[0];
    const districtName = firstEntry.district_master?.district_name || '';

    // Transform entries to ArticleSelection array
    const selectedArticles: ArticleSelection[] = entries.map((entry: any) => ({
      articleId: entry.article_id,
      articleName: entry.articles?.article_name || '',
      quantity: entry.quantity,
      costPerUnit: entry.article_cost_per_unit != null 
        ? parseFloat(entry.article_cost_per_unit) 
        : parseFloat(entry.articles?.cost_per_unit || 0),
      totalValue: parseFloat(entry.total_amount || 0),
      comments: entry.notes || '',
    }));

    // Calculate total accrued
    const totalAccrued = entries.reduce(
      (sum, entry) => sum + parseFloat(entry.total_amount || 0),
      0
    );

    // Get earliest created_at
    const createdAt = entries.reduce((earliest, entry) => {
      const entryDate = entry.created_at ? new Date(entry.created_at).getTime() : 0;
      const earliestDate = earliest ? new Date(earliest).getTime() : Infinity;
      return entryDate < earliestDate ? entry.created_at : earliest;
    }, entries[0]?.created_at || new Date().toISOString());

    return {
      id: firstEntry.id || firstAppNumber,
      applicationNumber: firstAppNumber,
      beneficiaryType: 'district',
      districtId: firstEntry.district_id,
      districtName: districtName,
      selectedArticles: selectedArticles,
      totalAccrued: totalAccrued,
      createdAt: createdAt,
    };
  } catch (error) {
    console.error('Failed to fetch district beneficiary entry by district ID:', error);
    return null;
  }
};

/**
 * Update district beneficiary entry
 */
export const updateDistrictBeneficiaryEntry = async (
  id: string,
  updates: Partial<DistrictBeneficiaryEntry>
): Promise<DistrictBeneficiaryEntry> => {
  try {
    const { data, error } = await supabase
      .from('district_beneficiary_entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating district beneficiary entry:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to update district beneficiary entry:', error);
    throw error;
  }
};

/**
 * Delete district beneficiary entry
 */
export const deleteDistrictBeneficiaryEntry = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('district_beneficiary_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting district beneficiary entry:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete district beneficiary entry:', error);
    throw error;
  }
};

/**
 * Delete all entries for an application number
 */
export const deleteDistrictBeneficiaryEntriesByApplicationNumber = async (
  applicationNumber: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('district_beneficiary_entries')
      .delete()
      .eq('application_number', applicationNumber);

    if (error) {
      console.error('Error deleting district beneficiary entries by application number:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete district beneficiary entries by application number:', error);
    throw error;
  }
};

/**
 * Fetch district beneficiary entries grouped by application number
 * Returns records in MasterEntryRecord format for display
 */
export const fetchDistrictBeneficiaryEntriesGrouped = async (): Promise<MasterEntryRecord[]> => {
  try {
    const { data, error } = await supabase
      .from('district_beneficiary_entries')
      .select(`
        *,
        district_master:district_id (
          district_name,
          allotted_budget
        ),
        articles:article_id (
          article_name,
          cost_per_unit
        )
      `)
      .order('application_number', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching district beneficiary entries:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Group entries by application_number
    const groupedByAppNumber = new Map<string, any[]>();

    data.forEach((entry: any) => {
      const appNumber = entry.application_number;
      if (!appNumber) return; // Skip entries without application number

      if (!groupedByAppNumber.has(appNumber)) {
        groupedByAppNumber.set(appNumber, []);
      }
      groupedByAppNumber.get(appNumber)!.push(entry);
    });

    // Transform grouped data to MasterEntryRecord format
    const records: MasterEntryRecord[] = [];

    groupedByAppNumber.forEach((entries, applicationNumber) => {
      if (entries.length === 0) return;

      const firstEntry = entries[0];
      const districtName = firstEntry.district_master?.district_name || '';

      // Transform entries to ArticleSelection array
      const selectedArticles: ArticleSelection[] = entries.map((entry: any) => ({
        articleId: entry.article_id,
        articleName: entry.articles?.article_name || '',
        quantity: entry.quantity,
        costPerUnit: entry.article_cost_per_unit != null 
          ? parseFloat(entry.article_cost_per_unit) 
          : parseFloat(entry.articles?.cost_per_unit || 0),
        totalValue: parseFloat(entry.total_amount || 0),
        comments: entry.notes || '',
      }));

      // Calculate total accrued for this application
      const totalAccrued = entries.reduce(
        (sum, entry) => sum + parseFloat(entry.total_amount || 0),
        0
      );

      // Get earliest created_at
      const createdAt = entries.reduce((earliest, entry) => {
        const entryDate = entry.created_at ? new Date(entry.created_at).getTime() : 0;
        const earliestDate = earliest ? new Date(earliest).getTime() : Infinity;
        return entryDate < earliestDate ? entry.created_at : earliest;
      }, entries[0]?.created_at || new Date().toISOString());

      const record: MasterEntryRecord = {
        id: firstEntry.id || applicationNumber,
        applicationNumber: applicationNumber,
        beneficiaryType: 'district',
        districtId: firstEntry.district_id,
        districtName: districtName,
        selectedArticles: selectedArticles,
        totalAccrued: totalAccrued,
        createdAt: createdAt,
      };

      records.push(record);
    });

    // Sort by created_at descending (newest first)
    records.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return records;
  } catch (error) {
    console.error('Failed to fetch and group district beneficiary entries:', error);
    throw error;
  }
};

/**
 * Get custom costs for a district (most recent cost per article)
 * Returns a Map of article_id -> cost_per_unit
 */
export const getCustomCostsForDistrict = async (
  districtId: string
): Promise<Map<string, number>> => {
  try {
    // Get the most recent entry for each article in this district
    const { data, error } = await supabase
      .from('district_beneficiary_entries')
      .select('article_id, article_cost_per_unit, created_at')
      .eq('district_id', districtId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching custom costs for district:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return new Map();
    }

    // Map to store the most recent cost per article
    const customCosts = new Map<string, number>();
    const seenArticles = new Set<string>();

    // Since data is ordered by created_at DESC, first occurrence is most recent
    data.forEach((entry: any) => {
      if (!seenArticles.has(entry.article_id) && entry.article_cost_per_unit != null) {
        customCosts.set(entry.article_id, parseFloat(entry.article_cost_per_unit));
        seenArticles.add(entry.article_id);
      }
    });

    return customCosts;
  } catch (error) {
    console.error('Failed to get custom costs for district:', error);
    return new Map();
  }
};
