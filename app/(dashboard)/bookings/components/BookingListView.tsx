import React from 'react';
import {
  CalendarRange,
  List,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  ArrowRight,
  CalendarCheck,
} from 'lucide-react';
import { Booking, BOOKING_STATUS_CONFIG, BOOKING_SOURCE_CONFIG } from '../../../../lib/api/bookings';
import { Room } from '../../../../lib/api/rooms';
import { cn } from '../../../../lib/utils';

interface BookingListViewProps {
  rooms: Room[];
  filteredBookings: Booking[];
  loading: boolean;
  canEdit: boolean;
  subTab: 'DAY_AGENDA' | 'ALL_LIST';
  setSubTab: (tab: 'DAY_AGENDA' | 'ALL_LIST') => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  onPrevDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
  onCellClick: (room: Room, date: Date) => void;
  onBookingClick: (e: React.MouseEvent | null, booking: Booking) => void;
  filterRoomId: string;
  filterStatus: string;
  filterSource: string;
}

export const BookingListView: React.FC<BookingListViewProps> = ({
  rooms,
  filteredBookings,
  loading,
  canEdit,
  subTab,
  setSubTab,
  selectedDate,
  setSelectedDate,
  onPrevDay,
  onToday,
  onNextDay,
  onCellClick,
  onBookingClick,
  filterRoomId,
  filterStatus,
  filterSource,
}) => {
  // Day Agenda Data computation
  const dayData = React.useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const selDate = new Date(y, m - 1, d);
    selDate.setHours(12, 0, 0, 0);

    const occupiedRooms: { room: Room; booking: Booking }[] = [];
    const availableRooms: Room[] = [];

    rooms.forEach((room) => {
      if (filterRoomId !== 'ALL' && room.id !== filterRoomId) return;

      const activeBooking = filteredBookings.find((b) => {
        if (b.roomId !== room.id) return false;

        const checkIn = new Date(b.checkIn);
        const checkOut = new Date(b.checkOut);
        checkIn.setHours(0, 0, 0, 0);
        checkOut.setHours(23, 59, 59, 999);

        return selDate >= checkIn && selDate < checkOut;
      });

      if (activeBooking) {
        occupiedRooms.push({ room, booking: activeBooking });
      } else {
        availableRooms.push(room);
      }
    });

    return {
      dateObj: selDate,
      occupiedRooms,
      availableRooms,
      totalRoomsCount: rooms.length,
      occupancyPercent: rooms.length > 0 ? Math.round((occupiedRooms.length / rooms.length) * 100) : 0,
    };
  }, [rooms, filteredBookings, selectedDate, filterRoomId]);

  return (
    <div className="space-y-4">
      {/* Sub-view switcher & Date Navigation Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Switcher Tab */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg shrink-0 w-fit">
          <button
            id="tab-list-day-agenda"
            type="button"
            onClick={() => setSubTab('DAY_AGENDA')}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer',
              subTab === 'DAY_AGENDA'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            <span>Day Agenda</span>
          </button>
          <button
            id="tab-list-all-reservations"
            type="button"
            onClick={() => setSubTab('ALL_LIST')}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer',
              subTab === 'ALL_LIST'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <List className="w-3.5 h-3.5" />
            <span>All Reservations ({filteredBookings.length})</span>
          </button>
        </div>

        {/* Date Navigator for Day Agenda */}
        {subTab === 'DAY_AGENDA' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onPrevDay}
                aria-label="Previous day"
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onToday}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={onNextDay}
                aria-label="Next day"
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Native Date Picker */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                id="input-agenda-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs text-slate-900 font-semibold focus:outline-hidden cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* 1. DAY AGENDA VIEW */}
      {subTab === 'DAY_AGENDA' && (
        <div className="space-y-3">
          {/* Day Status Header */}
          <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-bold text-slate-900">
                {dayData.dateObj.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            <span className="font-bold text-indigo-700 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200 text-[11px] shadow-2xs">
              {dayData.occupiedRooms.length} of {dayData.totalRoomsCount} Booked (
              {dayData.occupancyPercent}%)
            </span>
          </div>

          {/* List of Suites Status */}
          {loading ? (
            <div className="py-16 text-center bg-white border border-slate-200 rounded-xl">
              <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading villa bookings...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 bg-white border border-slate-200 rounded-xl">
              No rooms found in database.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rooms
                .filter((r) => filterRoomId === 'ALL' || r.id === filterRoomId)
                .map((room) => {
                  const occupiedItem = dayData.occupiedRooms.find(
                    (item) => item.room.id === room.id
                  );

                  if (occupiedItem) {
                    const b = occupiedItem.booking;
                    const statusCfg = BOOKING_STATUS_CONFIG[b.status];
                    const sourceCfg = BOOKING_SOURCE_CONFIG[b.source];
                    const checkIn = new Date(b.checkIn).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    });
                    const checkOut = new Date(b.checkOut).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    });
                    const nights = Math.max(
                      1,
                      Math.round(
                        (new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    );

                    return (
                      <div
                        key={room.id}
                        onClick={() => onBookingClick(null, b)}
                        className="bg-white border-2 border-indigo-200/80 rounded-xl p-4 shadow-xs hover:border-indigo-400 transition-all cursor-pointer space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-900 text-white">
                                {room.roomNumber}
                              </span>
                              <span className="text-xs font-bold text-slate-900">{room.name}</span>
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                              {b.source === 'AIRBNB' ? (
                                <span
                                  className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-100 shrink-0 inline-block"
                                  title="Airbnb Reservation"
                                />
                              ) : b.source === 'BOOKING_COM' ? (
                                <span
                                  className="w-2 h-2 rounded-full bg-blue-500 ring-2 ring-blue-100 shrink-0 inline-block"
                                  title="Booking.com Reservation"
                                />
                              ) : b.source === 'OTHER' ? (
                                <span
                                  className="w-2 h-2 rounded-full bg-purple-500 ring-2 ring-purple-100 shrink-0 inline-block"
                                  title="External OTA Reservation"
                                />
                              ) : (
                                <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              )}
                              <span className="truncate">{b.guestName}</span>
                            </h3>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span
                              className={cn(
                                'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                                statusCfg.badgeBg,
                                statusCfg.badgeText,
                                statusCfg.badgeBorder
                              )}
                            >
                              {statusCfg.label}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {sourceCfg.label}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {checkIn} → {checkOut} ({nights}n)
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 font-mono">
                            ${Number(b.totalAmount).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1">
                            <span>View & edit reservation</span>
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // Room is Vacant / Available
                  return (
                    <div
                      key={room.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {room.roomNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{room.name}</span>
                        </div>

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Vacant</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span>Max {room.maxOccupancy}p</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-700">${Number(room.basePrice)}/night</span>
                        </div>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              const [y, m, d] = selectedDate.split('-').map(Number);
                              onCellClick(room, new Date(y, m - 1, d));
                            }}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Book Suite</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* 2. ALL RESERVATIONS LIST VIEW */}
      {subTab === 'ALL_LIST' && (
        <div className="space-y-3">
          {loading ? (
            <div className="py-16 text-center bg-white border border-slate-200 rounded-xl">
              <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading reservations...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-6">
              <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No reservations found</p>
              <p className="text-slate-400 mt-1">Try adjusting your search query or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredBookings.map((b) => {
                const statusCfg = BOOKING_STATUS_CONFIG[b.status];
                const sourceCfg = BOOKING_SOURCE_CONFIG[b.source];
                const checkIn = new Date(b.checkIn).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const checkOut = new Date(b.checkOut).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const nights = Math.max(
                  1,
                  Math.round(
                    (new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                );

                return (
                  <div
                    key={b.id}
                    onClick={() => onBookingClick(null, b)}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer space-y-2.5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-white">
                            {b.room?.roomNumber || 'Villa'}
                          </span>
                          <span className="text-xs font-bold text-slate-700 truncate">{b.room?.name}</span>
                        </div>

                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0',
                            statusCfg.badgeBg,
                            statusCfg.badgeText,
                            statusCfg.badgeBorder
                          )}
                        >
                          {statusCfg.label}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        {b.source === 'AIRBNB' ? (
                          <span
                            className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-100 shrink-0 inline-block"
                            title="Airbnb Reservation"
                          />
                        ) : b.source === 'BOOKING_COM' ? (
                          <span
                            className="w-2 h-2 rounded-full bg-blue-500 ring-2 ring-blue-100 shrink-0 inline-block"
                            title="Booking.com Reservation"
                          />
                        ) : b.source === 'OTHER' ? (
                          <span
                            className="w-2 h-2 rounded-full bg-purple-500 ring-2 ring-purple-100 shrink-0 inline-block"
                            title="External OTA Reservation"
                          />
                        ) : (
                          <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        )}
                        <span className="truncate">{b.guestName}</span>
                      </h4>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {checkIn} → {checkOut} ({nights} nights)
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="text-[11px] text-slate-500">
                          <span>Source: </span>
                          <strong className="text-slate-700">{sourceCfg.label}</strong>
                        </div>
                        <span className="font-bold text-slate-900 font-mono">
                          ${Number(b.totalAmount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bottom spacer for viewport clearance */}
      <div className="h-[50vh]" aria-hidden="true" />
    </div>
  );
};
