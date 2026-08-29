import { supabase, isSupabaseConfigured } from '../supabase/client';
import { UserRole } from '../rbac';

export type BookingStatus = 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'COMPLETED';
export type BookingSource = 'DIRECT' | 'AIRBNB' | 'BOOKING_COM' | 'OTHER';

export interface Booking {
  id: string;
  roomId: string;
  room?: {
    id: string;
    name: string;
    roomNumber: string;
    basePrice: number | string;
    status: string;
    maxOccupancy: number;
  };
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  totalAmount: number | string;
  amountPaid: number | string;
  status: BookingStatus;
  source: BookingSource;
  notes: string;
  checkedOutAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const BOOKING_STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; bg: string; text: string; border: string; barBg: string; barText: string; dot: string }
> = {
  CONFIRMED: {
    label: 'Confirmed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    barBg: 'bg-emerald-600 hover:bg-emerald-500',
    barText: 'text-white',
    dot: 'bg-emerald-500',
  },
  PENDING: {
    label: 'Pending Deposit',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    barBg: 'bg-amber-500 hover:bg-amber-400',
    barText: 'text-amber-950 font-bold',
    dot: 'bg-amber-500',
  },
  COMPLETED: {
    label: 'Checked Out',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    barBg: 'bg-slate-600 hover:bg-slate-500',
    barText: 'text-white',
    dot: 'bg-slate-400',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    barBg: 'bg-rose-500/80 line-through hover:bg-rose-500',
    barText: 'text-white/90',
    dot: 'bg-rose-500',
  },
};

export const BOOKING_SOURCE_CONFIG: Record<
  BookingSource,
  { label: string; bg: string; text: string; border: string }
> = {
  DIRECT: {
    label: 'Direct Booking',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
  },
  AIRBNB: {
    label: 'Airbnb',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  BOOKING_COM: {
    label: 'Booking.com',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  OTHER: {
    label: 'Travel Agent / Other',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
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

export async function fetchBookings(
  params: {
    startDate?: string;
    endDate?: string;
    roomId?: string;
    status?: string;
    source?: string;
    search?: string;
  } = {},
  currentUser?: { role?: string; email?: string }
): Promise<{ bookings: Booking[]; error?: string }> {
  try {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.roomId) query.set('roomId', params.roomId);
    if (params.status) query.set('status', params.status);
    if (params.source) query.set('source', params.source);
    if (params.search) query.set('search', params.search);

    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/bookings?${query.toString()}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      return { bookings: [], error: data.error || 'Failed to fetch bookings' };
    }
    return { bookings: data.bookings || [] };
  } catch (err: any) {
    return { bookings: [], error: err.message || 'Network error fetching reservations' };
  }
}

export async function createBooking(
  payload: {
    roomId: string;
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
    checkIn: string;
    checkOut: string;
    numGuests: number;
    totalAmount: number;
    amountPaid?: number;
    status?: BookingStatus;
    source?: BookingSource;
    notes?: string;
  },
  currentUser?: { role?: string; email?: string }
): Promise<{ booking?: Booking; error?: string; success?: boolean }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to create booking' };
    }
    return { success: true, booking: data.booking };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error creating booking' };
  }
}

export async function updateBooking(
  id: string,
  payload: Partial<Booking>,
  currentUser?: { role?: string; email?: string }
): Promise<{ booking?: Booking; error?: string; success?: boolean }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update booking' };
    }
    return { success: true, booking: data.booking };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating booking' };
  }
}

export async function deleteBooking(
  id: string,
  currentUser?: { role?: string; email?: string }
): Promise<{ error?: string; success?: boolean }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/bookings/${id}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to delete booking' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error deleting booking' };
  }
}
