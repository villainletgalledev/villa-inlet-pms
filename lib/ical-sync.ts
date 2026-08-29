import nodeIcal from 'node-ical';
import { getPrisma } from './prisma';

export interface SyncResult {
  success: boolean;
  feedId: string;
  feedLabel: string;
  countProcessed: number;
  countCreated: number;
  countUpdated: number;
  countCancelled: number;
  conflictsCount: number;
  error?: string;
}

/**
 * Synchronizes a single ExternalCalendarFeed row:
 * 1. Fetches remote ICS feed from feedUrl
 * 2. Parses events using node-ical
 * 3. Detects conflicts with DIRECT bookings on same room and overlapping dates
 * 4. Upserts OTA bookings (matches by externalUid)
 * 5. Marks removed events as CANCELLED
 * 6. Updates feed sync status and timestamp
 */
export async function syncCalendarFeed(feedId: string): Promise<SyncResult> {
  const prisma = getPrisma();
  const feed = await prisma.externalCalendarFeed.findUnique({
    where: { id: feedId },
    include: { room: true },
  });

  if (!feed) {
    return {
      success: false,
      feedId,
      feedLabel: 'Unknown Feed',
      countProcessed: 0,
      countCreated: 0,
      countUpdated: 0,
      countCancelled: 0,
      conflictsCount: 0,
      error: 'Calendar feed record not found in database.',
    };
  }

  if (!feed.feedUrl || !feed.feedUrl.trim()) {
    await prisma.externalCalendarFeed.update({
      where: { id: feedId },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: 'FAILED',
        lastSyncError: 'No Feed URL configured for this calendar feed.',
      },
    });

    return {
      success: false,
      feedId,
      feedLabel: feed.label,
      countProcessed: 0,
      countCreated: 0,
      countUpdated: 0,
      countCancelled: 0,
      conflictsCount: 0,
      error: 'No Feed URL configured.',
    };
  }

  try {
    // 1. Fetch remote ICS text with reasonable timeout and standard User-Agent
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    let rawIcsText = '';
    try {
      const response = await fetch(feed.feedUrl.trim(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Villa-Inlet-PMS-iCal-Sync/1.0 (+https://villainletgalle.com)',
          Accept: 'text/calendar, text/plain, */*',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      rawIcsText = await response.text();
    } finally {
      clearTimeout(timeoutId);
    }

    if (!rawIcsText || !rawIcsText.includes('BEGIN:VCALENDAR')) {
      throw new Error('Remote response is not a valid iCal/VCALENDAR payload.');
    }

    // 2. Parse ICS content using node-ical
    const parsedData = nodeIcal.sync.parseICS(rawIcsText);
    const events: Array<{
      uid: string;
      start: Date;
      end: Date;
      summary: string;
      description?: string;
    }> = [];

    for (const key in parsedData) {
      if (Object.prototype.hasOwnProperty.call(parsedData, key)) {
        const item = parsedData[key];
        if (item.type === 'VEVENT') {
          const uid = String(item.uid || key).trim();
          if (!uid) continue;

          let startDate = item.start ? new Date(item.start) : null;
          let endDate = item.end ? new Date(item.end) : null;

          if (!startDate || isNaN(startDate.getTime())) continue;

          // If end date is missing or invalid, default to 1 night stay
          if (!endDate || isNaN(endDate.getTime())) {
            endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
          }

          // In iCal standard, single-day or all-day events might have end == start
          if (endDate.getTime() <= startDate.getTime()) {
            endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
          }

          events.push({
            uid,
            start: startDate,
            end: endDate,
            summary: item.summary ? String(item.summary).trim() : 'OTA Reservation',
            description: item.description ? String(item.description).trim() : '',
          });
        }
      }
    }

    // Determine target room: use feed.roomId or default to first available room
    let targetRoomId = feed.roomId;
    if (!targetRoomId) {
      const firstRoom = await prisma.room.findFirst({
        orderBy: { roomNumber: 'asc' },
      });
      if (firstRoom) {
        targetRoomId = firstRoom.id;
      } else {
        throw new Error('No rooms exist in PMS to assign inbound bookings.');
      }
    }

    let countCreated = 0;
    let countUpdated = 0;
    let conflictsCount = 0;
    const currentFeedUids = new Set<string>();

    // 3. Process each event
    for (const ev of events) {
      currentFeedUids.add(ev.uid);

      // Check for overlap with DIRECT bookings on the target room
      const directConflicts = await prisma.booking.findMany({
        where: {
          roomId: targetRoomId,
          status: 'CONFIRMED',
          source: 'DIRECT',
          AND: [
            { checkIn: { lt: ev.end } },
            { checkOut: { gt: ev.start } },
          ],
        },
      });

      if (directConflicts.length > 0) {
        // Direct booking exists on these dates! Do not displace direct booking.
        conflictsCount++;
        const conflictingBooking = directConflicts[0];

        // Record or update SyncConflict
        const existingConflict = await prisma.syncConflict.findFirst({
          where: {
            feedId: feed.id,
            externalUid: ev.uid,
            resolved: false,
          },
        });

        const conflictSummary = `Inbound reservation (${ev.start.toISOString().split('T')[0]} to ${ev.end.toISOString().split('T')[0]}) overlaps with Direct booking #${conflictingBooking.id.slice(0, 8)} (${conflictingBooking.guestName}).`;

        if (existingConflict) {
          await prisma.syncConflict.update({
            where: { id: existingConflict.id },
            data: {
              checkIn: ev.start,
              checkOut: ev.end,
              conflictingBookingId: conflictingBooking.id,
              roomId: targetRoomId,
              summary: conflictSummary,
            },
          });
        } else {
          await prisma.syncConflict.create({
            data: {
              feedId: feed.id,
              externalUid: ev.uid,
              roomId: targetRoomId,
              conflictingBookingId: conflictingBooking.id,
              summary: conflictSummary,
              checkIn: ev.start,
              checkOut: ev.end,
              resolved: false,
            },
          });
        }

        // Skip creating/overwriting confirmed booking to preserve direct reservation
        continue;
      }

      // No direct conflict. Check if booking with externalUid already exists
      const existingBooking = await prisma.booking.findUnique({
        where: { externalUid: ev.uid },
      });

      const sourceEnum =
        feed.source === 'BOOKING_COM'
          ? 'BOOKING_COM'
          : feed.source === 'AIRBNB'
          ? 'AIRBNB'
          : 'OTHER';

      if (existingBooking) {
        // Update booking dates and status if changed
        await prisma.booking.update({
          where: { id: existingBooking.id },
          data: {
            checkIn: ev.start,
            checkOut: ev.end,
            roomId: targetRoomId,
            status: 'CONFIRMED',
            source: sourceEnum,
            externalFeedId: feed.id,
            notes: `Synced from ${feed.label}${ev.description ? ` - ${ev.description}` : ''}`,
          },
        });
        countUpdated++;
      } else {
        // Create new confirmed booking from feed
        await prisma.booking.create({
          data: {
            roomId: targetRoomId,
            guestName: 'OTA Guest',
            guestEmail: 'ota@villainlet.com',
            guestPhone: '',
            checkIn: ev.start,
            checkOut: ev.end,
            numGuests: 1,
            totalAmount: 0,
            amountPaid: 0,
            status: 'CONFIRMED',
            source: sourceEnum,
            externalUid: ev.uid,
            externalFeedId: feed.id,
            notes: `Inbound sync from ${feed.label}${ev.description ? ` - ${ev.description}` : ''}`,
          },
        });
        countCreated++;
      }
    }

    // 4. Handle disappearing UIDs: If a previously synced booking from this feed
    // is no longer in the remote feed, mark it CANCELLED
    const previouslySyncedBookings = await prisma.booking.findMany({
      where: {
        externalFeedId: feed.id,
        status: { not: 'CANCELLED' },
      },
    });

    let countCancelled = 0;
    for (const b of previouslySyncedBookings) {
      if (b.externalUid && !currentFeedUids.has(b.externalUid)) {
        await prisma.booking.update({
          where: { id: b.id },
          data: {
            status: 'CANCELLED',
            notes: `${b.notes || ''} [Cancelled: removed from remote ${feed.label} feed on ${new Date().toISOString().split('T')[0]}]`,
          },
        });
        countCancelled++;
      }
    }

    // 5. Update feed record with SUCCESS status
    await prisma.externalCalendarFeed.update({
      where: { id: feed.id },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: 'SUCCESS',
        lastSyncError: null,
      },
    });

    return {
      success: true,
      feedId: feed.id,
      feedLabel: feed.label,
      countProcessed: events.length,
      countCreated,
      countUpdated,
      countCancelled,
      conflictsCount,
    };
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    console.error(`iCal sync failed for feed "${feed.label}" (${feed.id}):`, errorMessage);

    await prisma.externalCalendarFeed.update({
      where: { id: feed.id },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: 'FAILED',
        lastSyncError: errorMessage,
      },
    });

    return {
      success: false,
      feedId: feed.id,
      feedLabel: feed.label,
      countProcessed: 0,
      countCreated: 0,
      countUpdated: 0,
      countCancelled: 0,
      conflictsCount: 0,
      error: errorMessage,
    };
  }
}

/**
 * Syncs all active ExternalCalendarFeed rows in sequence.
 * Gracefully does nothing if no feeds exist.
 */
export async function syncAllActiveFeeds(): Promise<{
  syncedFeeds: number;
  results: SyncResult[];
}> {
  const prisma = getPrisma();
  const feeds = await prisma.externalCalendarFeed.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (feeds.length === 0) {
    return {
      syncedFeeds: 0,
      results: [],
    };
  }

  const results: SyncResult[] = [];
  for (const feed of feeds) {
    const result = await syncCalendarFeed(feed.id);
    results.push(result);
  }

  return {
    syncedFeeds: feeds.length,
    results,
  };
}
