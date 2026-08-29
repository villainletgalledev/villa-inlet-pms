import React, { useState, useEffect, useMemo } from 'react';
import {
  BedDouble,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sparkles,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  LogOut,
  LogIn,
  ListTodo,
  Wrench,
  Sparkle,
  Layers,
  ArrowUpRight,
  Percent,
  CalendarCheck,
  CreditCard,
  Building,
} from 'lucide-react';
import { Room, fetchRooms, ROOM_STATUS_CONFIG, RoomStatus } from '../../../lib/api/rooms';
import {
  Booking,
  fetchBookings,
  BOOKING_STATUS_CONFIG,
  BOOKING_SOURCE_CONFIG,
} from '../../../lib/api/bookings';
import {
  HousekeepingTask,
  fetchHousekeepingTasks,
  TASK_TYPE_CONFIG,
  TASK_STATUS_CONFIG,
} from '../../../lib/api/housekeeping';
import { cn } from '../../../lib/utils';

interface DashboardPageProps {
  currentUser?: {
    email: string;
    fullName: string;
    role: string;
  };
  onNavigate?: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  currentUser = { email: 'manager@villainlet.com', fullName: 'Villa Manager', role: 'MANAGER' },
  onNavigate,
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Jump to specific tab helper
  const handleNavigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [roomsRes, bookingsRes, tasksRes] = await Promise.all([
        fetchRooms(currentUser),
        fetchBookings({}, currentUser),
        fetchHousekeepingTasks({}, currentUser),
      ]);

      if (roomsRes.rooms) {
        setRooms(roomsRes.rooms);
      }
      if (bookingsRes.bookings) {
        setBookings(bookingsRes.bookings);
      }
      if (tasksRes.tasks) {
        setHousekeepingTasks(tasksRes.tasks);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const now = useMemo(() => new Date(), []);

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // 1. Today's Arrivals (checkIn = today)
  const todaysArrivals = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === 'CANCELLED') return false;
      const inDate = new Date(b.checkIn);
      return isSameDay(inDate, now);
    });
  }, [bookings, now]);

  // 2. Today's Departures (checkOut = today)
  const todaysDepartures = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === 'CANCELLED') return false;
      const outDate = new Date(b.checkOut);
      return isSameDay(outDate, now);
    });
  }, [bookings, now]);

  // 3. Current Occupancy (active reservation today or room marked OCCUPIED)
  const occupancyStats = useMemo(() => {
    const totalRooms = rooms.length || 5;

    // Count rooms that are occupied today
    const occupiedRoomIds = new Set<string>();

    // From active bookings
    bookings.forEach((b) => {
      if (b.status === 'CONFIRMED') {
        const inDate = new Date(b.checkIn).getTime();
        const outDate = new Date(b.checkOut).getTime();
        const nowMs = now.getTime();
        if (nowMs >= inDate && nowMs < outDate) {
          occupiedRoomIds.add(b.roomId);
        }
      }
    });

    // Also count rooms explicitly set to OCCUPIED status
    rooms.forEach((r) => {
      if (r.status === 'OCCUPIED') {
        occupiedRoomIds.add(r.id);
      }
    });

    const occupiedCount = occupiedRoomIds.size;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;

    return {
      totalRooms,
      occupiedCount,
      occupancyRate,
      availableCount: Math.max(0, totalRooms - occupiedCount),
    };
  }, [rooms, bookings, now]);

  // 4. Revenue Snapshot (This month confirmed revenue vs last month)
  const revenueSnapshot = useMemo(() => {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;

    let thisMonthRevenue = 0;
    let thisMonthBookingsCount = 0;
    let lastMonthRevenue = 0;
    let lastMonthBookingsCount = 0;

    bookings.forEach((b) => {
      if (b.status === 'CANCELLED') return;

      const inDate = new Date(b.checkIn);
      const bYear = inDate.getFullYear();
      const bMonth = inDate.getMonth();
      const amount = Number(b.totalAmount) || 0;

      if (bYear === currentYear && bMonth === currentMonth) {
        thisMonthRevenue += amount;
        thisMonthBookingsCount++;
      } else if (bYear === prevMonthYear && bMonth === prevMonth) {
        lastMonthRevenue += amount;
        lastMonthBookingsCount++;
      }
    });

    const revenueDelta = thisMonthRevenue - lastMonthRevenue;
    const percentChange =
      lastMonthRevenue > 0
        ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : thisMonthRevenue > 0
        ? 100
        : 0;

    const isPositive = revenueDelta >= 0;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return {
      thisMonthName: monthNames[currentMonth],
      lastMonthName: monthNames[prevMonth],
      thisMonthRevenue,
      thisMonthBookingsCount,
      lastMonthRevenue,
      lastMonthBookingsCount,
      revenueDelta,
      percentChange,
      isPositive,
    };
  }, [bookings, now]);

  const formattedToday = useMemo(() => {
    return now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [now]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Welcome Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Welcome back, {currentUser.fullName.split(' ')[0]}
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Villa Inlet Operations Live
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {formattedToday} • Daily overview of arrivals, departures, occupancy, and villa performance.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-refresh-dashboard"
            onClick={loadDashboardData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium transition-colors"
            title="Refresh dashboard metrics"
          >
            <RotateCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            <span>Refresh</span>
          </button>

          <button
            id="btn-jump-calendar"
            onClick={() => handleNavigate('/bookings')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Booking Calendar</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>
      </div>

      {/* SECTION 4: Revenue & Occupancy Key Performance Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Occupancy Stat Card */}
        <div
          onClick={() => handleNavigate('/rooms')}
          className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium">Current Occupancy</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BedDouble className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {occupancyStats.occupiedCount} / {occupancyStats.totalRooms}
            </span>
            <span className="text-xs font-semibold text-indigo-600">
              ({occupancyStats.occupancyRate}% Occupied)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${occupancyStats.occupancyRate}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
            <span>{occupancyStats.availableCount} suites available</span>
            <span className="text-indigo-600 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              View rooms <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Revenue This Month Card */}
        <div
          onClick={() => handleNavigate('/bookings')}
          className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium">{revenueSnapshot.thisMonthName} Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              ${revenueSnapshot.thisMonthRevenue.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border',
                revenueSnapshot.isPositive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              )}
            >
              {revenueSnapshot.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>
                {revenueSnapshot.percentChange > 0 ? `+${revenueSnapshot.percentChange}%` : `${revenueSnapshot.percentChange}%`}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 truncate">vs last month</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>{revenueSnapshot.thisMonthBookingsCount} bookings this month</span>
            <span className="text-emerald-600 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Ledger <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Today's Arrivals Counter */}
        <div
          onClick={() => handleNavigate('/bookings')}
          className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium">Arrivals Today</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <LogIn className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{todaysArrivals.length}</div>
          <div className="text-[11px] text-slate-400 mt-2">
            {todaysArrivals.length === 0
              ? 'No guests checking in today'
              : `${todaysArrivals.length} guest party arriving today`}
          </div>
          <div className="text-[11px] text-teal-600 font-medium mt-3 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
            <span>Review arrival checklist</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Today's Departures Counter */}
        <div
          onClick={() => handleNavigate('/bookings')}
          className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium">Departures Today</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{todaysDepartures.length}</div>
          <div className="text-[11px] text-slate-400 mt-2">
            {todaysDepartures.length === 0
              ? 'No check-outs scheduled today'
              : `${todaysDepartures.length} suite turnover due today`}
          </div>
          <div className="text-[11px] text-amber-600 font-medium mt-3 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
            <span>Manage checkouts</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* SECTION 3: Current Occupancy & Mini Room-Status Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Villa Suite Live Status Matrix
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                5 Luxury Suites
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time room occupancy, cleaning turnover status, and quick suite jump.
            </p>
          </div>

          <button
            onClick={() => handleNavigate('/rooms')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Open Room Management</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {rooms.map((room) => {
            const statusConfig = ROOM_STATUS_CONFIG[room.status] || ROOM_STATUS_CONFIG.AVAILABLE;
            const primaryPhoto = room.imageUrls?.[0] || 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=400&q=80';

            return (
              <div
                key={room.id}
                onClick={() => handleNavigate('/rooms')}
                className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 rounded-xl p-3 shadow-2xs transition-all hover:border-indigo-200 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="relative h-24 rounded-lg overflow-hidden mb-2.5 bg-slate-200">
                    <img
                      src={primaryPhoto}
                      alt={room.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900/90 text-white backdrop-blur-xs">
                      {room.roomNumber}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                    {room.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ${Number(room.basePrice)}/night • Max {room.maxOccupancy}
                  </p>
                </div>

                <div className="pt-2.5 mt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1',
                      statusConfig.bg,
                      statusConfig.text,
                      statusConfig.border
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full', statusConfig.dot)} />
                    {statusConfig.label}
                  </span>

                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTIONS 1 & 2: Today's Arrivals & Today's Departures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* SECTION 1: Today's Arrivals */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <LogIn className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Today's Arrivals</h2>
                  <p className="text-[11px] text-slate-500">Guests checking in today</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200/60">
                {todaysArrivals.length} Expected
              </span>
            </div>

            {todaysArrivals.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6">
                <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-800">No arrivals scheduled for today</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs mx-auto">
                  New reservations created in the Booking Calendar will automatically stream into today's guest reception queue.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todaysArrivals.map((booking) => {
                  const room = rooms.find((r) => r.id === booking.roomId);
                  const roomStatus = room?.status || 'AVAILABLE';
                  const roomStatusCfg = ROOM_STATUS_CONFIG[roomStatus as RoomStatus] || ROOM_STATUS_CONFIG.AVAILABLE;
                  const sourceCfg = BOOKING_SOURCE_CONFIG[booking.source] || BOOKING_SOURCE_CONFIG.DIRECT;

                  const isRoomCleanAndReady = roomStatus === 'AVAILABLE' || roomStatus === 'OCCUPIED';

                  return (
                    <div
                      key={booking.id}
                      onClick={() => handleNavigate('/bookings')}
                      className="bg-slate-50 hover:bg-slate-100/90 border border-slate-200/90 rounded-xl p-3.5 shadow-2xs hover:border-teal-300 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                              {booking.guestName}
                            </span>
                            <span
                              className={cn(
                                'px-1.5 py-0.2 rounded text-[10px] font-semibold border',
                                sourceCfg.bg,
                                sourceCfg.text,
                                sourceCfg.border
                              )}
                            >
                              {sourceCfg.label}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-600 flex items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              {room ? `${room.roomNumber} - ${room.name}` : 'Suite'}
                            </span>
                            <span>•</span>
                            <span>{booking.numGuests} Guests</span>
                            <span>•</span>
                            <span className="font-mono font-medium">${Number(booking.totalAmount)}</span>
                          </div>

                          {booking.notes && (
                            <p className="text-[11px] text-slate-400 italic mt-1 line-clamp-1">
                              "{booking.notes}"
                            </p>
                          )}
                        </div>

                        {/* Prep Status Pill */}
                        <div className="text-right shrink-0">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1',
                              isRoomCleanAndReady
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            )}
                          >
                            <span
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                isRoomCleanAndReady ? 'bg-emerald-500' : 'bg-amber-500'
                              )}
                            />
                            {isRoomCleanAndReady ? 'Room Ready' : `Prep: ${roomStatusCfg.label}`}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-1">
                            Check-in 2:00 PM
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">View all upcoming reservations</span>
            <button
              onClick={() => handleNavigate('/bookings')}
              className="font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <span>Booking Calendar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* SECTION 2: Today's Departures */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <LogOut className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Today's Departures</h2>
                  <p className="text-[11px] text-slate-500">Guests checking out today</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                {todaysDepartures.length} Turnover Due
              </span>
            </div>

            {todaysDepartures.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-800">No departures scheduled for today</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs mx-auto">
                  Guests scheduled to check out on today's date will appear here for turnover coordination.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todaysDepartures.map((booking) => {
                  const room = rooms.find((r) => r.id === booking.roomId);
                  const isCheckedOut = booking.status === 'COMPLETED' || Boolean(booking.checkedOutAt);
                  const sourceCfg = BOOKING_SOURCE_CONFIG[booking.source] || BOOKING_SOURCE_CONFIG.DIRECT;

                  return (
                    <div
                      key={booking.id}
                      onClick={() => handleNavigate('/bookings')}
                      className="bg-slate-50 hover:bg-slate-100/90 border border-slate-200/90 rounded-xl p-3.5 shadow-2xs hover:border-amber-300 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                              {booking.guestName}
                            </span>
                            <span
                              className={cn(
                                'px-1.5 py-0.2 rounded text-[10px] font-semibold border',
                                sourceCfg.bg,
                                sourceCfg.text,
                                sourceCfg.border
                              )}
                            >
                              {sourceCfg.label}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-600 flex items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              {room ? `${room.roomNumber} - ${room.name}` : 'Suite'}
                            </span>
                            <span>•</span>
                            <span>Check-out 11:00 AM</span>
                          </div>

                          <div className="text-[10px] text-slate-400 mt-1">
                            Deposit Paid: ${Number(booking.amountPaid)} of ${Number(booking.totalAmount)}
                          </div>
                        </div>

                        {/* Checkout Status */}
                        <div className="text-right shrink-0">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1',
                              isCheckedOut
                                ? 'bg-slate-100 text-slate-700 border-slate-300'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            )}
                          >
                            <span
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                isCheckedOut ? 'bg-slate-500' : 'bg-amber-500'
                              )}
                            />
                            {isCheckedOut ? 'Checked Out' : 'Pending Departure'}
                          </span>
                          <span className="text-[10px] text-indigo-600 font-medium block mt-1 group-hover:underline">
                            Open in Calendar →
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">View room cleaning queue</span>
            <button
              onClick={() => handleNavigate('/housekeeping')}
              className="font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1"
            >
              <span>Housekeeping Schedule</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 5: Pending Tasks Placeholder (Clean Stub with clear TODO) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ListTodo className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Pending Operations & Tasks</h2>
              <p className="text-xs text-slate-500">
                Housekeeping turnovers, maintenance work orders, and villa staff tasks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleNavigate('/housekeeping')}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-lg transition-colors"
            >
              Housekeeping
            </button>
            <button
              onClick={() => handleNavigate('/maintenance')}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-lg transition-colors"
            >
              Maintenance
            </button>
          </div>
        </div>

        {/* Active Housekeeping Turnovers & Maintenance Staging */}
        {housekeepingTasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {housekeepingTasks
                .filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS')
                .slice(0, 6)
                .map((task) => {
                  const typeCfg = TASK_TYPE_CONFIG[task.taskType] || TASK_TYPE_CONFIG.CHECKOUT_CLEAN;
                  const statusCfg = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.PENDING;
                  const doneCount = task.checklist?.filter((c) => c.done).length || 0;
                  const totalCount = task.checklist?.length || 0;

                  return (
                    <div
                      key={task.id}
                      onClick={() => handleNavigate('/housekeeping')}
                      className="bg-slate-50 hover:bg-slate-100/90 border border-slate-200/90 rounded-xl p-3.5 shadow-2xs transition-all cursor-pointer group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-white">
                            {task.room?.roomNumber}
                          </span>
                          <span
                            className={cn(
                              'px-2 py-0.2 rounded-full text-[10px] font-bold border',
                              typeCfg.bg,
                              typeCfg.text,
                              typeCfg.border
                            )}
                          >
                            {typeCfg.label}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-amber-700 transition-colors">
                          {task.room?.name}
                        </h4>

                        <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                          <span>Checklist: {doneCount}/{totalCount} items</span>
                          <span
                            className={cn(
                              'px-1.5 py-0.2 rounded text-[10px] font-bold border',
                              statusCfg.bg,
                              statusCfg.text,
                              statusCfg.border
                            )}
                          >
                            {statusCfg.label}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 mt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">
                          {task.assignedTo ? task.assignedTo.fullName : 'Unassigned'}
                        </span>
                        <span className="text-amber-600 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                          <span>Open Clean</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Maintenance Staging Note */}
            {/* 
              TODO: Wire real Maintenance work order tickets once the Maintenance tab is implemented in subsequent prompt.
            */}
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3.5 text-center text-xs text-slate-500 flex items-center justify-between">
              <span>Maintenance work orders will appear here once the Maintenance tab is configured.</span>
              <button
                onClick={() => handleNavigate('/housekeeping')}
                className="text-amber-700 font-semibold hover:underline"
              >
                View all housekeeping →
              </button>
            </div>
          </div>
        ) : (
          /* 
            TODO: Wire real Maintenance task queries once that module is implemented in subsequent prompts.
          */
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-6 sm:p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100/60 border border-indigo-200/60 flex items-center justify-center text-indigo-600 mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                All Villa Suites Clean & Ready
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                No active turnovers or cleaning tickets pending in the queue. Maintenance tickets will also appear here once the Maintenance tab is implemented.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => handleNavigate('/housekeeping')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs hover:bg-slate-50 transition-colors"
              >
                <Sparkle className="w-3.5 h-3.5 text-amber-500" />
                <span>Go to Housekeeping</span>
              </button>
              <button
                onClick={() => handleNavigate('/maintenance')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs hover:bg-slate-50 transition-colors"
              >
                <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                <span>Go to Maintenance</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom spacer for viewport clearance */}
      <div className="h-[50vh]" aria-hidden="true" />
    </div>
  );
};

export default DashboardPage;
