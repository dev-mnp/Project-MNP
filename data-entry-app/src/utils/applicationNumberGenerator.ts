import { getAllRecords } from '../data/mockData';
import { supabase } from '../lib/supabase';

/**
 * Generate application number based on beneficiary type from database
 * Format: [Type Prefix] [Sequential Number]
 * Prefixes: D (District), P (Public), I (Institutions)
 * For district type, queries the database for existing application numbers
 */
export const generateApplicationNumberFromDB = async (
  beneficiaryType: 'district' | 'public' | 'institutions'
): Promise<string> => {
  const prefix = beneficiaryType === 'district' ? 'D' : beneficiaryType === 'public' ? 'P' : 'I';

  // For district type, query database
  if (beneficiaryType === 'district') {
    try {
      const { data, error } = await supabase
        .from('district_beneficiary_entries')
        .select('application_number')
        .not('application_number', 'is', null);

      if (error) {
        console.error('Error fetching application numbers from database:', error);
        // Fallback to mock data method
        return generateApplicationNumber(beneficiaryType);
      }

      // Extract numbers from application numbers
      const numbers = (data || [])
        .map((entry) => {
          const appNumber = entry.application_number;
          if (!appNumber || typeof appNumber !== 'string') return 0;
          
          // Check if it starts with "D " (district prefix)
          if (!appNumber.startsWith('D ')) return 0;
          
          // Extract the number part
          const match = appNumber.match(/\d+$/);
          return match ? parseInt(match[0], 10) : 0;
        })
        .filter((n) => n > 0);

      // Get the highest number or default to 0
      const highestNumber = numbers.length > 0 ? Math.max(...numbers) : 0;

      // Generate next number
      const nextNumber = highestNumber + 1;

      // Format with leading zeros (3 digits)
      const formattedNumber = nextNumber.toString().padStart(3, '0');

      return `${prefix} ${formattedNumber}`;
    } catch (error) {
      console.error('Failed to generate application number from database:', error);
      // Fallback to mock data method
      return generateApplicationNumber(beneficiaryType);
    }
  }

  // For other types, use mock data method
  return generateApplicationNumber(beneficiaryType);
};

/**
 * Generate application number based on beneficiary type
 * Format: [Type Prefix] [Sequential Number]
 * Prefixes: D (District), P (Public), I (Institutions)
 * Uses mock data as fallback
 */
export const generateApplicationNumber = (beneficiaryType: 'district' | 'public' | 'institutions'): string => {
  const prefix = beneficiaryType === 'district' ? 'D' : beneficiaryType === 'public' ? 'P' : 'I';
  
  // Get all existing records
  const allRecords = getAllRecords();
  
  // Filter records by beneficiary type
  const typeRecords = allRecords.filter(r => r.beneficiaryType === beneficiaryType);
  
  // Extract numbers from application numbers
  const numbers = typeRecords
    .map(r => {
      const match = r.applicationNumber.match(/\d+$/);
      return match ? parseInt(match[0], 10) : 0;
    })
    .filter(n => n > 0);
  
  // Get the highest number or default to 0
  const highestNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  
  // Generate next number
  const nextNumber = highestNumber + 1;
  
  // Format with leading zeros (3 digits)
  const formattedNumber = nextNumber.toString().padStart(3, '0');
  
  return `${prefix} ${formattedNumber}`;
};

/**
 * Validate application number format
 */
export const isValidApplicationNumber = (appNumber: string): boolean => {
  const pattern = /^[DPI]\s\d{3}$/;
  return pattern.test(appNumber);
};

/**
 * Extract beneficiary type from application number
 */
export const getBeneficiaryTypeFromAppNumber = (appNumber: string): 'district' | 'public' | 'institutions' | null => {
  if (appNumber.startsWith('D ')) return 'district';
  if (appNumber.startsWith('P ')) return 'public';
  if (appNumber.startsWith('I ')) return 'institutions';
  return null;
};
