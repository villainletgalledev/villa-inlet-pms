import { UserRole } from '../rbac';
import { supabase, isSupabaseConfigured } from '../supabase/client';

export interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

async function getAuthHeaders(_currentUser?: { role?: string; email?: string }): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers['Authorization'] = `Bearer ${data.session.access_token}`;
      }
    } catch {
      // ignore
    }
  }

  return headers;
}

export async function fetchUsers(currentUser?: { role?: string; email?: string }): Promise<{ users: StaffUser[]; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch('/api/users', { headers });
    const data = await res.json();
    if (!res.ok) {
      return { users: [], error: data.error || 'Failed to fetch users' };
    }
    return { users: data.users || [] };
  } catch (err: any) {
    return { users: [], error: err.message || 'Network error fetching users' };
  }
}

export async function fetchAssignees(
  role?: string,
  currentUser?: { role?: string; email?: string }
): Promise<{ users: StaffUser[]; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const params = new URLSearchParams();
    if (role) params.append('role', role);

    const res = await fetch(`/api/users/assignees?${params.toString()}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      return { users: [], error: data.error || 'Failed to fetch assignees' };
    }
    return { users: data.users || [] };
  } catch (err: any) {
    return { users: [], error: err.message || 'Network error fetching assignees' };
  }
}

export async function inviteUser(
  payload: { email: string; fullName: string; role: UserRole },
  currentUser?: { role?: string; email?: string }
): Promise<{ user?: StaffUser; error?: string; message?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch('/api/users/invite', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || 'Failed to invite user' };
    }
    return {
      user: data.user,
      message:
        data.inviteMethod === 'email_invite'
          ? 'Invitation email dispatched via Supabase Admin.'
          : 'User account created and added to PMS database.',
    };
  } catch (err: any) {
    return { error: err.message || 'Network error inviting user' };
  }
}

export async function resetUserPassword(
  userId: string,
  userEmail: string,
  currentUser?: { role?: string; email?: string }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/users/${userId}/reset-password`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: userEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to trigger password reset' };
    }
    return { success: true, message: data.message || 'Password reset email triggered.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error triggering reset' };
  }
}

export async function updateUserRole(
  userId: string,
  role: UserRole,
  currentUser?: { role?: string; email?: string }
): Promise<{ success: boolean; user?: StaffUser; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/users/${userId}/role`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update user role' };
    }
    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating role' };
  }
}

export async function updateUserStatus(
  userId: string,
  isActive: boolean,
  currentUser?: { role?: string; email?: string }
): Promise<{ success: boolean; user?: StaffUser; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/users/${userId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ isActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update account status' };
    }
    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating status' };
  }
}

export async function deleteUser(
  userId: string,
  currentUser?: { role?: string; email?: string }
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to delete user' };
    }
    return { success: true, message: data.message || 'User deleted successfully' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error deleting user' };
  }
}

