import React, { useRef, useState } from 'react';
import { Booking, BOOKING_STATUS_CONFIG } from '../../../../lib/api/bookings';
import { Room } from '../../../../lib/api/rooms';
import { cn } from '../../../../lib/utils';

interface BookingGridTimelineProps {
  rooms: Room[];
  filteredBookings: Booking[];
  timelineDays: Date[];
  timelineStartDate: Date;
  timelineEndDate: Date;
  viewDaysCount: number;
  loading: boolean;
  canEdit: boolean;
  onCellClick: (room: Room, date: Date) => void;
  onBookingClick: (e: React.MouseEvent | null, booking: Booking) => void;
}

export const BookingGridTimeline: React.FC<BookingGridTimelineProps> = ({
  rooms,
  filteredBookings,
  timelineDays,
  timelineStartDate,
  timelineEndDate,
  viewDaysCount,
  loading,
  canEdit,
  onCellClick,
  onBookingClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [draggedDistance, setDraggedDistance] = useState(0);

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isToday = (d: Date) => isSameDay(d, new Date());

  // Mouse drag-to-scroll handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only initiate drag on primary click and if not clicking a button/interactive element
    if (e.button !== 0 || !containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
    setDraggedDistance(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // multiplier for smooth scrolling
    containerRef.current.scrollLeft = scrollLeft - walk;
    setDraggedDistance(Math.abs(x - startX));
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
      {/* Scrollable Container with NO visible scrollbar */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className={cn(
          'overflow-x-auto overflow-y-auto max-h-[72vh] touch-pan-x select-none',
          '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          isDragging ? 'cursor-grabbing' : 'cursor-default'
        )}
      >
        <div className="min-w-max">
          {/* Timeline Header (Date Columns) */}
          <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-30">
            {/* Frozen Top-Left Corner Cell: Compact room code label */}
            <div className="sticky left-0 z-40 w-[54px] sm:w-[60px] md:w-[68px] min-w-[54px] sm:min-w-[60px] md:min-w-[68px] bg-slate-50 py-2 px-1 border-r border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 uppercase tracking-wider shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] shrink-0">
              <span>Room</span>
            </div>

            {/* Day Header Cells: Compact date headers */}
            <div className="flex">
              {timelineDays.map((day, idx) => {
                const today = isToday(day);
                const dayName = day.toLocaleDateString(undefined, { weekday: 'short' });
                const dayNum = day.getDate();
                const monthName = day.toLocaleDateString(undefined, { month: 'short' });
                const isFirstOfMonth = dayNum === 1 || idx === 0;

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'w-[36px] sm:w-[42px] md:w-[48px] min-w-[36px] sm:min-w-[42px] md:min-w-[48px] py-1.5 px-0.5 text-center border-r border-slate-200/80 flex flex-col items-center justify-center transition-colors shrink-0',
                      today ? 'bg-indigo-50/90 font-bold' : 'hover:bg-slate-100/60',
                      day.getDay() === 0 || day.getDay() === 6 ? 'bg-slate-100/30' : ''
                    )}
                    title={day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  >
                    <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase tracking-tighter truncate max-w-full leading-none">
                      {isFirstOfMonth ? `${monthName} ` : ''}
                      {dayName}
                    </span>
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] mt-0.5 leading-none',
                        today
                          ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                          : 'text-slate-800 font-semibold'
                      )}
                    >
                      {dayNum}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Room Rows with Booking Bars */}
          {loading && rooms.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading timeline matrix...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500">No rooms found in database.</div>
          ) : (
            rooms.map((room) => {
              const roomBookings = filteredBookings.filter((b) => b.roomId === room.id);

              return (
                <div
                  key={room.id}
                  className="flex border-b border-slate-200/80 min-h-[46px] sm:min-h-[50px] h-[48px] sm:h-[52px] relative group/row hover:bg-slate-50/40"
                >
                  {/* Left Frozen Sticky Room Info Cell - Room code only */}
                  <div
                    className="sticky left-0 z-20 w-[54px] sm:w-[60px] md:w-[68px] min-w-[54px] sm:min-w-[60px] md:min-w-[68px] bg-white group-hover/row:bg-slate-50/90 transition-colors p-1 sm:p-1.5 border-r border-slate-200 flex items-center justify-center shrink-0 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]"
                    title={`${room.roomNumber} - ${room.name} ($${Number(room.basePrice)}/night)`}
                  >
                    <span className="px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-bold bg-slate-900 text-white text-center shadow-2xs tracking-tight">
                      {room.roomNumber}
                    </span>
                  </div>

                  {/* Date Grid Area (Relative Container for day cells and absolute booking bars) */}
                  <div className="relative flex min-w-max">
                    {/* Day Cells (Click to add new booking) */}
                    {timelineDays.map((day) => {
                      const today = isToday(day);
                      return (
                        <div
                          key={day.toISOString()}
                          onClick={() => {
                            // Don't trigger cell click if user was dragging
                            if (draggedDistance > 5) return;
                            onCellClick(room, day);
                          }}
                          className={cn(
                            'w-[36px] sm:w-[42px] md:w-[48px] min-w-[36px] sm:min-w-[42px] md:min-w-[48px] border-r border-slate-200/60 relative cursor-pointer transition-colors shrink-0',
                            today ? 'bg-indigo-50/20' : '',
                            canEdit ? 'hover:bg-indigo-50/60' : '',
                            day.getDay() === 0 || day.getDay() === 6 ? 'bg-slate-50/30' : ''
                          )}
                          title={
                            canEdit
                              ? `Click to reserve ${room.roomNumber} (${room.name}) on ${day.toLocaleDateString()}`
                              : undefined
                          }
                        />
                      );
                    })}

                    {/* Booking Bars Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center p-1 z-10">
                      {roomBookings.map((b) => {
                        const checkInDate = new Date(b.checkIn);
                        const checkOutDate = new Date(b.checkOut);

                        const msPerDay = 1000 * 60 * 60 * 24;
                        const timelineStartMs = timelineStartDate.getTime();
                        const timelineEndMs = timelineEndDate.getTime();

                        if (
                          checkOutDate.getTime() <= timelineStartMs ||
                          checkInDate.getTime() >= timelineEndMs
                        ) {
                          return null;
                        }

                        const startOffsetDays = Math.max(
                          0,
                          (checkInDate.getTime() - timelineStartMs) / msPerDay
                        );
                        const endOffsetDays = Math.min(
                          viewDaysCount,
                          (checkOutDate.getTime() - timelineStartMs) / msPerDay
                        );

                        const widthPercent =
                          ((endOffsetDays - startOffsetDays) / viewDaysCount) * 100;
                        const leftPercent = (startOffsetDays / viewDaysCount) * 100;

                        const statusCfg = BOOKING_STATUS_CONFIG[b.status];
                        const nights = Math.max(
                          1,
                          Math.round((checkOutDate.getTime() - checkInDate.getTime()) / msPerDay)
                        );

                        return (
                          <div
                            key={b.id}
                            id={`booking-bar-${b.id}`}
                            onClick={(e) => {
                              if (draggedDistance > 5) return;
                              onBookingClick(e, b);
                            }}
                            style={{
                              left: `${leftPercent}%`,
                              width: `${Math.max(widthPercent, 2)}%`,
                            }}
                            className={cn(
                              'absolute h-[34px] sm:h-[36px] rounded-lg pointer-events-auto cursor-pointer px-1.5 sm:px-2 shadow-xs transition-all flex flex-col justify-center overflow-hidden border border-white/20 hover:brightness-95 hover:z-30 hover:shadow-md group/bar',
                              statusCfg.barBg,
                              statusCfg.barText
                            )}
                            title={`${b.guestName} (${nights} nights, $${Number(b.totalAmount).toLocaleString()}) - Click to view/edit`}
                          >
                            <div className="w-full min-w-0">
                              <div className="truncate text-[10px] sm:text-[11px] font-bold leading-tight flex items-center gap-1">
                                {b.source === 'AIRBNB' && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-rose-300 ring-1 ring-white/80 shrink-0 inline-block"
                                    title="Airbnb Reservation"
                                  />
                                )}
                                {b.source === 'BOOKING_COM' && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-sky-300 ring-1 ring-white/80 shrink-0 inline-block"
                                    title="Booking.com Reservation"
                                  />
                                )}
                                {b.source === 'OTHER' && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-purple-300 ring-1 ring-white/80 shrink-0 inline-block"
                                    title="External Channel Reservation"
                                  />
                                )}
                                <span className="truncate">{b.guestName}</span>
                              </div>
                              <div className="truncate text-[8.5px] sm:text-[9.5px] opacity-90 leading-tight font-medium flex items-center gap-1">
                                <span>{nights}n</span>
                                <span>•</span>
                                <span>${Number(b.totalAmount).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Bottom spacer for viewport clearance inside internal scroll container */}
          <div className="h-[50vh]" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};
