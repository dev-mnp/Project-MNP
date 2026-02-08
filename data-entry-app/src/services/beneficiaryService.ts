import { supabase } from '../lib/supabase';

export interface BeneficiaryDropdownOption {
  application_number: string;
  display_text: string;
  total_amount: number;
  // Additional fields for reference
  district_name?: string;
  name?: string;
  institution_name?: string;
}

/**
 * Fetch used beneficiaries from saved fund requests
 * Returns a Set of application_numbers that have been used in fund requests
 */
export const fetchUsedBeneficiariesForFundRequest = async (excludeFundRequestId?: string): Promise<Set<string>> => {
  try {
    let query = supabase
      .from('fund_request_recipients')
      .select('beneficiary')
      .not('beneficiary', 'is', null);

    // Exclude current fund request if editing
    if (excludeFundRequestId) {
      const { data: fundRequest } = await supabase
        .from('fund_request')
        .select('id')
        .eq('id', excludeFundRequestId)
        .single();

      if (fundRequest) {
        query = query.neq('fund_request_id', excludeFundRequestId);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching used beneficiaries:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return new Set();
    }

    // Extract application numbers from beneficiary display text
    // Format: "application_number - name - ₹ amount"
    const usedAppNumbers = new Set<string>();
    
    data.forEach((entry: any) => {
      if (entry.beneficiary) {
        const match = entry.beneficiary.match(/^([^-]+)/);
        if (match) {
          usedAppNumbers.add(match[1].trim());
        }
      }
    });

    return usedAppNumbers;
  } catch (error) {
    console.error('Failed to fetch used beneficiaries:', error);
    throw error;
  }
};

/**
 * Fetch district beneficiaries for dropdown
 * Returns: { application_number, district_name, total_amount }[]
 * @param aidType - Optional aid type to filter by (matches article name or category)
 */
export const fetchDistrictBeneficiariesForDropdown = async (aidType?: string): Promise<BeneficiaryDropdownOption[]> => {
  try {
    const { data, error } = await supabase
      .from('district_beneficiary_entries')
      .select(`
        application_number,
        total_amount,
        district_master:district_id (
          district_name
        ),
        articles:article_id (
          item_type,
          article_name,
          category
        )
      `)
      .not('application_number', 'is', null)
      .order('application_number', { ascending: false });

    if (error) {
      console.error('Error fetching district beneficiaries:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Group by application_number and calculate total (only for Aid items)
    const grouped = new Map<string, { district_name: string; total_amount: number }>();

    data.forEach((entry: any) => {
      const appNumber = entry.application_number;
      if (!appNumber) return;

      // Only include entries where article item_type is 'Aid'
      const articleItemType = entry.articles?.item_type;
      if (articleItemType !== 'Aid') return;

      // Filter by aid_type if provided (match article name or category)
      if (aidType && aidType.trim()) {
        const articleName = entry.articles?.article_name?.toLowerCase() || '';
        const articleCategory = entry.articles?.category?.toLowerCase() || '';
        const aidTypeLower = aidType.toLowerCase();
        
        const matchesName = articleName.includes(aidTypeLower);
        const matchesCategory = articleCategory.includes(aidTypeLower);
        
        if (!matchesName && !matchesCategory) return;
      }

      const districtName = entry.district_master?.district_name || '';
      const amount = parseFloat(entry.total_amount) || 0;

      if (grouped.has(appNumber)) {
        const existing = grouped.get(appNumber)!;
        existing.total_amount += amount;
      } else {
        grouped.set(appNumber, {
          district_name: districtName,
          total_amount: amount,
        });
      }
    });

    // Convert to array format
    return Array.from(grouped.entries()).map(([application_number, data]) => ({
      application_number,
      display_text: `${application_number} - ${data.district_name} - ₹ ${data.total_amount.toLocaleString()}`,
      total_amount: data.total_amount,
      district_name: data.district_name,
    }));
  } catch (error) {
    console.error('Failed to fetch district beneficiaries:', error);
    throw error;
  }
};

/**
 * Fetch public beneficiaries for dropdown
 * Returns: { application_number, name, total_amount }[]
 * @param aidType - Optional aid type to filter by (matches article name or category)
 */
export const fetchPublicBeneficiariesForDropdown = async (aidType?: string): Promise<BeneficiaryDropdownOption[]> => {
  try {
    const { data, error } = await supabase
      .from('public_beneficiary_entries')
      .select(`
        application_number,
        name,
        total_amount,
        articles:article_id (
          item_type,
          article_name,
          category
        )
      `)
      .not('application_number', 'is', null)
      .order('application_number', { ascending: false });

    if (error) {
      console.error('Error fetching public beneficiaries:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Group by application_number and calculate total (only for Aid items)
    const grouped = new Map<string, { name: string; total_amount: number }>();

    data.forEach((entry: any) => {
      const appNumber = entry.application_number;
      if (!appNumber) return;

      // Only include entries where article item_type is 'Aid'
      const articleItemType = entry.articles?.item_type;
      if (articleItemType !== 'Aid') return;

      // Filter by aid_type if provided (match article name or category)
      if (aidType && aidType.trim()) {
        const articleName = entry.articles?.article_name?.toLowerCase() || '';
        const articleCategory = entry.articles?.category?.toLowerCase() || '';
        const aidTypeLower = aidType.toLowerCase();
        
        const matchesName = articleName.includes(aidTypeLower);
        const matchesCategory = articleCategory.includes(aidTypeLower);
        
        if (!matchesName && !matchesCategory) return;
      }

      const name = entry.name || '';
      const amount = parseFloat(entry.total_amount) || 0;

      if (grouped.has(appNumber)) {
        const existing = grouped.get(appNumber)!;
        existing.total_amount += amount;
      } else {
        grouped.set(appNumber, {
          name,
          total_amount: amount,
        });
      }
    });

    // Convert to array format
    return Array.from(grouped.entries()).map(([application_number, data]) => ({
      application_number,
      display_text: `${application_number} - ${data.name} - ₹ ${data.total_amount.toLocaleString()}`,
      total_amount: data.total_amount,
      name: data.name,
    }));
  } catch (error) {
    console.error('Failed to fetch public beneficiaries:', error);
    throw error;
  }
};

/**
 * Fetch institution beneficiaries for dropdown
 * Returns: { application_number, institution_name, total_amount }[]
 * where institution_type = 'institutions'
 * @param aidType - Optional aid type to filter by (matches article name or category)
 */
export const fetchInstitutionBeneficiariesForDropdown = async (aidType?: string): Promise<BeneficiaryDropdownOption[]> => {
  try {
    const { data, error } = await supabase
      .from('institutions_beneficiary_entries')
      .select(`
        application_number,
        institution_name,
        total_amount,
        articles:article_id (
          item_type,
          article_name,
          category
        )
      `)
      .eq('institution_type', 'institutions')
      .not('application_number', 'is', null)
      .order('application_number', { ascending: false });

    if (error) {
      console.error('Error fetching institution beneficiaries:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Group by application_number and calculate total (only for Aid items)
    const grouped = new Map<string, { institution_name: string; total_amount: number }>();

    data.forEach((entry: any) => {
      const appNumber = entry.application_number;
      if (!appNumber) return;

      // Only include entries where article item_type is 'Aid'
      const articleItemType = entry.articles?.item_type;
      if (articleItemType !== 'Aid') return;

      // Filter by aid_type if provided (match article name or category)
      if (aidType && aidType.trim()) {
        const articleName = entry.articles?.article_name?.toLowerCase() || '';
        const articleCategory = entry.articles?.category?.toLowerCase() || '';
        const aidTypeLower = aidType.toLowerCase();
        
        const matchesName = articleName.includes(aidTypeLower);
        const matchesCategory = articleCategory.includes(aidTypeLower);
        
        if (!matchesName && !matchesCategory) return;
      }

      const institutionName = entry.institution_name || '';
      const amount = parseFloat(entry.total_amount) || 0;

      if (grouped.has(appNumber)) {
        const existing = grouped.get(appNumber)!;
        existing.total_amount += amount;
      } else {
        grouped.set(appNumber, {
          institution_name: institutionName,
          total_amount: amount,
        });
      }
    });

    // Convert to array format
    return Array.from(grouped.entries()).map(([application_number, data]) => ({
      application_number,
      display_text: `${application_number} - ${data.institution_name} - ₹ ${data.total_amount.toLocaleString()}`,
      total_amount: data.total_amount,
      institution_name: data.institution_name,
    }));
  } catch (error) {
    console.error('Failed to fetch institution beneficiaries:', error);
    throw error;
  }
};

/**
 * Fetch others beneficiaries for dropdown
 * Returns: { application_number, institution_name, total_amount }[]
 * where institution_type = 'others'
 * @param aidType - Optional aid type to filter by (matches article name or category)
 */
export const fetchOthersBeneficiariesForDropdown = async (aidType?: string): Promise<BeneficiaryDropdownOption[]> => {
  try {
    const { data, error } = await supabase
      .from('institutions_beneficiary_entries')
      .select(`
        application_number,
        institution_name,
        total_amount,
        articles:article_id (
          item_type,
          article_name,
          category
        )
      `)
      .eq('institution_type', 'others')
      .not('application_number', 'is', null)
      .order('application_number', { ascending: false });

    if (error) {
      console.error('Error fetching others beneficiaries:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Group by application_number and calculate total (only for Aid items)
    const grouped = new Map<string, { institution_name: string; total_amount: number }>();

    data.forEach((entry: any) => {
      const appNumber = entry.application_number;
      if (!appNumber) return;

      // Only include entries where article item_type is 'Aid'
      const articleItemType = entry.articles?.item_type;
      if (articleItemType !== 'Aid') return;

      // Filter by aid_type if provided (match article name or category)
      if (aidType && aidType.trim()) {
        const articleName = entry.articles?.article_name?.toLowerCase() || '';
        const articleCategory = entry.articles?.category?.toLowerCase() || '';
        const aidTypeLower = aidType.toLowerCase();
        
        const matchesName = articleName.includes(aidTypeLower);
        const matchesCategory = articleCategory.includes(aidTypeLower);
        
        if (!matchesName && !matchesCategory) return;
      }

      const institutionName = entry.institution_name || '';
      const amount = parseFloat(entry.total_amount) || 0;

      if (grouped.has(appNumber)) {
        const existing = grouped.get(appNumber)!;
        existing.total_amount += amount;
      } else {
        grouped.set(appNumber, {
          institution_name: institutionName,
          total_amount: amount,
        });
      }
    });

    // Convert to array format
    return Array.from(grouped.entries()).map(([application_number, data]) => ({
      application_number,
      display_text: `${application_number} - ${data.institution_name} - ₹ ${data.total_amount.toLocaleString()}`,
      total_amount: data.total_amount,
      institution_name: data.institution_name,
    }));
  } catch (error) {
    console.error('Failed to fetch others beneficiaries:', error);
    throw error;
  }
};
