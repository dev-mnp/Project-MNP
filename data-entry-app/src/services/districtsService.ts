import { supabase } from '../lib/supabase';
import { District } from '../data/mockData';

/**
 * Fetch all active districts from the database
 */
export const fetchDistricts = async (): Promise<District[]> => {
  try {
    const { data, error } = await supabase
      .from('district_master')
      .select('*')
      .eq('is_active', true)
      .order('district_name', { ascending: true });

    if (error) {
      console.error('Error fetching districts:', error);
      throw error;
    }

    // Transform database records to District interface
    return (data || []).map((record) => ({
      id: record.id,
      name: record.district_name,
      allottedBudget: parseFloat(record.allotted_budget) || 0,
      presidentName: record.president_name,
      mobileNumber: record.mobile_number,
    }));
  } catch (error) {
    console.error('Failed to fetch districts:', error);
    throw error;
  }
};

/**
 * Fetch a single district by ID
 */
export const fetchDistrictById = async (id: string): Promise<District | null> => {
  try {
    const { data, error } = await supabase
      .from('district_master')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching district:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.district_name,
      allottedBudget: parseFloat(data.allotted_budget) || 0,
      presidentName: data.president_name,
      mobileNumber: data.mobile_number,
    };
  } catch (error) {
    console.error('Failed to fetch district:', error);
    return null;
  }
};
