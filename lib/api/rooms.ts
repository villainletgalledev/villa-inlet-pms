import { supabase, isSupabaseConfigured } from '../supabase/client';
import { UserRole } from '../rbac';

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE';

export interface Room {
  id: string;
  name: string;
  roomNumber: string;
  maxOccupancy: number;
  basePrice: number | string;
  amenities: string[];
  description: string;
  imageUrls: string[];
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
}

export const ROOM_STATUS_CONFIG: Record<
  RoomStatus,
  { label: string; bg: string; text: string; border: string; dot: string; description: string }
> = {
  AVAILABLE: {
    label: 'Available',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
    description: 'Cleaned, inspected, and ready for guest check-in.',
  },
  OCCUPIED: {
    label: 'Occupied',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200/80',
    dot: 'bg-indigo-500',
    description: 'Guests currently residing in this suite.',
  },
  CLEANING: {
    label: 'Housekeeping',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
    description: 'Turnover cleaning & linen refresh in progress.',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200/80',
    dot: 'bg-rose-500',
    description: 'Work order or routine servicing in progress.',
  },
};

export const COMMON_AMENITY_PRESETS = [
  'King Bed',
  'Queen Bed',
  'Ocean View',
  'Sunset View',
  'Botanical Garden View',
  'Courtyard View',
  'Private Plunge Pool',
  'En-suite Jacuzzi',
  'Outdoor Stone Bathtub',
  'Rain Shower',
  'Private Terrace',
  'Balcony',
  'High-speed Wi-Fi',
  'Espresso Machine',
  'Mini Bar',
  'Smart TV',
  'Air Conditioning',
  'Work Desk',
  'In-room Safe',
  'Kitchenette',
  'Walk-in Closet',
  'Lounge Seating',
  'Family Friendly',
];

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

export async function fetchRooms(currentUser?: { role?: string; email?: string }): Promise<{ rooms: Room[]; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch('/api/rooms', { headers });
    const data = await res.json();
    if (!res.ok) {
      return { rooms: [], error: data.error || 'Failed to fetch rooms' };
    }
    return { rooms: data.rooms || [] };
  } catch (err: any) {
    return { rooms: [], error: err.message || 'Network error fetching rooms' };
  }
}

export async function fetchRoomById(
  id: string,
  currentUser?: { role?: string; email?: string }
): Promise<{ room?: Room; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/rooms/${id}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || 'Failed to fetch room details' };
    }
    return { room: data.room };
  } catch (err: any) {
    return { error: err.message || 'Network error fetching room' };
  }
}

export async function updateRoom(
  id: string,
  payload: Partial<Room>,
  currentUser?: { role?: string; email?: string }
): Promise<{ room?: Room; error?: string; success?: boolean }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/rooms/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update room details' };
    }
    return { success: true, room: data.room };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating room' };
  }
}

export async function updateRoomStatus(
  id: string,
  status: RoomStatus,
  currentUser?: { role?: string; email?: string }
): Promise<{ room?: Room; error?: string; success?: boolean }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/rooms/${id}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update room status' };
    }
    return { success: true, room: data.room };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating room status' };
  }
}

export async function uploadRoomPhoto(
  file: File,
  currentUser?: { role?: string; email?: string }
): Promise<{ url?: string; error?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const headers = await getAuthHeaders(currentUser);
        const res = await fetch('/api/rooms/upload-photo', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            fileName: file.name,
            fileBase64: base64,
            contentType: file.type,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          resolve({ error: data.error || 'Upload failed' });
        } else {
          resolve({ url: data.url });
        }
      } catch (err: any) {
        resolve({ error: err.message || 'Error uploading file' });
      }
    };
    reader.onerror = () => {
      resolve({ error: 'Failed to read image file' });
    };
    reader.readAsDataURL(file);
  });
}
