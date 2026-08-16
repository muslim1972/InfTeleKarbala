import { createClient } from '@supabase/supabase-js';

const getDynamicSupabaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname) {
    const host = window.location.hostname;
    if (host === '10.56.3.3' || host === 'localhost' || host === '127.0.0.1') {
      return window.location.origin;
    }
  }
  return import.meta.env.VITE_SUPABASE_URL || 'https://khr-itpc.egov.iq';
};

const supabaseUrl = getDynamicSupabaseUrl();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
