import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Lock,
  Info,
  CalendarCheck,
  Percent,
  DollarSign,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List as ListIcon,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Booking,
  BookingStatus,
  BookingSource,
  BOOKING_STATUS_CONFIG,
  BOOKING_SOURCE_CONFIG,
  fetchBookings,
  createBooking,
  updateBooking,
  deleteBooking,
} from '../../../lib/api/bookings';
import { Room, fetchRooms } from '../../../lib/api/rooms';
import { canManageBookings, isOwnerOrManager, UserRole } from '../../../lib/rbac';
import { cn } from '../../../lib/utils';
import { BookingGridTimeline } from './components/BookingGridTimeline';
import { BookingListView } from './components/BookingListView';
import { BookingLegend } from './components/BookingLegend';
import { BookingModal } from './components/BookingModal';

interface BookingsPageProps {
  currentUser?: {
    id?: string;
    email: string;
    fullName: string;
    role: UserRole | string;
  };
}

export const BookingsPage: React.FC<BookingsPageProps> = ({
  currentUser = { email: 'manager@villainlet.com', fullName: 'Villa Manager', role: 'MANAGER' },
}) => {
  const userRole = (currentUser?.role as UserRole) || 'MANAGER';
  const canEdit = canManageBookings(userRole);
  const isOwnerMgr = isOwnerOrManager(userRole);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // View Mode: 'grid' | 'list', persisted in localStorage
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('villa_inlet_booking_view');
        if (saved === 'grid' || saved === 'list') {
          return saved;
        }
      } catch {
        // ignore localStorage error
      }
    }
    return 'grid';
  });

  const handleViewChange = (newView: 'grid' | 'list') => {
    setViewMode(newView);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('villa_inlet_booking_view', newView);
      } catch {
        // ignore
      }
    }
  };

  // Timeline View Settings (Grid View)
  const [viewDaysCount, setViewDaysCount] = useState<7 | 14 | 30>(14);
  const [timelineStartDate, setTimelineStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2); // Start 2 days before today for initial context
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // List View Settings (List View)
  const [listSubTab, setListSubTab] = useState<'DAY_AGENDA' | 'ALL_LIST'>('DAY_AGENDA');
  const [selectedListDate, setSelectedListDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRoomId, setFilterRoomId] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [isFilterOpenMobile, setIsFilterOpenMobile] = useState(false);

  // New / Edit Booking Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    roomId: string;
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
  }>({
    roomId: '',
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    checkIn: '',
    checkOut: '',
    numGuests: 2,
    totalAmount: 0,
    amountPaid: 0,
    status: 'CONFIRMED',
    source: 'DIRECT',
    notes: '',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Load Data
  const loadData = async () => {
    setLoading(true);
    const [roomsRes, bookingsRes] = await Promise.all([
      fetchRooms(currentUser),
      fetchBookings({}, currentUser),
    ]);

    if (roomsRes.rooms) {
      setRooms(roomsRes.rooms);
    }
    if (bookingsRes.bookings) {
      setBookings(bookingsRes.bookings);
    }
    if (bookingsRes.error) {
      showToast(bookingsRes.error, 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Format Helper for Input type="date"
  function formatDateInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Filtered Bookings for the Grid and List
  // RULE: CANCELLED bookings must NOT render as an occupancy bar/entry by default.
  // Only visible if user explicitly sets filterStatus === 'CANCELLED'.
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Exclude CANCELLED bookings unless explicitly filtered for CANCELLED
      if (filterStatus !== 'CANCELLED' && b.status === 'CANCELLED') {
        return false;
      }
      if (filterRoomId !== 'ALL' && b.roomId !== filterRoomId) return false;
      if (filterStatus !== 'ALL' && b.status !== filterStatus) return false;
      if (filterSource !== 'ALL' && b.source !== filterSource) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          b.guestName.toLowerCase().includes(q) ||
          b.guestEmail.toLowerCase().includes(q) ||
          (b.guestPhone && b.guestPhone.includes(q)) ||
          (b.room && b.room.name.toLowerCase().includes(q)) ||
          (b.room && b.room.roomNumber.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [bookings, filterRoomId, filterStatus, filterSource, searchQuery]);

  // Generate Timeline Days array for Grid View
  const timelineDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < viewDaysCount; i++) {
      const d = new Date(timelineStartDate);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [timelineStartDate, viewDaysCount]);

  const timelineEndDate = useMemo(() => {
    const d = new Date(timelineStartDate);
    d.setDate(d.getDate() + viewDaysCount);
    return d;
  }, [timelineStartDate, viewDaysCount]);

  // Date Navigation Helpers (Grid View)
  const handleNavPrev = () => {
    setTimelineStartDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - (viewDaysCount === 30 ? 15 : viewDaysCount === 14 ? 7 : 4));
      return d;
    });
  };

  const handleNavNext = () => {
    setTimelineStartDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + (viewDaysCount === 30 ? 15 : viewDaysCount === 14 ? 7 : 4));
      return d;
    });
  };

  const handleNavToday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    d.setHours(0, 0, 0, 0);
    setTimelineStartDate(d);
  };

  // Date Navigation Helpers (List View - Day Agenda)
  const handleListNavPrevDay = () => {
    const [y, m, d] = selectedListDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() - 1);
    setSelectedListDate(formatDateInput(dateObj));
  };

  const handleListNavNextDay = () => {
    const [y, m, d] = selectedListDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + 1);
    setSelectedListDate(formatDateInput(dateObj));
  };

  const handleListNavToday = () => {
    setSelectedListDate(formatDateInput(new Date()));
  };

  // Analytics Strip (Computed for visible window)
  const analytics = useMemo(() => {
    const totalRoomNightsAvailable = rooms.length * viewDaysCount;
    let bookedNightsInRange = 0;
    let revenueInRange = 0;
    let paidInRange = 0;
    const activeBookingsSet = new Set<string>();

    const winStart = timelineStartDate.getTime();
    const winEnd = timelineEndDate.getTime();

    bookings.forEach((b) => {
      if (b.status === 'CANCELLED') return;

      const bIn = new Date(b.checkIn).getTime();
      const bOut = new Date(b.checkOut).getTime();

      // Check if booking overlaps visible window
      if (bOut > winStart && bIn < winEnd) {
        activeBookingsSet.add(b.id);

        const overlapStart = Math.max(bIn, winStart);
        const overlapEnd = Math.min(bOut, winEnd);
        const nights = Math.max(0, Math.round((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)));

        bookedNightsInRange += nights;
        revenueInRange += Number(b.totalAmount);
        paidInRange += Number(b.amountPaid);
      }
    });

    const occupancyRate =
      totalRoomNightsAvailable > 0
        ? Math.min(100, Math.round((bookedNightsInRange / totalRoomNightsAvailable) * 100))
        : 0;

    return {
      activeCount: activeBookingsSet.size,
      occupancyRate,
      revenueInRange,
      paidInRange,
      outstanding: Math.max(0, revenueInRange - paidInRange),
    };
  }, [bookings, rooms, timelineStartDate, timelineEndDate, viewDaysCount]);

  // Count active filters for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterRoomId !== 'ALL') count++;
    if (filterStatus !== 'ALL') count++;
    if (filterSource !== 'ALL') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [filterRoomId, filterStatus, filterSource, searchQuery]);

  const handleResetFilters = () => {
    setFilterRoomId('ALL');
    setFilterStatus('ALL');
    setFilterSource('ALL');
    setSearchQuery('');
  };

  // Open Create Modal from Clicking an Empty Cell / Vacant Suite
  const handleCellClick = (room: Room, date: Date) => {
    if (!canEdit) return;
    setConflictError(null);
    setEditingBooking(null);

    const checkInStr = formatDateInput(date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 3); // default 3 nights
    const checkOutStr = formatDateInput(nextDay);

    const basePrice = Number(room.basePrice) || 350;
    const estTotal = basePrice * 3;

    setFormData({
      roomId: room.id,
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      checkIn: checkInStr,
      checkOut: checkOutStr,
      numGuests: Math.min(2, room.maxOccupancy),
      totalAmount: estTotal,
      amountPaid: estTotal,
      status: 'CONFIRMED',
      source: 'DIRECT',
      notes: '',
    });

    setIsModalOpen(true);
  };

  // Open Edit Modal from Clicking a Booking Bar or Card
  const handleBookingClick = (e: React.MouseEvent | null, booking: Booking) => {
    if (e) e.stopPropagation();
    setConflictError(null);
    setEditingBooking(booking);

    setFormData({
      roomId: booking.roomId,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone || '',
      checkIn: formatDateInput(new Date(booking.checkIn)),
      checkOut: formatDateInput(new Date(booking.checkOut)),
      numGuests: booking.numGuests,
      totalAmount: Number(booking.totalAmount),
      amountPaid: Number(booking.amountPaid),
      status: booking.status,
      source: booking.source,
      notes: booking.notes || '',
    });

    setIsModalOpen(true);
  };

  // Recalculate price when room or dates change in form
  const handleDatesOrRoomChange = (
    newRoomId: string,
    newCheckIn: string,
    newCheckOut: string
  ) => {
    const selectedRoom = rooms.find((r) => r.id === newRoomId);
    if (selectedRoom && newCheckIn && newCheckOut) {
      const inD = new Date(newCheckIn);
      const outD = new Date(newCheckOut);
      const diffTime = outD.getTime() - inD.getTime();
      const nights = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
      const baseRate = Number(selectedRoom.basePrice) || 300;
      const total = baseRate * nights;

      setFormData((prev) => ({
        ...prev,
        roomId: newRoomId,
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        totalAmount: total,
      }));
    }
  };

  // Client-Side Overlap Pre-Check
  const checkClientSideOverlap = (
    targetRoomId: string,
    inStr: string,
    outStr: string,
    ignoreBookingId?: string
  ): Booking | null => {
    const inTime = new Date(inStr).getTime();
    const outTime = new Date(outStr).getTime();

    return (
      bookings.find((b) => {
        if (ignoreBookingId && b.id === ignoreBookingId) return false;
        if (b.roomId !== targetRoomId) return false;
        if (b.status !== 'CONFIRMED') return false;

        const bIn = new Date(b.checkIn).getTime();
        const bOut = new Date(b.checkOut).getTime();
        return inTime < bOut && outTime > bIn;
      }) || null
    );
  };

  // Handle Form Submit (Create or Update)
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setConflictError(null);

    // Validate dates
    const inD = new Date(formData.checkIn);
    const outD = new Date(formData.checkOut);
    if (outD <= inD) {
      setConflictError('Check-out date must be strictly after the check-in date.');
      return;
    }

    // Pre-check overlap on client
    if (formData.status === 'CONFIRMED') {
      const conflict = checkClientSideOverlap(
        formData.roomId,
        formData.checkIn,
        formData.checkOut,
        editingBooking?.id
      );
      if (conflict) {
        const roomName = conflict.room?.name || 'This suite';
        const range = `${new Date(conflict.checkIn).toLocaleDateString()} to ${new Date(conflict.checkOut).toLocaleDateString()}`;
        setConflictError(
          `Conflict: ${roomName} is already booked for "${conflict.guestName}" (${range}). Please pick alternate dates or another suite.`
        );
        return;
      }
    }

    setIsSubmitting(true);

    if (editingBooking) {
      const res = await updateBooking(
        editingBooking.id,
        {
          roomId: formData.roomId,
          guestName: formData.guestName,
          guestEmail: formData.guestEmail,
          guestPhone: formData.guestPhone,
          checkIn: formData.checkIn,
          checkOut: formData.checkOut,
          numGuests: formData.numGuests,
          totalAmount: Number(formData.totalAmount),
          amountPaid: Number(formData.amountPaid),
          status: formData.status,
          source: formData.source,
          notes: formData.notes,
        },
        currentUser
      );

      setIsSubmitting(false);

      if (res.booking) {
        showToast(`Reservation for "${res.booking.guestName}" updated successfully.`);
        setIsModalOpen(false);
        setEditingBooking(null);
        await loadData();
      } else {
        setConflictError(res.error || 'Failed to update reservation.');
      }
    } else {
      const res = await createBooking(
        {
          roomId: formData.roomId,
          guestName: formData.guestName,
          guestEmail: formData.guestEmail,
          guestPhone: formData.guestPhone,
          checkIn: formData.checkIn,
          checkOut: formData.checkOut,
          numGuests: formData.numGuests,
          totalAmount: Number(formData.totalAmount),
          amountPaid: Number(formData.amountPaid),
          status: formData.status,
          source: formData.source,
          notes: formData.notes,
        },
        currentUser
      );

      setIsSubmitting(false);

      if (res.booking) {
        showToast(`Reservation confirmed for "${res.booking.guestName}".`);
        setIsModalOpen(false);
        await loadData();
      } else {
        setConflictError(res.error || 'Failed to create reservation.');
      }
    }
  };

  // Delete Booking
  const handleDeleteBooking = async () => {
    if (!editingBooking) return;
    if (!window.confirm(`Are you sure you want to delete reservation for "${editingBooking.guestName}"?`)) {
      return;
    }

    const res = await deleteBooking(editingBooking.id, currentUser);
    if (res.success) {
      showToast(`Reservation #${editingBooking.id.slice(0, 8)} deleted.`);
      setIsModalOpen(false);
      setEditingBooking(null);
      await loadData();
    } else {
      showToast(res.error || 'Failed to delete booking', 'error');
    }
  };

  // Quick Check-out Action
  const handleQuickCheckOut = async () => {
    if (!editingBooking) return;
    setIsSubmitting(true);
    const res = await updateBooking(
      editingBooking.id,
      {
        status: 'COMPLETED',
      },
      currentUser
    );
    setIsSubmitting(false);

    if (res.booking) {
      showToast(`Guest "${res.booking.guestName}" checked out. Room is queued for Housekeeping.`);
      setIsModalOpen(false);
      setEditingBooking(null);
      await loadData();
    } else {
      showToast(res.error || 'Failed to complete check out', 'error');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Toast Alert */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2',
            toast.type === 'success' && 'bg-slate-900 border-slate-800 text-white',
            toast.type === 'error' && 'bg-rose-950 border-rose-800 text-rose-100',
            toast.type === 'info' && 'bg-slate-900 border-slate-800 text-white'
          )}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-indigo-400 shrink-0" />}
          <span className="text-xs font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Booking Calendar & Timeline
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 shrink-0">
              Live Matrix
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Room-by-date occupancy, reservation management, conflict prevention, and revenue metrics.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {/* Grid / List View Toggle Control - Available on all screen sizes */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/80 shrink-0">
            <button
              id="btn-view-grid"
              type="button"
              onClick={() => handleViewChange('grid')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                viewMode === 'grid'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              title="Switch to Grid Timeline View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid View</span>
            </button>
            <button
              id="btn-view-list"
              type="button"
              onClick={() => handleViewChange('list')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                viewMode === 'list'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              title="Switch to List View"
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span>List View</span>
            </button>
          </div>

          {canEdit ? (
            <button
              id="btn-new-booking"
              onClick={() => {
                const today = new Date();
                const nextDay = new Date();
                nextDay.setDate(nextDay.getDate() + 3);
                setEditingBooking(null);
                setConflictError(null);
                setFormData({
                  roomId: rooms[0]?.id || '',
                  guestName: '',
                  guestEmail: '',
                  guestPhone: '',
                  checkIn: formatDateInput(today),
                  checkOut: formatDateInput(nextDay),
                  numGuests: 2,
                  totalAmount: Number(rooms[0]?.basePrice || 350) * 3,
                  amountPaid: Number(rooms[0]?.basePrice || 350) * 3,
                  status: 'CONFIRMED',
                  source: 'DIRECT',
                  notes: '',
                });
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Reservation</span>
            </button>
          ) : (
            <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 font-medium flex items-center gap-1.5 shrink-0">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Read-Only Mode</span>
            </div>
          )}

          <button
            id="btn-refresh-bookings"
            onClick={loadData}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50 shrink-0"
            title="Refresh bookings"
          >
            <RotateCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Analytics Strip (Responsive 2x2 on mobile, 4 columns on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="truncate">Active Bookings</span>
            <CalendarCheck className="w-4 h-4 text-indigo-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">{analytics.activeCount}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
            {viewDaysCount}D window active
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-emerald-700 mb-1">
            <span className="truncate">Occupancy</span>
            <Percent className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-700">{analytics.occupancyRate}%</div>
          <div className="text-[10px] sm:text-[11px] text-emerald-600/80 mt-0.5 truncate">Suite nights booked</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-indigo-700 mb-1">
            <span className="truncate">Revenue</span>
            <DollarSign className="w-4 h-4 text-indigo-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-indigo-700 truncate">
            ${analytics.revenueInRange.toLocaleString()}
          </div>
          <div className="text-[10px] sm:text-[11px] text-indigo-600/80 mt-0.5 truncate">Gross in range</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-amber-700 mb-1">
            <span className="truncate">Pending Balance</span>
            <CreditCard className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-700 truncate">
            ${analytics.outstanding.toLocaleString()}
          </div>
          <div className="text-[10px] sm:text-[11px] text-amber-600/80 mt-0.5 truncate">Uncollected</div>
        </div>
      </div>

      {/* UNIVERSAL FILTER & CONTROLS TOOLBAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Date Navigator / Timeline Controls (for Grid View) or Filter Title */}
          {viewMode === 'grid' ? (
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  id="btn-prev-dates"
                  onClick={handleNavPrev}
                  className="p-1.5 rounded hover:bg-white text-slate-700 transition-colors cursor-pointer"
                  title="Previous dates"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  id="btn-today-dates"
                  onClick={handleNavToday}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-white text-slate-900 shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Today
                </button>
                <button
                  id="btn-next-dates"
                  onClick={handleNavNext}
                  className="p-1.5 rounded hover:bg-white text-slate-700 transition-colors cursor-pointer"
                  title="Next dates"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs font-bold text-slate-800 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 whitespace-nowrap">
                {timelineStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                –{' '}
                {timelineEndDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>

              {/* View Window Range Selector */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {([7, 14, 30] as const).map((days) => (
                  <button
                    key={days}
                    onClick={() => setViewDaysCount(days)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer',
                      viewDaysCount === days
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    {days}D
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ListIcon className="w-4 h-4 text-indigo-600" />
                <span>Reservations Directory</span>
              </span>
              <span className="text-xs text-slate-400">
                ({filteredBookings.length} bookings match current filters)
              </span>
            </div>
          )}

          {/* Right: Filters & Search */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Search */}
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                id="input-bookings-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search guest or suite..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Room Filter */}
            <select
              id="select-filter-room"
              value={filterRoomId}
              onChange={(e) => setFilterRoomId(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All 5 Suites</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} - {r.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              id="select-filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Active Statuses</option>
              {(['CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED'] as BookingStatus[]).map((st) => (
                <option key={st} value={st}>
                  {BOOKING_STATUS_CONFIG[st].label}
                </option>
              ))}
            </select>

            {/* Source Filter */}
            <select
              id="select-filter-source"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Channels</option>
              {(['DIRECT', 'AIRBNB', 'BOOKING_COM', 'OTHER'] as BookingSource[]).map((sc) => (
                <option key={sc} value={sc}>
                  {BOOKING_SOURCE_CONFIG[sc].label}
                </option>
              ))}
            </select>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Reset ({activeFiltersCount})
              </button>
            )}
          </div>
        </div>

        {/* Color Legend (Always visible) */}
        <BookingLegend showCancelledHint={viewMode === 'grid'} />
      </div>

      {/* VIEW CONTAINER */}
      {viewMode === 'grid' ? (
        <BookingGridTimeline
          rooms={rooms}
          filteredBookings={filteredBookings}
          timelineDays={timelineDays}
          timelineStartDate={timelineStartDate}
          timelineEndDate={timelineEndDate}
          viewDaysCount={viewDaysCount}
          loading={loading}
          canEdit={canEdit}
          onCellClick={handleCellClick}
          onBookingClick={handleBookingClick}
        />
      ) : (
        <BookingListView
          rooms={rooms}
          filteredBookings={filteredBookings}
          loading={loading}
          canEdit={canEdit}
          subTab={listSubTab}
          setSubTab={setListSubTab}
          selectedDate={selectedListDate}
          setSelectedDate={setSelectedListDate}
          onPrevDay={handleListNavPrevDay}
          onToday={handleListNavToday}
          onNextDay={handleListNavNextDay}
          onCellClick={handleCellClick}
          onBookingClick={handleBookingClick}
          filterRoomId={filterRoomId}
          filterStatus={filterStatus}
          filterSource={filterSource}
        />
      )}

      {/* BOOKING MODAL */}
      <BookingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingBooking={editingBooking}
        canEdit={canEdit}
        isOwnerMgr={isOwnerMgr}
        rooms={rooms}
        formData={formData}
        setFormData={setFormData}
        conflictError={conflictError}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmitBooking}
        onDelete={handleDeleteBooking}
        onQuickCheckOut={handleQuickCheckOut}
        onDatesOrRoomChange={handleDatesOrRoomChange}
      />

      {/* Bottom spacer for viewport clearance */}
      <div className="h-[50vh]" aria-hidden="true" />
    </div>
  );
};

export default BookingsPage;
