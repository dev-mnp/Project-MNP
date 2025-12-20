import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://miftepyeoqfjyjeqffet.supabase.co';// import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZnRlcHllb3FmanlqZXFmZmV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3ODY5NzgsImV4cCI6MjA4MTM2Mjk3OH0.19nAsbnhQmTNrp6XqZ-iiUULMW8tnwSHIx5GbP5-cGY';// import.meta.env.VITE_SUPABASE_ANON_KEY;
console.log(supabaseUrl, supabaseAnonKey);
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// User role types
export type UserRole = 'admin' | 'editor' | 'viewer';

// Auth user interface
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  permissions?: string[];
  roles?: string[];
  created_at?: string;
}
