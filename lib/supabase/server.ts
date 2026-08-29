import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-side Supabase client using Service Role Key for administrative operations
let serverClientInstance: SupabaseClient | null = null;

export function createServerClient(): SupabaseClient {
  if (serverClientInstance) return serverClientInstance;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase server client initialization failed: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.'
    );
  }

  serverClientInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return serverClientInstance;
}
