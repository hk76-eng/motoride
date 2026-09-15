import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://ucyvkdpkhtrlmvjtilso.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjeXZrZHBraHRybG12anRpbHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMDU5MjcsImV4cCI6MjEwNDg4MTkyN30.oQwprT_mdnXphzQYBd0OLq_JCU2TJy3GWrNHPlk_Sco';

const rawUrl: string = (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const supabaseUrl: string = rawUrl ? rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '') : '';
export const supabaseAnonKey: string = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('your-project') &&
    supabaseAnonKey.length > 20
  );
};

let clientInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return clientInstance;
};

export const SUPABASE_CONFIG_STATUS = {
  urlConfigured: Boolean(supabaseUrl),
  keyConfigured: Boolean(supabaseAnonKey),
  isReady: isSupabaseConfigured(),
  urlPreview: supabaseUrl ? `${supabaseUrl.slice(0, 24)}...` : 'Not configured',
};
