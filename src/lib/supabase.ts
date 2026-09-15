import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl: string = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey: string = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

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
  urlPreview: supabaseUrl ? `${supabaseUrl.slice(0, 16)}...` : 'Not configured',
};
