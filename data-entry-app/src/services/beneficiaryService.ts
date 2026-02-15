import { supabase } from '../lib/supabase';

export interface BeneficiaryDropdownOption {
  application_number: string;
  display_text: string;
  total_amount: number;
  // Additional fields for reference
  district_name?: string;
  name?: string;
  institution_name?: string;
  aadhar_number?: string;
  id?: string; // Entry ID for district entries to ensure uniqueness
}

/**
 * Fetch used beneficiaries from saved fund requests
 * Returns a Set of identifiers that have been used in fund requests
 * For District entries: returns the full display_text (since we match by display_text)
 * For other types: returns the application_number extracted from display text
 */
export const fetchUsedBeneficiariesForFundRequest = async (excludeFundRequestId?: string): Promise<Set<string>> => {
  try {
    let query = supabase
      .from('fund_request_recipients')
      .select('beneficiary, beneficiary_type')
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

    // Extract identifiers from beneficiary display text
    // For District: use full display_text (since district entries use entry ID in application_number)
    // For others: extract application_number from display text
    const usedIdentifiers = new Set<string>();
    
    data.forEach((entry: any) => {
      if (entry.beneficiary) {
        if (entry.beneficiary_type === 'District') {
          // For district entries, use the full display_text as identifier
          // This matches how we filter in loadBeneficiaries
          usedIdentifiers.add(entry.beneficiary);
        } else {
          // For other types, extract application number from display text
          // Format: "application_number - name - ₹ amount"
          const match = entry.beneficiary.match(/^([^-]+)/);
          if (match) {
            usedIdentifiers.add(match[1].trim());
          }
        }
      }
    });

    return usedIdentifiers;
  } catch (error) {
    console.error('Failed to fetch used beneficiaries:', error);
    throw error;
  }
};

/**
 * Fetch district beneficiaries for dropdown
 * Returns: { application_number, district_name, total_amount }[]
 * @param aidType - Optional aid type to filter by (matches article name or category)
 * @param districtId - Optional district ID to filter by
 */
export const fetchDistrictBeneficiariesForDropdown = async (aidType?: string, districtId?: string): Promise<BeneficiaryDropdownOption[]> => {
  try {
    let query = supabase
      .from('district_beneficiary_entries')
      .select(`
        id,
        application_number,
        total_amount,
        notes,
        district_id,
        district_master:district_id (
          district_name
        ),
        articles:article_id (
          item_type,
          article_name,
          category
        )
      `)
      .not('application_number', 'is', null);

    // Filter by district_id if provided
    if (districtId) {
      query = query.eq('district_id', districtId);
    }

    query = query.order('application_number', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching district beneficiaries:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // When district is selected, show each aid entry separately with aid type
    // When no district is selected, group by application_number
    const results: BeneficiaryDropdownOption[] = [];

    if (districtId) {
      // Show each entry separately with aid type when district is selected
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
        const aidTypeName = entry.articles?.article_name || 'Unknown Aid';
        const notes = entry.notes || '';
        const entryId = entry.id || '';

        // Build display text with comments if available
        let displayText = `${appNumber} - ${aidTypeName} - ₹ ${amount.toLocaleString()}`;
        if (notes && notes.trim()) {
          displayText += ` - ${notes}`;
        }

        // Use entry ID to ensure uniqueness even if app number, aid type, and cost are the same
        results.push({
          application_number: entryId || `${appNumber}-${aidTypeName}`, // Use entry ID for uniqueness
          display_text: displayText,
          total_amount: amount,
          district_name: districtName,
          id: entryId, // Store entry ID for reference
        });
      });
      
      // Sort by application number for better UX
      results.sort((a, b) => {
        const aNum = a.display_text.split(' - ')[0];
        const bNum = b.display_text.split(' - ')[0];
        return bNum.localeCompare(aNum); // Descending order
      });
    } else {
      // Group by application_number when no district is selected (original behavior)
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

      // Convert grouped data to array format
      Array.from(grouped.entries()).forEach(([application_number, data]) => {
        results.push({
          application_number,
          display_text: `${application_number} - ${data.district_name} - ₹ ${data.total_amount.toLocaleString()}`,
          total_amount: data.total_amount,
          district_name: data.district_name,
        });
      });
    }

    return results;
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
        aadhar_number,
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
    const grouped = new Map<string, { name: string; total_amount: number; aadhar_number?: string }>();

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
      const aadharNumber = entry.aadhar_number || undefined;

      if (grouped.has(appNumber)) {
        const existing = grouped.get(appNumber)!;
        existing.total_amount += amount;
        // Keep aadhar_number if not already set
        if (!existing.aadhar_number && aadharNumber) {
          existing.aadhar_number = aadharNumber;
        }
      } else {
        grouped.set(appNumber, {
          name,
          total_amount: amount,
          aadhar_number: aadharNumber,
        });
      }
    });

    // Convert to array format
    return Array.from(grouped.entries()).map(([application_number, data]) => ({
      application_number,
      display_text: `${application_number} - ${data.name} - ₹ ${data.total_amount.toLocaleString()}`,
      total_amount: data.total_amount,
      name: data.name,
      aadhar_number: data.aadhar_number,
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
