import { createClient } from '@supabase/supabase-js';

const VPS_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg0MjUzNTAxLCJleHAiOjIwOTk2MTM1MDF9.J6epEjJZoyDL5GM_PNLoh3P2j18CCP4WeLrfAejCaew';

const isVpsEnvironment = () => {
  if (typeof window !== 'undefined' && window.location.hostname) {
    const host = window.location.hostname;
    return host === '10.56.3.3' || host === 'localhost' || host === '127.0.0.1' || host.includes('egov.iq');
  }
  return false;
};

const getDynamicSupabaseUrl = () => {
  if (isVpsEnvironment()) {
    return window.location.origin;
  }
  return import.meta.env.VITE_SUPABASE_URL || 'https://jvnjkqxpnhridlbczkgw.supabase.co';
};

const getDynamicSupabaseAnonKey = () => {
  if (isVpsEnvironment()) {
    return VPS_ANON_KEY;
  }
  return import.meta.env.VITE_SUPABASE_ANON_KEY || VPS_ANON_KEY;
};

// مُصدَّرة لإنشاء عملاء مخصصين (مثل عميل التخزين بمفتاح التطبيق في snapshotStorage)
export const supabaseUrl = getDynamicSupabaseUrl();
export const supabaseAnonKey = getDynamicSupabaseAnonKey();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
