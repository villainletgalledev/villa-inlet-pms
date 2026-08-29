import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve Supabase URL and Anon Key across Vite/Next.js/Node environments
const getEnv = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
  } catch {
    // ignore
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch {
    // ignore
  }
  return '';
};

export const supabaseUrl =
  getEnv('NEXT_PUBLIC_SUPABASE_URL') ||
  getEnv('VITE_SUPABASE_URL') ||
  getEnv('SUPABASE_URL');

export const supabaseAnonKey =
  getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
  getEnv('VITE_SUPABASE_ANON_KEY') ||
  getEnv('SUPABASE_ANON_KEY');

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl) && Boolean(supabaseAnonKey);
};

// Singleton browser client for client components
let browserClient: SupabaseClient | null = null;

export function createBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase client initialization failed: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables are required.'
    );
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}

export const supabase = createBrowserClient();
