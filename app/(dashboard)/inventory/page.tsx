import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  AlertTriangle,
  Plus,
  ArrowUpDown,
  Search,
  Filter,
  PackagePlus,
  PackageMinus,
  History,
  RotateCcw,
  Sparkles,
  BedDouble,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Pencil,
  Trash2,
  X,
  Building,
  UserCheck,
  Clock,
  Layers,
  ChevronRight,
  TrendingDown,
  Info,
  Lock,
} from 'lucide-react';
import {
  InventoryItem,
  InventoryTransaction,
  InventoryCategory,
  InventoryTransactionType,
  CATEGORY_CONFIG,
  TRANSACTION_TYPE_CONFIG,
  fetchInventory,
  fetchInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  logInventoryTransaction,
  InventorySummary,
} from '../../../lib/api/inventory';
import { Room, fetchRooms } from '../../../lib/api/rooms';
import { isOwnerOrManager, UserRole, ROLE_LABELS } from '../../../lib/rbac';
import { cn } from '../../../lib/utils';

interface InventoryPageProps {
  currentUser?: {
    id?: string;
    email: string;
    fullName: string;
    role: UserRole | string;
  };
}

export default function InventoryPage({
  currentUser = { email: 'manager@villainlet.com', fullName: 'Villa Manager', role: 'MANAGER' },
}: InventoryPageProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({
    totalItems: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    categoriesCount: 0,
  });
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');

  // Modals state
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Form states
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    category: 'LINENS' as InventoryCategory,
    unit: 'pcs',
    currentStock: 10,
    lowStockThreshold: 5,
    notes: '',
  });

  const [editItemForm, setEditItemForm] = useState({
    name: '',
    category: 'LINENS' as InventoryCategory,
    unit: 'pcs',
    lowStockThreshold: 5,
    notes: '',
  });

  const [transactionForm, setTransactionForm] = useState({
    itemId: '',
    type: 'USAGE' as InventoryTransactionType,
    quantity: 1,
    relatedRoomId: '',
    note: '',
  });

  // Action status state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const canManageItems = isOwnerOrManager(currentUser.role);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load Inventory data and Room options
  const loadData = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const [invRes, roomsRes] = await Promise.all([
        fetchInventory({}, currentUser),
        fetchRooms(currentUser),
      ]);

      if (invRes.items) {
        setItems(invRes.items);
      }
      if (invRes.summary) {
        setSummary(invRes.summary);
      }
      if (roomsRes.rooms) {
        setRooms(roomsRes.rooms);
      }
    } catch (err: any) {
      console.error('Failed to load inventory:', err);
      setActionError(err.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered items computation
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }
      // Stock status filter
      if (stockFilter === 'LOW' && !(item.currentStock <= item.lowStockThreshold)) {
        return false;
      }
      if (stockFilter === 'OUT' && item.currentStock !== 0) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesNotes = item.notes ? item.notes.toLowerCase().includes(q) : false;
        const matchesCat = CATEGORY_CONFIG[item.category]?.label.toLowerCase().includes(q);
        return matchesName || matchesNotes || matchesCat;
      }
      return true;
    });
  }, [items, selectedCategory, stockFilter, searchQuery]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const map = new Map<InventoryCategory, InventoryItem[]>();
    for (const item of filteredItems) {
      if (!map.has(item.category)) {
        map.set(item.category, []);
      }
      map.get(item.category)!.push(item);
    }
    return map;
  }, [filteredItems]);

  // Low stock list for alert banner
  const lowStockItems = useMemo(() => {
    return items.filter((item) => item.currentStock <= item.lowStockThreshold);
  }, [items]);

  // Open Log Transaction Modal for a specific item
  const handleOpenTransaction = (item: InventoryItem, initialType: InventoryTransactionType = 'USAGE') => {
    setSelectedItem(item);
    setTransactionForm({
      itemId: item.id,
      type: initialType,
      quantity: 1,
      relatedRoomId: rooms.length > 0 ? rooms[0].id : '',
      note: initialType === 'USAGE' ? `Housekeeping turnover for ${item.name}` : `Restock delivery for ${item.name}`,
    });
    setActionError(null);
    setIsTransactionModalOpen(true);
  };

  // Open Item Detail & Audit Trail Modal
  const handleOpenDetail = async (item: InventoryItem) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
    setActionError(null);
    try {
      const res = await fetchInventoryItem(item.id, currentUser);
      if (res.item) {
        setSelectedItem(res.item);
      }
    } catch (err) {
      console.warn('Could not fetch latest item audit:', err);
    }
  };

  // Open Edit Item Modal
  const handleOpenEdit = (item: InventoryItem) => {
    if (!canManageItems) return;
    setSelectedItem(item);
    setEditItemForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      lowStockThreshold: item.lowStockThreshold,
      notes: item.notes || '',
    });
    setActionError(null);
    setIsEditItemModalOpen(true);
  };

  // Submit New Item
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageItems) {
      setActionError('Permission denied: Only Owners and Managers can create items.');
      return;
    }
    if (!newItemForm.name.trim()) {
      setActionError('Item name is required.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await createInventoryItem(newItemForm, currentUser);
      if (res.success && res.item) {
        showToast(`Created inventory item: ${res.item.name}`, 'success');
        setIsNewItemModalOpen(false);
        setNewItemForm({
          name: '',
          category: 'LINENS',
          unit: 'pcs',
          currentStock: 10,
          lowStockThreshold: 5,
          notes: '',
        });
        await loadData();
      } else {
        setActionError(res.error || 'Failed to create item.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error creating item.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Edit Item
  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !canManageItems) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await updateInventoryItem(selectedItem.id, editItemForm, currentUser);
      if (res.success && res.item) {
        showToast(`Updated: ${res.item.name}`, 'success');
        setIsEditItemModalOpen(false);
        await loadData();
      } else {
        setActionError(res.error || 'Failed to update item.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error updating item.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Delete Item
  const handleDeleteItem = async (item: InventoryItem) => {
    if (!canManageItems) return;
    if (!window.confirm(`Are you sure you want to delete "${item.name}" and its full audit trail?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await deleteInventoryItem(item.id, currentUser);
      if (res.success) {
        showToast(`Deleted ${item.name}`, 'success');
        setIsDetailModalOpen(false);
        await loadData();
      } else {
        showToast(res.error || 'Failed to delete item', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting item', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Log Transaction
  const handleLogTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionForm.itemId) {
      setActionError('Please select an item.');
      return;
    }

    const qty = parseInt(String(transactionForm.quantity), 10);
    if (isNaN(qty) || qty <= 0) {
      setActionError('Quantity must be a positive number greater than 0.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await logInventoryTransaction(
        transactionForm.itemId,
        {
          type: transactionForm.type,
          quantity: qty,
          relatedRoomId: transactionForm.relatedRoomId || undefined,
          note: transactionForm.note || undefined,
        },
        currentUser
      );

      if (res.success && res.item) {
        showToast(
          `${transactionForm.type === 'RESTOCK' ? 'Restocked' : 'Logged usage for'} ${res.item.name}. New balance: ${res.item.currentStock} ${res.item.unit}`,
          'success'
        );
        setIsTransactionModalOpen(false);
        await loadData();
        if (selectedItem && selectedItem.id === res.item.id) {
          setSelectedItem(res.item);
        }
      } else {
        setActionError(res.error || 'Transaction failed.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error logging transaction.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="inventory-toast"
          className={cn(
            'fixed top-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2',
            toastMessage.type === 'success'
              ? 'bg-slate-900 border-slate-800 text-white'
              : 'bg-rose-950 border-rose-800 text-rose-100'
          )}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-medium">{toastMessage.message}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory & Amenities</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active PMS Module
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track linens, guest luxury toiletries, minibar items, housekeeping supplies, and restock logs for Villa Inlet.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="btn-quick-transaction"
            type="button"
            onClick={() => {
              if (items.length > 0) {
                handleOpenTransaction(items[0], 'USAGE');
              }
            }}
            disabled={items.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
            <span>Log Transaction</span>
          </button>

          {canManageItems ? (
            <button
              id="btn-add-inventory-item"
              type="button"
              onClick={() => {
                setActionError(null);
                setIsNewItemModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Supply Item</span>
            </button>
          ) : (
            <div
              title="Only Owners and Managers can define new inventory items. Staff & Housekeeping can log usage/restock transactions."
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 text-xs font-medium cursor-not-allowed"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Add Item (Manager only)</span>
            </div>
          )}
        </div>
      </div>

      {/* Low-Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <div
          id="low-stock-banner"
          className="bg-amber-50 border border-amber-200/90 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Low Stock Attention Required ({lowStockItems.length}{' '}
                  {lowStockItems.length === 1 ? 'item' : 'items'})
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                  Threshold Alert
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                The following villa supplies have fallen to or below critical threshold levels:{' '}
                <span className="font-semibold">
                  {lowStockItems.map((i) => `${i.name} (${i.currentStock}/${i.lowStockThreshold} ${i.unit})`).join(' · ')}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              id="btn-filter-low-stock-banner"
              type="button"
              onClick={() => setStockFilter(stockFilter === 'LOW' ? 'ALL' : 'LOW')}
              className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold transition-colors cursor-pointer border border-amber-300/80"
            >
              {stockFilter === 'LOW' ? 'View All Items' : 'Filter Low Stock'}
            </button>
            <button
              id="btn-restock-first-low"
              type="button"
              onClick={() => handleOpenTransaction(lowStockItems[0], 'RESTOCK')}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              Quick Restock
            </button>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Tracked Items</span>
            <Boxes className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{summary.totalItems}</div>
          <div className="text-[11px] text-slate-500 mt-1">Across 6 luxury categories</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Low Stock Warning</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-2xl font-bold', summary.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900')}>
              {summary.lowStockCount}
            </span>
            {summary.lowStockCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                Action Needed
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">At or below threshold</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Out of Stock (0)</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-2xl font-bold', summary.outOfStockCount > 0 ? 'text-rose-600' : 'text-slate-900')}>
              {summary.outOfStockCount}
            </span>
            {summary.outOfStockCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                Depleted
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Zero balance items</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Active Categories</span>
            <Layers className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{summary.categoriesCount || 6}</div>
          <div className="text-[11px] text-slate-500 mt-1">Linens, toiletries, kitchen, etc.</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-2xs space-y-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            id="cat-tab-ALL"
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={cn(
              'px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer',
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            All Categories ({items.length})
          </button>
          {(Object.keys(CATEGORY_CONFIG) as InventoryCategory[]).map((cat) => {
            const count = items.filter((i) => i.category === cat).length;
            const hasLowInCat = items.some((i) => i.category === cat && i.currentStock <= i.lowStockThreshold);
            return (
              <button
                key={cat}
                id={`cat-tab-${cat}`}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer',
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <span>{CATEGORY_CONFIG[cat].label}</span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded font-mono',
                    selectedCategory === cat ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {count}
                </span>
                {hasLowInCat && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Low stock in category" />
                )}
              </button>
            );
          })}
        </div>

        {/* Search and Secondary Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-inventory-search"
              type="text"
              placeholder="Search items by name, specification, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium shrink-0">Stock State:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
              <button
                type="button"
                onClick={() => setStockFilter('ALL')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer',
                  stockFilter === 'ALL' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('LOW')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1',
                  stockFilter === 'LOW' ? 'bg-amber-100 text-amber-900 font-semibold' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                <span>Low Stock</span>
                {summary.lowStockCount > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('OUT')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer',
                  stockFilter === 'OUT' ? 'bg-rose-100 text-rose-900 font-semibold' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                Out of Stock
              </button>
            </div>

            <button
              type="button"
              onClick={loadData}
              title="Refresh inventory"
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors"
            >
              <RotateCcw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Items Display */}
      {loading && items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-2xs">
          <RotateCcw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">Loading Villa Inlet Inventory...</h3>
          <p className="text-xs text-slate-500 mt-1">Connecting to database stock registers and audit logs.</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-2xs">
          <Boxes className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">No inventory items match your criteria</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search keywords, clearing stock filters, or adding a new supply item.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('ALL');
              setStockFilter('ALL');
              setSearchQuery('');
            }}
            className="mt-4 px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedItems.entries()).map(([cat, catItems]) => {
            const catConfig = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.OTHER;
            return (
              <div key={cat} className="space-y-3">
                {/* Category Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2.5 h-2.5 rounded-full', catConfig.bg.replace('50', '500'))} />
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">{catConfig.label}</h2>
                    <span className="text-xs font-mono text-slate-400">({catItems.length})</span>
                  </div>
                  <span className="text-[11px] text-slate-500 hidden sm:inline">{catConfig.description}</span>
                </div>

                {/* Items Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {catItems.map((item) => {
                    const isLow = item.currentStock <= item.lowStockThreshold;
                    const isOut = item.currentStock === 0;
                    const stockRatio = item.lowStockThreshold > 0 ? (item.currentStock / item.lowStockThreshold) * 100 : 100;
                    const progressPercent = Math.min(100, Math.max(0, stockRatio));

                    return (
                      <div
                        key={item.id}
                        id={`inventory-card-${item.id}`}
                        className={cn(
                          'bg-white border rounded-xl p-4 shadow-2xs transition-all flex flex-col justify-between hover:border-slate-300 relative',
                          isOut
                            ? 'border-rose-300/80 bg-rose-50/20'
                            : isLow
                            ? 'border-amber-300/80 bg-amber-50/20'
                            : 'border-slate-200'
                        )}
                      >
                        {/* Status Flag */}
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div>
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', catConfig.badge)}>
                              {catConfig.label.split('&')[0].trim()}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900 mt-1.5 line-clamp-1">{item.name}</h3>
                          </div>

                          {isOut ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0 animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Adequate
                            </span>
                          )}
                        </div>

                        {/* Description / Notes */}
                        {item.notes && (
                          <p className="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed">
                            {item.notes}
                          </p>
                        )}

                        {/* Stock Level Gauge */}
                        <div className="mt-2 pt-3 border-t border-slate-100 space-y-1.5">
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="text-slate-500 font-medium">Available Balance:</span>
                            <div className="font-mono">
                              <span className={cn('text-base font-bold', isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900')}>
                                {item.currentStock}
                              </span>
                              <span className="text-xs text-slate-500 ml-1">{item.unit}</span>
                              <span className="text-[11px] text-slate-400 ml-1.5 font-sans">
                                (Alert: &le;{item.lowStockThreshold})
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full transition-all duration-300 rounded-full',
                                isOut ? 'bg-rose-500 w-0' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                              )}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              id={`btn-usage-${item.id}`}
                              type="button"
                              onClick={() => handleOpenTransaction(item, 'USAGE')}
                              title="Log room usage/turnover"
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <PackageMinus className="w-3.5 h-3.5 text-amber-600" />
                              <span>Use</span>
                            </button>
                            <button
                              id={`btn-restock-${item.id}`}
                              type="button"
                              onClick={() => handleOpenTransaction(item, 'RESTOCK')}
                              title="Log delivery restock"
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors flex items-center gap-1 border border-emerald-200 cursor-pointer"
                            >
                              <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Restock</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              id={`btn-detail-${item.id}`}
                              type="button"
                              onClick={() => handleOpenDetail(item)}
                              title="View audit trail & transaction history"
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            {canManageItems && (
                              <button
                                id={`btn-edit-${item.id}`}
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                title="Edit item definition & threshold"
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Log Transaction (Usage / Restock / Count Adjustment) */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-2xl max-w-lg w-full flex flex-col h-full sm:h-auto sm:max-h-[90vh] my-auto shadow-2xl animate-in zoom-in-95 overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-6 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <ArrowUpDown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Log Supply Transaction</h3>
                  <p className="text-[11px] text-slate-500">Atomic inventory update & audit logging</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransactionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleLogTransaction} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Item Selector */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Supply Item *</label>
                <select
                  id="select-tx-item"
                  value={transactionForm.itemId}
                  onChange={(e) => {
                    const found = items.find((i) => i.id === e.target.value);
                    if (found) setSelectedItem(found);
                    setTransactionForm({ ...transactionForm, itemId: e.target.value });
                  }}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 font-medium"
                >
                  <option value="" disabled>
                    -- Select item --
                  </option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Current Stock: {i.currentStock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Transaction Type Radio Selector */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Action Type *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransactionForm({ ...transactionForm, type: 'USAGE' })}
                    className={cn(
                      'p-2.5 rounded-lg border text-center font-medium transition-all cursor-pointer flex flex-col items-center gap-1',
                      transactionForm.type === 'USAGE'
                        ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold ring-1 ring-amber-400'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <PackageMinus className="w-4 h-4 text-amber-600" />
                    <span>Room Usage (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransactionForm({ ...transactionForm, type: 'RESTOCK' })}
                    className={cn(
                      'p-2.5 rounded-lg border text-center font-medium transition-all cursor-pointer flex flex-col items-center gap-1',
                      transactionForm.type === 'RESTOCK'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold ring-1 ring-emerald-400'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <PackagePlus className="w-4 h-4 text-emerald-600" />
                    <span>Restock (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransactionForm({ ...transactionForm, type: 'ADJUSTMENT' })}
                    className={cn(
                      'p-2.5 rounded-lg border text-center font-medium transition-all cursor-pointer flex flex-col items-center gap-1',
                      transactionForm.type === 'ADJUSTMENT'
                        ? 'bg-purple-50 border-purple-300 text-purple-900 font-bold ring-1 ring-purple-400'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <History className="w-4 h-4 text-purple-600" />
                    <span>Count Audit (±)</span>
                  </button>
                </div>
              </div>

              {/* Quantity and Room Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Quantity ({selectedItem?.unit || 'units'}) *
                  </label>
                  <input
                    id="input-tx-qty"
                    type="number"
                    min="1"
                    step="1"
                    value={transactionForm.quantity}
                    onChange={(e) =>
                      setTransactionForm({
                        ...transactionForm,
                        quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 font-mono font-bold"
                  />
                  {selectedItem && transactionForm.type === 'USAGE' && (
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Max available to use: {selectedItem.currentStock} {selectedItem.unit}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Related Room (Optional)</label>
                  <select
                    id="select-tx-room"
                    value={transactionForm.relatedRoomId}
                    onChange={(e) => setTransactionForm({ ...transactionForm, relatedRoomId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900"
                  >
                    <option value="">-- General / Central Storage --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.roomNumber} - {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Note / Reason</label>
                <input
                  id="input-tx-note"
                  type="text"
                  placeholder="e.g. Master Suite turnover clean, Supplier shipment invoice #4812"
                  value={transactionForm.note}
                  onChange={(e) => setTransactionForm({ ...transactionForm, note: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900"
                />
              </div>

              {/* Staff attribution badge */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    Logging as: <strong className="text-slate-800">{currentUser.fullName}</strong>
                  </span>
                </div>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                  {ROLE_LABELS[currentUser.role as UserRole] || currentUser.role}
                </span>
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-tx"
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Commit Transaction</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add New Supply Item (OWNER/MANAGER ONLY) */}
      {isNewItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-2xl max-w-lg w-full flex flex-col h-full sm:h-auto sm:max-h-[90vh] my-auto shadow-2xl animate-in zoom-in-95 overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-6 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Supply Item</h3>
                  <p className="text-[11px] text-slate-500">Define tracked linen, toiletry, or amenity specification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewItemModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateItem} className="p-4 sm:p-6 space-y-3.5 text-xs overflow-y-auto flex-1">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Item Name *</label>
                <input
                  id="input-new-item-name"
                  type="text"
                  placeholder="e.g. 800-Thread Count King Sateen Sheets"
                  value={newItemForm.name}
                  onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category *</label>
                  <select
                    id="select-new-item-cat"
                    value={newItemForm.category}
                    onChange={(e) =>
                      setNewItemForm({ ...newItemForm, category: e.target.value as InventoryCategory })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900"
                  >
                    {(Object.keys(CATEGORY_CONFIG) as InventoryCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_CONFIG[cat].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit of Measure *</label>
                  <input
                    id="input-new-item-unit"
                    type="text"
                    placeholder="pcs, sets, bottles, boxes"
                    value={newItemForm.unit}
                    onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Initial Opening Stock *</label>
                  <input
                    id="input-new-item-stock"
                    type="number"
                    min="0"
                    value={newItemForm.currentStock}
                    onChange={(e) =>
                      setNewItemForm({
                        ...newItemForm,
                        currentStock: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Low-Stock Alert Threshold *</label>
                  <input
                    id="input-new-item-threshold"
                    type="number"
                    min="0"
                    value={newItemForm.lowStockThreshold}
                    onChange={(e) =>
                      setNewItemForm({
                        ...newItemForm,
                        lowStockThreshold: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Specifications & Vendor Notes</label>
                <textarea
                  id="textarea-new-item-notes"
                  rows={2}
                  placeholder="Supplier details, minimum order size, suite assignment instructions..."
                  value={newItemForm.notes}
                  onChange={(e) => setNewItemForm({ ...newItemForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewItemModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-create-item-submit"
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Supply Item</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Item (OWNER/MANAGER ONLY) */}
      {isEditItemModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-2xl max-w-lg w-full flex flex-col h-full sm:h-auto sm:max-h-[90vh] my-auto p-4 sm:p-6 shadow-2xl animate-in zoom-in-95 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Supply Definition</h3>
                  <p className="text-[11px] text-slate-500">Update item parameters, categories, or alert triggers</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditItemModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateItem} className="mt-4 space-y-3.5 text-xs overflow-y-auto flex-1">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Item Name *</label>
                <input
                  id="input-edit-item-name"
                  type="text"
                  value={editItemForm.name}
                  onChange={(e) => setEditItemForm({ ...editItemForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category *</label>
                  <select
                    id="select-edit-item-cat"
                    value={editItemForm.category}
                    onChange={(e) =>
                      setEditItemForm({ ...editItemForm, category: e.target.value as InventoryCategory })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900"
                  >
                    {(Object.keys(CATEGORY_CONFIG) as InventoryCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_CONFIG[cat].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit of Measure *</label>
                  <input
                    id="input-edit-item-unit"
                    type="text"
                    value={editItemForm.unit}
                    onChange={(e) => setEditItemForm({ ...editItemForm, unit: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Low-Stock Alert Threshold *</label>
                <input
                  id="input-edit-item-threshold"
                  type="number"
                  min="0"
                  value={editItemForm.lowStockThreshold}
                  onChange={(e) =>
                    setEditItemForm({
                      ...editItemForm,
                      lowStockThreshold: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notes & Specifications</label>
                <textarea
                  id="textarea-edit-item-notes"
                  rows={2}
                  value={editItemForm.notes}
                  onChange={(e) => setEditItemForm({ ...editItemForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => handleDeleteItem(selectedItem)}
                  className="px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-rose-200 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Item</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditItemModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-update-item-submit"
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Item Detail View & Transaction Audit Trail */}
      {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-2xl max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] my-auto flex flex-col p-4 sm:p-6 shadow-2xl animate-in zoom-in-95 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                      CATEGORY_CONFIG[selectedItem.category]?.badge || 'bg-slate-100'
                    )}
                  >
                    {CATEGORY_CONFIG[selectedItem.category]?.label || selectedItem.category}
                  </span>
                  {selectedItem.currentStock <= selectedItem.lowStockThreshold && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Low Stock Flag
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">{selectedItem.name}</h3>
                {selectedItem.notes && <p className="text-xs text-slate-500 mt-0.5">{selectedItem.notes}</p>}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {canManageItems && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenEdit(selectedItem);
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit Item"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4 py-3 px-4 rounded-xl bg-slate-50 border border-slate-100 text-center shrink-0">
              <div>
                <div className="text-[11px] text-slate-500">Current Stock</div>
                <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                  {selectedItem.currentStock} {selectedItem.unit}
                </div>
              </div>
              <div className="border-y sm:border-y-0 sm:border-x border-slate-200 py-2 sm:py-0">
                <div className="text-[11px] text-slate-500">Alert Threshold</div>
                <div className="text-lg font-bold text-amber-700 font-mono mt-0.5">
                  &le; {selectedItem.lowStockThreshold} {selectedItem.unit}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Total Audit Logs</div>
                <div className="text-lg font-bold text-indigo-700 font-mono mt-0.5">
                  {selectedItem.transactions?.length || 0}
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-indigo-600" />
                <span>Transaction History (Audit Trail)</span>
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenTransaction(selectedItem, 'USAGE');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <PackageMinus className="w-3.5 h-3.5 text-amber-600" />
                  <span>Log Usage</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenTransaction(selectedItem, 'RESTOCK');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Restock</span>
                </button>
              </div>
            </div>

            {/* Scrollable Audit Trail List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
              {!selectedItem.transactions || selectedItem.transactions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No transaction history recorded yet for this item.
                </div>
              ) : (
                selectedItem.transactions.map((tx) => {
                  const txConfig = TRANSACTION_TYPE_CONFIG[tx.type] || TRANSACTION_TYPE_CONFIG.ADJUSTMENT;
                  const isPositive = tx.quantity > 0;
                  const isNegative = tx.quantity < 0;

                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-lg border border-slate-100 bg-white hover:bg-slate-50/60 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', txConfig.badge)}>
                            {txConfig.label}
                          </span>
                          {tx.relatedRoom && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              <BedDouble className="w-3 h-3 text-slate-500" />
                              {tx.relatedRoom.roomNumber} - {tx.relatedRoom.name}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(tx.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {tx.note && <p className="text-slate-600 text-[11px] leading-relaxed">{tx.note}</p>}
                        {tx.performedBy && (
                          <div className="text-[10px] text-slate-400">
                            Logged by: <span className="font-medium text-slate-600">{tx.performedBy.fullName}</span> ({tx.performedBy.role})
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={cn(
                            'text-sm font-bold font-mono',
                            isPositive ? 'text-emerald-600' : isNegative ? 'text-amber-600' : 'text-purple-600'
                          )}
                        >
                          {isPositive ? `+${tx.quantity}` : `${tx.quantity}`} {selectedItem.unit}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom spacer for viewport clearance */}
      <div className="h-[50vh]" aria-hidden="true" />
    </div>
  );
}
