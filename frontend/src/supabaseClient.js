import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const isSupabaseAuthConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http')
);

export const supabase = isSupabaseAuthConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
