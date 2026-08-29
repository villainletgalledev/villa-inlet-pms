import { supabase, isSupabaseConfigured } from '../supabase/client';
import { UserRole } from '../rbac';

export type InventoryCategory =
  | 'LINENS'
  | 'TOILETRIES'
  | 'CLEANING_SUPPLIES'
  | 'KITCHEN'
  | 'MAINTENANCE_SUPPLIES'
  | 'OTHER';

export type InventoryTransactionType = 'RESTOCK' | 'USAGE' | 'ADJUSTMENT';

export interface InventoryTransaction {
  id: string;
  itemId: string;
  type: InventoryTransactionType;
  quantity: number;
  relatedRoomId: string | null;
  performedByUserId: string | null;
  note: string | null;
  createdAt: string;
  relatedRoom?: {
    id: string;
    roomNumber: string;
    name: string;
  } | null;
  performedBy?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
  transactions?: InventoryTransaction[];
  _count?: {
    transactions: number;
  };
}

export interface InventorySummary {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoriesCount: number;
}

export const CATEGORY_CONFIG: Record<
  InventoryCategory,
  { label: string; bg: string; text: string; border: string; badge: string; description: string }
> = {
  LINENS: {
    label: 'Linens & Bedding',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200/80',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'Bed sheets, bath towels, pool cabana towels, and spa robes.',
  },
  TOILETRIES: {
    label: 'Toiletries & Amenities',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200/80',
    badge: 'bg-teal-100 text-teal-800 border-teal-200',
    description: 'Refillable shampoos, body wash, artisanal soaps, and dental kits.',
  },
  CLEANING_SUPPLIES: {
    label: 'Cleaning & Housekeeping',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200/80',
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    description: 'Disinfectants, microfiber packs, neutral floor wash, and glass cleaner.',
  },
  KITCHEN: {
    label: 'Kitchen & Minibar',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200/80',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Espresso pods, loose leaf teas, welcome baskets, and mineral waters.',
  },
  MAINTENANCE_SUPPLIES: {
    label: 'Maintenance & Repairs',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200/80',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    description: 'LED warm bulbs, split AC filters, plunge pool silicone, and repair hardware.',
  },
  OTHER: {
    label: 'General Supplies',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200/80',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    description: 'Stationery, umbrella sets, guest gift bags, and miscellaneous items.',
  },
};

export const TRANSACTION_TYPE_CONFIG: Record<
  InventoryTransactionType,
  { label: string; badge: string; sign: string; color: string }
> = {
  RESTOCK: {
    label: 'Restock (+)',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sign: '+',
    color: 'text-emerald-600',
  },
  USAGE: {
    label: 'Usage / Turnover (-)',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    sign: '',
    color: 'text-amber-600',
  },
  ADJUSTMENT: {
    label: 'Inventory Count Audit (±)',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    sign: '',
    color: 'text-purple-600',
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

export async function fetchInventory(
  params?: { category?: string; lowStockOnly?: boolean },
  currentUser?: { role?: string; email?: string }
): Promise<{ items: InventoryItem[]; summary?: InventorySummary; error?: string }> {
  try {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.lowStockOnly) query.set('lowStockOnly', 'true');

    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/inventory?${query.toString()}`, { headers });
    const data = await res.json();

    if (!res.ok) {
      return { items: [], error: data.error || 'Failed to fetch inventory' };
    }
    return { items: data.items || [], summary: data.summary };
  } catch (err: any) {
    return { items: [], error: err.message || 'Network error fetching inventory' };
  }
}

export async function fetchInventoryItem(
  id: string,
  currentUser?: { role?: string; email?: string }
): Promise<{ item?: InventoryItem; error?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/inventory/${id}`, { headers });
    const data = await res.json();

    if (!res.ok) {
      return { error: data.error || 'Failed to fetch item details' };
    }
    return { item: data.item };
  } catch (err: any) {
    return { error: err.message || 'Network error fetching item details' };
  }
}

export async function createInventoryItem(
  data: {
    name: string;
    category: InventoryCategory;
    unit: string;
    currentStock: number;
    lowStockThreshold: number;
    notes?: string;
  },
  currentUser?: { role?: string; email?: string }
): Promise<{ item?: InventoryItem; error?: string; success?: boolean }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    const result = await res.json();

    if (!res.ok) {
      return { success: false, error: result.error || 'Failed to create item' };
    }
    return { success: true, item: result.item };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error creating item' };
  }
}

export async function updateInventoryItem(
  id: string,
  data: {
    name?: string;
    category?: InventoryCategory;
    unit?: string;
    lowStockThreshold?: number;
    notes?: string | null;
  },
  currentUser?: { role?: string; email?: string }
): Promise<{ item?: InventoryItem; error?: string; success?: boolean }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/inventory/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    const result = await res.json();

    if (!res.ok) {
      return { success: false, error: result.error || 'Failed to update item' };
    }
    return { success: true, item: result.item };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating item' };
  }
}

export async function deleteInventoryItem(
  id: string,
  currentUser?: { role?: string; email?: string }
): Promise<{ error?: string; success?: boolean }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/inventory/${id}`, {
      method: 'DELETE',
      headers,
    });
    const result = await res.json();

    if (!res.ok) {
      return { success: false, error: result.error || 'Failed to delete item' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error deleting item' };
  }
}

export async function logInventoryTransaction(
  itemId: string,
  data: {
    type: InventoryTransactionType;
    quantity: number;
    relatedRoomId?: string;
    note?: string;
  },
  currentUser?: { role?: string; email?: string }
): Promise<{ item?: InventoryItem; transaction?: InventoryTransaction; error?: string; success?: boolean; message?: string }> {
  try {
    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/inventory/${itemId}/transaction`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    const result = await res.json();

    if (!res.ok) {
      return { success: false, error: result.error || 'Failed to log inventory transaction' };
    }
    return {
      success: true,
      item: result.item,
      transaction: result.transaction,
      message: result.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error logging transaction' };
  }
}
