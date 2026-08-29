/**
 * Villa Inlet PMS - Shared Analytics & Revenue Management Engine
 * Calculates hospitality KPI metrics: Occupancy Rate, ADR, RevPAR, Booking Pace, Channel Mix, and Revenue over Time.
 */

export interface RawBookingData {
  id: string;
  roomId?: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  checkIn: Date | string;
  checkOut: Date | string;
  numGuests: number;
  totalAmount: number | string | any;
  amountPaid?: number | string | any;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'COMPLETED' | string;
  source: 'DIRECT' | 'AIRBNB' | 'BOOKING_COM' | 'OTHER' | string;
  createdAt: Date | string;
  room?: {
    id: string;
    roomNumber: string;
    name: string;
    basePrice?: number | string | any;
  } | null;
}

export interface RawRoomData {
  id: string;
  roomNumber: string;
  name: string;
  basePrice: number | string | any;
  status?: string;
}

export interface ChannelMixItem {
  source: string;
  label: string;
  count: number;
  percentage: number;
  revenue: number;
  revenuePercentage: number;
  color: string;
}

export interface BookingPaceItem {
  leadTimeBucket: string;
  label: string;
  count: number;
  revenue: number;
  avgLeadDays: number;
}

export interface RevenueTimelineItem {
  periodKey: string; // e.g. "2026-08" or "Aug 2026" or "2026-08-15"
  label: string;
  revenue: number;
  roomNights: number;
  bookingsCount: number;
  occupancyRate: number;
  adr: number;
}

export interface RoomPerformanceItem {
  roomId: string;
  roomNumber: string;
  roomName: string;
  totalBookings: number;
  roomNights: number;
  revenue: number;
  occupancyRate: number;
  adr: number;
}

export interface ReportMetricsResult {
  dateRange: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  summary: {
    totalRooms: number;
    availableRoomNights: number;
    bookedRoomNights: number;
    occupancyRate: number; // 0 to 100 percentage
    totalRevenue: number;
    adr: number; // Average Daily Rate ($)
    revPar: number; // Revenue Per Available Room ($)
    confirmedBookingsCount: number;
    pendingBookingsCount: number;
    cancelledBookingsCount: number;
    averageLengthOfStay: number;
    averageBookingValue: number;
  };
  channelMix: ChannelMixItem[];
  bookingPace: BookingPaceItem[];
  revenueTimeline: RevenueTimelineItem[];
  roomPerformance: RoomPerformanceItem[];
  rawBookings: Array<{
    id: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    roomNumber: string;
    roomName: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    totalAmount: number;
    status: string;
    source: string;
    createdAt: string;
  }>;
}

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
  DIRECT: { label: 'Direct Booking', color: '#4f46e5' }, // Indigo
  AIRBNB: { label: 'Airbnb', color: '#f43f5e' }, // Rose
  BOOKING_COM: { label: 'Booking.com', color: '#0284c7' }, // Sky/Blue
  OTHER: { label: 'Other / Partner', color: '#8b5cf6' }, // Violet
};

/**
 * Calculates overlap nights between a booking [bStart, bEnd] and a target range [rStart, rEnd].
 */
export function calculateOverlappingNights(
  bookingCheckIn: Date,
  bookingCheckOut: Date,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const start = Math.max(bookingCheckIn.getTime(), rangeStart.getTime());
  const end = Math.min(bookingCheckOut.getTime(), rangeEnd.getTime());

  if (end <= start) return 0;
  const diffMs = end - start;
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Total nights of a booking.
 */
export function getBookingNights(checkIn: Date, checkOut: Date): number {
  const diffMs = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Core mathematical engine computing hospitality metrics for Villa Inlet.
 */
export function calculateReportMetrics(
  bookings: RawBookingData[],
  rooms: RawRoomData[],
  startDateInput: string | Date,
  endDateInput: string | Date
): ReportMetricsResult {
  const rangeStart = new Date(startDateInput);
  rangeStart.setUTCHours(0, 0, 0, 0);

  const rangeEnd = new Date(endDateInput);
  rangeEnd.setUTCHours(23, 59, 59, 999);

  // Total calendar days in selected range (inclusive)
  const diffDays = Math.max(
    1,
    Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24))
  );

  const totalRooms = Math.max(1, rooms.length);
  const totalAvailableRoomNights = totalRooms * diffDays;

  // Filter bookings that intersect with range
  const relevantBookings = bookings.filter((b) => {
    const bIn = new Date(b.checkIn);
    const bOut = new Date(b.checkOut);
    return bIn < rangeEnd && bOut > rangeStart;
  });

  let totalConfirmedRevenue = 0;
  let totalBookedRoomNights = 0;
  let confirmedBookingsCount = 0;
  let pendingBookingsCount = 0;
  let cancelledBookingsCount = 0;
  let totalStayNightsSum = 0;

  const channelMap: Record<string, { count: number; revenue: number }> = {
    DIRECT: { count: 0, revenue: 0 },
    AIRBNB: { count: 0, revenue: 0 },
    BOOKING_COM: { count: 0, revenue: 0 },
    OTHER: { count: 0, revenue: 0 },
  };

  // Lead time buckets for booking pace
  const paceBuckets = [
    { key: 'LAST_MINUTE', label: 'Last Minute (0-3 days)', min: 0, max: 3, count: 0, revenue: 0, totalDays: 0 },
    { key: 'SHORT', label: 'Short Notice (4-7 days)', min: 4, max: 7, count: 0, revenue: 0, totalDays: 0 },
    { key: 'MEDIUM', label: 'Moderate (8-21 days)', min: 8, max: 21, count: 0, revenue: 0, totalDays: 0 },
    { key: 'ADVANCE', label: 'Advance (22-45 days)', min: 22, max: 45, count: 0, revenue: 0, totalDays: 0 },
    { key: 'LONG_RANGE', label: 'Long Range (46+ days)', min: 46, max: 9999, count: 0, revenue: 0, totalDays: 0 },
  ];

  // Room performance accumulator
  const roomMap: Record<
    string,
    {
      roomId: string;
      roomNumber: string;
      roomName: string;
      totalBookings: number;
      roomNights: number;
      revenue: number;
    }
  > = {};

  for (const r of rooms) {
    roomMap[r.id] = {
      roomId: r.id,
      roomNumber: r.roomNumber,
      roomName: r.name,
      totalBookings: 0,
      roomNights: 0,
      revenue: 0,
    };
  }

  // Monthly / Period revenue timeline accumulator
  const timelineMap: Record<
    string,
    {
      label: string;
      revenue: number;
      roomNights: number;
      bookingsCount: number;
    }
  > = {};

  const rawBookingsExport: ReportMetricsResult['rawBookings'] = [];

  for (const booking of relevantBookings) {
    const checkInDate = new Date(booking.checkIn);
    const checkOutDate = new Date(booking.checkOut);
    const createdDate = new Date(booking.createdAt);
    const fullStayNights = getBookingNights(checkInDate, checkOutDate);
    const overlapNights = calculateOverlappingNights(checkInDate, checkOutDate, rangeStart, rangeEnd);
    const bookingTotal = Number(booking.totalAmount) || 0;

    // Prorated revenue attributed to this date range
    const proratedRevenue = fullStayNights > 0 ? (bookingTotal / fullStayNights) * overlapNights : bookingTotal;

    const isConfirmedOrCompleted =
      booking.status === 'CONFIRMED' || booking.status === 'COMPLETED';

    if (booking.status === 'CANCELLED') {
      cancelledBookingsCount++;
    } else if (booking.status === 'PENDING') {
      pendingBookingsCount++;
    }

    if (isConfirmedOrCompleted) {
      confirmedBookingsCount++;
      totalConfirmedRevenue += proratedRevenue;
      totalBookedRoomNights += overlapNights;
      totalStayNightsSum += fullStayNights;

      // Channel Mix
      const src = booking.source || 'DIRECT';
      if (!channelMap[src]) {
        channelMap[src] = { count: 0, revenue: 0 };
      }
      channelMap[src].count += 1;
      channelMap[src].revenue += proratedRevenue;

      // Booking Pace (Lead time in days = checkIn - createdAt)
      const leadTimeDays = Math.max(
        0,
        Math.round((checkInDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
      );

      for (const bucket of paceBuckets) {
        if (leadTimeDays >= bucket.min && leadTimeDays <= bucket.max) {
          bucket.count += 1;
          bucket.revenue += proratedRevenue;
          bucket.totalDays += leadTimeDays;
          break;
        }
      }

      // Room performance
      const rId = booking.room?.id || booking.roomId;
      if (rId && roomMap[rId]) {
        roomMap[rId].totalBookings += 1;
        roomMap[rId].roomNights += overlapNights;
        roomMap[rId].revenue += proratedRevenue;
      }

      // Timeline aggregation by Month (YYYY-MM)
      const monthKey = `${checkInDate.getUTCFullYear()}-${String(checkInDate.getUTCMonth() + 1).padStart(2, '0')}`;
      const monthLabel = checkInDate.toLocaleString('default', { month: 'short', year: 'numeric', timeZone: 'UTC' });

      if (!timelineMap[monthKey]) {
        timelineMap[monthKey] = {
          label: monthLabel,
          revenue: 0,
          roomNights: 0,
          bookingsCount: 0,
        };
      }
      timelineMap[monthKey].revenue += proratedRevenue;
      timelineMap[monthKey].roomNights += overlapNights;
      timelineMap[monthKey].bookingsCount += 1;
    }

    rawBookingsExport.push({
      id: booking.id,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone || '',
      roomNumber: booking.room?.roomNumber || 'N/A',
      roomName: booking.room?.name || 'Villa Inlet Room',
      checkIn: checkInDate.toISOString().split('T')[0],
      checkOut: checkOutDate.toISOString().split('T')[0],
      nights: fullStayNights,
      totalAmount: Math.round(bookingTotal * 100) / 100,
      status: booking.status,
      source: booking.source,
      createdAt: createdDate.toISOString().split('T')[0],
    });
  }

  // 1. Occupancy Rate = booked room-nights / (5 rooms × nights in range)
  const occupancyRate =
    totalAvailableRoomNights > 0
      ? Math.min(100, Math.round((totalBookedRoomNights / totalAvailableRoomNights) * 1000) / 10)
      : 0;

  // 2. ADR = total confirmed booking revenue / total booked room-nights
  const adr =
    totalBookedRoomNights > 0
      ? Math.round((totalConfirmedRevenue / totalBookedRoomNights) * 100) / 100
      : 0;

  // 3. RevPAR = total confirmed booking revenue / (5 rooms × nights in range)
  const revPar =
    totalAvailableRoomNights > 0
      ? Math.round((totalConfirmedRevenue / totalAvailableRoomNights) * 100) / 100
      : 0;

  const averageLengthOfStay =
    confirmedBookingsCount > 0
      ? Math.round((totalStayNightsSum / confirmedBookingsCount) * 10) / 10
      : 0;

  const averageBookingValue =
    confirmedBookingsCount > 0
      ? Math.round((totalConfirmedRevenue / confirmedBookingsCount) * 100) / 100
      : 0;

  // 4. Format Channel Mix
  const totalMixBookings = Object.values(channelMap).reduce((acc, curr) => acc + curr.count, 0) || 1;
  const channelMix: ChannelMixItem[] = Object.keys(channelMap).map((src) => {
    const item = channelMap[src];
    const cfg = CHANNEL_LABELS[src] || { label: src, color: '#64748b' };
    return {
      source: src,
      label: cfg.label,
      count: item.count,
      percentage: Math.round((item.count / totalMixBookings) * 1000) / 10,
      revenue: Math.round(item.revenue * 100) / 100,
      revenuePercentage:
        totalConfirmedRevenue > 0
          ? Math.round((item.revenue / totalConfirmedRevenue) * 1000) / 10
          : 0,
      color: cfg.color,
    };
  });

  // 5. Format Booking Pace
  const bookingPace: BookingPaceItem[] = paceBuckets.map((b) => ({
    leadTimeBucket: b.key,
    label: b.label,
    count: b.count,
    revenue: Math.round(b.revenue * 100) / 100,
    avgLeadDays: b.count > 0 ? Math.round((b.totalDays / b.count) * 10) / 10 : 0,
  }));

  // 6. Format Revenue Timeline
  const revenueTimeline: RevenueTimelineItem[] = Object.keys(timelineMap)
    .sort()
    .map((key) => {
      const entry = timelineMap[key];
      const periodDays = 30; // standard month baseline
      const availablePeriodNights = totalRooms * periodDays;
      return {
        periodKey: key,
        label: entry.label,
        revenue: Math.round(entry.revenue * 100) / 100,
        roomNights: entry.roomNights,
        bookingsCount: entry.bookingsCount,
        occupancyRate:
          availablePeriodNights > 0
            ? Math.min(100, Math.round((entry.roomNights / availablePeriodNights) * 1000) / 10)
            : 0,
        adr: entry.roomNights > 0 ? Math.round((entry.revenue / entry.roomNights) * 100) / 100 : 0,
      };
    });

  // 7. Format Room Performance
  const roomPerformance: RoomPerformanceItem[] = Object.values(roomMap).map((rm) => {
    const roomAvailableNights = diffDays;
    const occ =
      roomAvailableNights > 0
        ? Math.min(100, Math.round((rm.roomNights / roomAvailableNights) * 1000) / 10)
        : 0;
    const roomAdr = rm.roomNights > 0 ? Math.round((rm.revenue / rm.roomNights) * 100) / 100 : 0;
    return {
      roomId: rm.roomId,
      roomNumber: rm.roomNumber,
      roomName: rm.roomName,
      totalBookings: rm.totalBookings,
      roomNights: rm.roomNights,
      revenue: Math.round(rm.revenue * 100) / 100,
      occupancyRate: occ,
      adr: roomAdr,
    };
  });

  return {
    dateRange: {
      startDate: rangeStart.toISOString().split('T')[0],
      endDate: rangeEnd.toISOString().split('T')[0],
      totalDays: diffDays,
    },
    summary: {
      totalRooms,
      availableRoomNights: totalAvailableRoomNights,
      bookedRoomNights: totalBookedRoomNights,
      occupancyRate,
      totalRevenue: Math.round(totalConfirmedRevenue * 100) / 100,
      adr,
      revPar,
      confirmedBookingsCount,
      pendingBookingsCount,
      cancelledBookingsCount,
      averageLengthOfStay,
      averageBookingValue,
    },
    channelMix,
    bookingPace,
    revenueTimeline,
    roomPerformance,
    rawBookings: rawBookingsExport,
  };
}
