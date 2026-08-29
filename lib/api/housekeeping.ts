import { Room } from './rooms';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import { UserRole } from '../rbac';

export type HousekeepingTaskType = 'CHECKOUT_CLEAN' | 'RECURRING_CLEAN' | 'DEEP_CLEAN' | 'OUTSOURCED';
export type HousekeepingTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';
export type ScheduleFrequency = 'WEEKLY' | 'MONTHLY' | 'SPECIFIC_DATE';

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface HousekeepingTask {
  id: string;
  roomId: string;
  assignedToUserId: string | null;
  bookingId: string | null;
  taskType: HousekeepingTaskType;
  status: HousekeepingTaskStatus;
  scheduledDate: string;
  completedAt: string | null;
  checklist: ChecklistItem[];
  isOutsourced: boolean;
  outsourcedVendorName: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  room: Room;
  assignedTo: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
}

export interface RecurringCleaningSchedule {
  id: string;
  roomId: string;
  frequency: ScheduleFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  specificDate: string | null;
  checklistTemplate: ChecklistItem[] | any[];
  isOutsourced: boolean;
  outsourcedVendorName: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  room: Room;
}

export const TASK_TYPE_CONFIG: Record<
  HousekeepingTaskType,
  { label: string; bg: string; text: string; border: string; dot: string; description: string }
> = {
  CHECKOUT_CLEAN: {
    label: 'Turnover Clean',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
    description: 'Full suite turnover following guest departure.',
  },
  RECURRING_CLEAN: {
    label: 'Daily Refresh',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200/80',
    dot: 'bg-indigo-500',
    description: 'Mid-stay linen & towel change, tidy, and surface wipe.',
  },
  DEEP_CLEAN: {
    label: 'Deep Clean',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200/80',
    dot: 'bg-purple-500',
    description: 'Comprehensive sanitization, mattress steaming & AC wash.',
  },
  OUTSOURCED: {
    label: 'Outsourced Vendor',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200/80',
    dot: 'bg-sky-500',
    description: 'Handled by external cleaning contractor.',
  },
};

export const TASK_STATUS_CONFIG: Record<
  HousekeepingTaskStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  PENDING: {
    label: 'Pending',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  DONE: {
    label: 'Completed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  SKIPPED: {
    label: 'Skipped',
    bg: 'bg-zinc-100',
    text: 'text-zinc-600',
    border: 'border-zinc-300',
    dot: 'bg-zinc-400',
  },
};

export const FREQUENCY_CONFIG: Record<ScheduleFrequency, { label: string; desc: string }> = {
  WEEKLY: { label: 'Weekly', desc: 'Runs every week on a designated day' },
  MONTHLY: { label: 'Monthly', desc: 'Runs once a month on a specific calendar day' },
  SPECIFIC_DATE: { label: 'Specific Date', desc: 'One-off scheduled deep clean on a custom date' },
};

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const DEFAULT_CHECKOUT_CHECKLIST: ChecklistItem[] = [
  { id: 'chk-1', label: 'Strip bed linens and replace with fresh laundered sheets & duvet', done: false },
  { id: 'chk-2', label: 'Replace bath towels, hand towels, and bathmats with fresh set', done: false },
  { id: 'chk-3', label: 'Sanitize bathroom vanity, shower glass, and toilet fixtures', done: false },
  { id: 'chk-4', label: 'Restock premium amenities (soaps, shampoo, lotion, dental kit)', done: false },
  { id: 'chk-5', label: 'Vacuum rugs and mop hardwood/tile flooring throughout suite', done: false },
  { id: 'chk-6', label: 'Wipe down all surfaces, nightstands, remotes, and switches', done: false },
  { id: 'chk-7', label: 'Restock minibar, espresso pods, and bottled spring water', done: false },
  { id: 'chk-8', label: 'Inspect plunge pool / terrace / balcony and wipe outdoor loungers', done: false },
  { id: 'chk-9', label: 'Final scent & ambiance check, set AC to 22°C (72°F) for welcome', done: false },
];

export const DEFAULT_RECURRING_CHECKLIST: ChecklistItem[] = [
  { id: 'rec-1', label: 'Daily bed making & decorative pillow staging', done: false },
  { id: 'rec-2', label: 'Tidy bathroom, empty trash receptacles, refresh towels as requested', done: false },
  { id: 'rec-3', label: 'Wipe bathroom counter & rinse sink', done: false },
  { id: 'rec-4', label: 'Replenish espresso pods, tea selection, and drinking water', done: false },
  { id: 'rec-5', label: 'Quick sweep of outdoor terrace and tidy loungers', done: false },
];

export const DEFAULT_DEEP_CLEAN_CHECKLIST: ChecklistItem[] = [
  { id: 'dp-1', label: 'Deep steam mattress, pillows, and upholstery', done: false },
  { id: 'dp-2', label: 'Descale shower heads, faucets, and Jacuzzi jets', done: false },
  { id: 'dp-3', label: 'Clean interior & exterior window panes and glass patio doors', done: false },
  { id: 'dp-4', label: 'Clean behind and underneath all heavy furniture & headboards', done: false },
  { id: 'dp-5', label: 'Wipe interior of all closets, drawers, luggage racks, and safe', done: false },
  { id: 'dp-6', label: 'Air conditioning filter wash and antimicrobial coil treatment', done: false },
  { id: 'dp-7', label: 'Deep grout scrubbing & natural stone sealant inspection', done: false },
];

/**
 * Builds request headers including auth token and user context
 */
async function getAuthHeaders(_currentUser?: { email?: string; role?: string; id?: string }) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (isSupabaseConfigured()) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch {
      // ignore
    }
  }

  return headers;
}

/**
 * Fetch all housekeeping tasks with optional filters
 */
export async function fetchHousekeepingTasks(
  filters: {
    roomId?: string;
    assignedToUserId?: string;
    status?: string;
    taskType?: string;
  } = {},
  currentUser?: { email?: string; role?: string; id?: string }
): Promise<{ tasks: HousekeepingTask[]; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (filters.roomId && filters.roomId !== 'ALL') params.append('roomId', filters.roomId);
    if (filters.assignedToUserId && filters.assignedToUserId !== 'ALL')
      params.append('assignedToUserId', filters.assignedToUserId);
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters.taskType && filters.taskType !== 'ALL') params.append('taskType', filters.taskType);

    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/housekeeping/tasks?${params.toString()}`, {
      headers,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return { tasks: data.tasks || [] };
  } catch (err: any) {
    console.error('fetchHousekeepingTasks error:', err);
    return { tasks: [], error: err?.message || 'Failed to fetch tasks' };
  }
}

/**
 * Create a new housekeeping task
 */
export async function createHousekeepingTask(
  taskData: Partial<HousekeepingTask>,
  currentUser?: { email?: string; role?: string; id?: string }
): Promise<{ task?: HousekeepingTask; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch('/api/housekeeping/tasks', {
      method: 'POST',
      headers,
      body: JSON.stringify(taskData),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create task');
    }

    return { task: data.task };
  } catch (err: any) {
    console.error('createHousekeepingTask error:', err);
    return { error: err?.message || 'Failed to create task' };
  }
}

/**
 * Update an existing housekeeping task
 */
export async function updateHousekeepingTask(
  id: string,
  updates: Partial<HousekeepingTask> & { forceDone?: boolean },
  currentUser?: { email?: string; role?: string; id?: string }
): Promise<{ task?: HousekeepingTask; error?: string; requiresAllChecked?: boolean }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/housekeeping/tasks/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        error: data.error || 'Failed to update task',
        requiresAllChecked: data.requiresAllChecked,
      };
    }

    return { task: data.task };
  } catch (err: any) {
    console.error('updateHousekeepingTask error:', err);
    return { error: err?.message || 'Failed to update task' };
  }
}

/**
 * Delete a housekeeping task
 */
export async function deleteHousekeepingTask(
  id: string,
  currentUser?: { email?: string; role?: string; id?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/housekeeping/tasks/${id}`, {
      method: 'DELETE',
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete task');
    }

    return { success: true };
  } catch (err: any) {
    console.error('deleteHousekeepingTask error:', err);
    return { success: false, error: err?.message || 'Failed to delete task' };
  }
}

/**
 * Fetch recurring cleaning schedules
 */
export async function fetchRecurringSchedules(
  currentUser?: { email?: string; role?: string; id?: string }
): Promise<{ schedules: RecurringCleaningSchedule[]; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch('/api/housekeeping/schedules', { headers });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return { schedules: data.schedules || [] };
  } catch (err: any) {
    console.error('fetchRecurringSchedules error:', err);
    return { schedules: [], error: err?.message || 'Failed to fetch schedules' };
  }
}

/**
 * Create a recurring cleaning schedule
 */
export async function createRecurringSchedule(
  scheduleData: Partial<RecurringCleaningSchedule>,
  currentUser?: { email?: string; role?: string; id?: string }
): Promise<{ schedule?: RecurringCleaningSchedule; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch('/api/housekeeping/schedules', {
      method: 'POST',
      headers,
      body: JSON.stringify(scheduleData),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create schedule');
    }

    return { schedule: data.schedule };
  } catch (err: any) {
    console.error('createRecurringSchedule error:', err);
    return { error: err?.message || 'Failed to create schedule' };
  }
}

/**
 * Update recurring schedule
 */
export async function updateRecurringSchedule(
  id: string,
  updates: Partial<RecurringCleaningSchedule>,
  currentUser?: { email?: string; role?: string; id?: string }
): Promise<{ schedule?: RecurringCleaningSchedule; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/housekeeping/schedules/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update schedule');
    }

    return { schedule: data.schedule };
  } catch (err: any) {
    console.error('updateRecurringSchedule error:', err);
    return { error: err?.message || 'Failed to update schedule' };
  }
}

/**
 * Delete recurring schedule
 */
export async function deleteRecurringSchedule(
  id: string,
  currentUser?: { email?: string; role?: string; id?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/housekeeping/schedules/${id}`, {
      method: 'DELETE',
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete schedule');
    }

    return { success: true };
  } catch (err: any) {
    console.error('deleteRecurringSchedule error:', err);
    return { success: false, error: err?.message || 'Failed to delete schedule' };
  }
}

/**
 * Trigger housekeeping generation cycle
 */
export async function triggerHousekeepingGeneration(
  currentUser?: { email?: string; role?: string; id?: string }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch('/api/housekeeping/generate', {
      method: 'POST',
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to run generation cycle');
    }

    return { success: true, message: data.message };
  } catch (err: any) {
    console.error('triggerHousekeepingGeneration error:', err);
    return { success: false, error: err?.message || 'Failed generation' };
  }
}
