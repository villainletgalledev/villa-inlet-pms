import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from './client';
import { createServerClient } from './server';

export interface AuthUserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF' | 'HOUSEKEEPER' | 'MAINTENANCE';
}

// Client-side authentication helpers
export async function getClientSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error fetching Supabase session:', error.message);
      return null;
    }
    return data.session;
  } catch (err) {
    console.error('Unexpected session error:', err);
    return null;
  }
}

export async function getClientUser(): Promise<User | null> {
  const session = await getClientSession();
  return session?.user ?? null;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; session: Session | null; error: AuthError | Error | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { user: data?.user ?? null, session: data?.session ?? null, error };
  } catch (err: any) {
    return { user: null, session: null, error: err };
  }
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (err: any) {
    return { error: err };
  }
}

// Server-side session verification helper (for Server Components and API Routes)
export async function getServerSession(
  reqHeaders?: Headers | Record<string, string>
): Promise<{ user: User | null; session: Session | null }> {
  try {
    const serverClient = createServerClient();
    let authHeader: string | undefined;

    if (reqHeaders) {
      if (typeof (reqHeaders as Headers).get === 'function') {
        authHeader = (reqHeaders as Headers).get('authorization') ?? undefined;
      } else {
        authHeader =
          (reqHeaders as Record<string, string>)['authorization'] ||
          (reqHeaders as Record<string, string>)['Authorization'];
      }
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data, error } = await serverClient.auth.getUser(token);
      if (!error && data.user) {
        return { user: data.user, session: null };
      }
    }

    return { user: null, session: null };
  } catch (err) {
    console.error('Server auth helper error:', err);
    return { user: null, session: null };
  }
}
