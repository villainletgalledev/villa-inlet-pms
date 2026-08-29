import { supabase, isSupabaseConfigured } from '../supabase/client';
import { UserRole } from '../rbac';

export type MaintenanceCategory =
  | 'ELECTRICAL'
  | 'PLUMBING'
  | 'AC'
  | 'POOL'
  | 'APPLIANCE'
  | 'STRUCTURAL'
  | 'OTHER';

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type MaintenanceStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CANNOT_FIX';

export interface MaintenanceIssue {
  id: string;
  roomId: string | null;
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assignedToUserId: string | null;
  reportedByUserId: string;
  photoUrls: string[];
  resolutionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  isAging?: boolean;
  ageDays?: number;
  room?: {
    id: string;
    roomNumber: string;
    name: string;
    status: string;
  } | null;
  assignedTo?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
  reportedBy?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
}

export interface MaintenanceSummary {
  totalIssues: number;
  openIssues: number;
  urgentIssues: number;
  agingIssues: number;
  resolvedIssues: number;
}

export interface TechnicianUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export const CATEGORY_CONFIG: Record<
  MaintenanceCategory,
  { label: string; bg: string; text: string; border: string; badge: string; description: string }
> = {
  AC: {
    label: 'HVAC & Air Conditioning',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200/80',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    description: 'Split inverter AC units, condensation drains, thermostats, and chiller units.',
  },
  POOL: {
    label: 'Pool & Plunge Spa',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200/80',
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    description: 'Saltwater chlorinators, filtration sand pumps, pool heaters, and underwater lighting.',
  },
  ELECTRICAL: {
    label: 'Electrical & Lighting',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200/80',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Pathway bollards, switchboards, generators, surge protectors, and GFCI circuits.',
  },
  PLUMBING: {
    label: 'Plumbing & Water',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200/80',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Rain showers, solar water heaters, pressure booster pumps, and outdoor soak tubs.',
  },
  APPLIANCE: {
    label: 'Appliances & Minibar',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200/80',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'Espresso machines, wine chillers, smart TVs, microwave ovens, and hair dryers.',
  },
  STRUCTURAL: {
    label: 'Structural & Carpentry',
    bg: 'bg-stone-50',
    text: 'text-stone-700',
    border: 'border-stone-200/80',
    badge: 'bg-stone-100 text-stone-800 border-stone-200',
    description: 'Teak decking, sliding doors, locks, thatch roofing, and oceanfront pergolas.',
  },
  OTHER: {
    label: 'General Maintenance',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200/80',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    description: 'Paint touch-ups, pest barriers, gate hardware, and grounds maintenance.',
  },
};

export const PRIORITY_CONFIG: Record<
  MaintenancePriority,
  { label: string; badge: string; dot: string; border: string; weight: number }
> = {
  URGENT: {
    label: 'Urgent',
    badge: 'bg-rose-100 text-rose-800 border-rose-200 font-bold',
    dot: 'bg-rose-600 animate-ping',
    border: 'border-rose-300 bg-rose-50/30',
    weight: 4,
  },
  HIGH: {
    label: 'High Priority',
    badge: 'bg-amber-100 text-amber-900 border-amber-200 font-bold',
    dot: 'bg-amber-500',
    border: 'border-amber-300 bg-amber-50/20',
    weight: 3,
  },
  MEDIUM: {
    label: 'Medium Priority',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold',
    dot: 'bg-indigo-500',
    border: 'border-slate-200',
    weight: 2,
  },
  LOW: {
    label: 'Low Priority',
    badge: 'bg-slate-100 text-slate-700 border-slate-200 font-medium',
    dot: 'bg-slate-400',
    border: 'border-slate-200',
    weight: 1,
  },
};

export const STATUS_CONFIG: Record<
  MaintenanceStatus,
  { label: string; badge: string; step: number; color: string }
> = {
  OPEN: {
    label: 'Open / Unassigned',
    badge: 'bg-slate-100 text-slate-800 border-slate-300',
    step: 1,
    color: 'text-slate-600',
  },
  ASSIGNED: {
    label: 'Assigned to Tech',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    step: 2,
    color: 'text-blue-600',
  },
  IN_PROGRESS: {
    label: 'In Progress / Servicing',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    step: 3,
    color: 'text-amber-600',
  },
  RESOLVED: {
    label: 'Resolved & Tested',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    step: 4,
    color: 'text-emerald-600',
  },
  CANNOT_FIX: {
    label: 'Cannot Fix / Escalated',
    badge: 'bg-rose-100 text-rose-800 border-rose-300',
    step: 4,
    color: 'text-rose-600',
  },
};

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

export async function fetchMaintenanceIssues(
  params?: {
    status?: string;
    priority?: string;
    category?: string;
    roomId?: string;
    assignedToUserId?: string;
    agingOnly?: boolean;
  },
  currentUser?: { role?: string; email?: string }
): Promise<{
  issues: MaintenanceIssue[];
  summary?: MaintenanceSummary;
  technicians?: TechnicianUser[];
  error?: string;
}> {
  try {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.category) query.set('category', params.category);
    if (params?.roomId) query.set('roomId', params.roomId);
    if (params?.assignedToUserId) query.set('assignedToUserId', params.assignedToUserId);
    if (params?.agingOnly) query.set('agingOnly', 'true');

    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/maintenance?${query.toString()}`, { headers });
    const data = await res.json();

    if (!res.ok) {
      return { issues: [], error: data.error || 'Failed to fetch maintenance issues' };
    }
    return {
      issues: data.issues || [],
      summary: data.summary,
      technicians: data.technicians || [],
    };
  } catch (err: any) {
    return { issues: [], error: err.message || 'Network error fetching maintenance issues' };
  }
}

export async function fetchMaintenanceIssue(
  id: string,
  currentUser?: { role?: string; email?: string }
): Promise<{ issue?: MaintenanceIssue; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/maintenance/${id}`, { headers });
    const data = await res.json();

    if (!res.ok) {
      return { error: data.error || 'Failed to fetch maintenance ticket' };
    }
    return { issue: data.issue };
  } catch (err: any) {
    return { error: err.message || 'Network error fetching maintenance ticket' };
  }
}

export async function createMaintenanceIssue(
  data: {
    title: string;
    description: string;
    category: MaintenanceCategory;
    priority: MaintenancePriority;
    roomId?: string | null;
    photoUrls?: string[];
  },
  currentUser?: { role?: string; email?: string }
): Promise<{ issue?: MaintenanceIssue; error?: string; success?: boolean; message?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch('/api/maintenance', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    const result = await res.json();

    if (!res.ok) {
      return { success: false, error: result.error || 'Failed to report maintenance issue' };
    }
    return { success: true, issue: result.issue, message: result.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error reporting issue' };
  }
}

export async function assignMaintenanceIssue(
  id: string,
  assignedToUserId: string | null,
  currentUser?: { role?: string; email?: string }
): Promise<{ issue?: MaintenanceIssue; error?: string; success?: boolean; message?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/maintenance/${id}/assign`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ assignedToUserId }),
    });
    const result = await res.json();

    if (!res.ok) {
      return { success: false, error: result.error || 'Failed to assign technician' };
    }
    return { success: true, issue: result.issue, message: result.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error assigning ticket' };
  }
}

export async function updateMaintenanceStatus(
  id: string,
  data: {
    status: MaintenanceStatus;
    resolutionNotes?: string;
  },
  currentUser?: { role?: string; email?: string }
): Promise<{ issue?: MaintenanceIssue; error?: string; success?: boolean; message?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/maintenance/${id}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
    const result = await res.json();

    if (!res.ok) {
      return { success: false, error: result.error || 'Failed to update ticket status' };
    }
    return { success: true, issue: result.issue, message: result.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating status' };
  }
}

export async function updateMaintenanceIssue(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    category: MaintenanceCategory;
    priority: MaintenancePriority;
    status: MaintenanceStatus;
    roomId: string | null;
    assignedToUserId: string | null;
    photoUrls: string[];
    resolutionNotes: string | null;
  }>,
  currentUser?: { role?: string; email?: string }
): Promise<{ issue?: MaintenanceIssue; error?: string; success?: boolean; message?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/maintenance/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    const result = await res.json();

    if (!res.ok) {
      return { success: false, error: result.error || 'Failed to update maintenance ticket' };
    }
    return { success: true, issue: result.issue, message: result.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating ticket' };
  }
}

export async function deleteMaintenanceIssue(
  id: string,
  currentUser?: { role?: string; email?: string }
): Promise<{ error?: string; success?: boolean }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/maintenance/${id}`, {
      method: 'DELETE',
      headers,
    });
    const result = await res.json();

    if (!res.ok) {
      return { success: false, error: result.error || 'Failed to delete maintenance ticket' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error deleting ticket' };
  }
}
