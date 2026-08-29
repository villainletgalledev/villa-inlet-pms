import { supabase, isSupabaseConfigured } from '../supabase/client';

export interface Room {
  id: string;
  name: string;
  roomNumber: string;
}

export interface ExternalCalendarFeed {
  id: string;
  source: 'AIRBNB' | 'BOOKING_COM' | 'OTHER';
  label: string;
  feedUrl: string | null;
  roomId: string | null;
  room?: Room | null;
  lastSyncedAt: string | null;
  lastSyncStatus: 'NEVER_SYNCED' | 'SUCCESS' | 'FAILED';
  lastSyncError: string | null;
  isActive: boolean;
  _count?: {
    bookings: number;
    conflicts: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SyncConflict {
  id: string;
  feedId: string;
  externalUid: string;
  roomId: string | null;
  conflictingBookingId: string | null;
  summary: string;
  checkIn: string;
  checkOut: string;
  resolved: boolean;
  createdAt: string;
  feed?: {
    label: string;
    source: string;
  };
  room?: {
    name: string;
    roomNumber: string;
  };
  conflictingBooking?: {
    id: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
  };
}

export interface ICalInfo {
  baseUrl: string;
  feedSecret: string;
  feedUrl: string;
  isCustomSecretConfigured: boolean;
  cronSchedule: string;
}

export async function getAuthHeaders(): Promise<HeadersInit> {
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
