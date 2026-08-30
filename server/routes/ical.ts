import express, { Request, Response } from 'express';
import * as icalGeneratorModule from 'ical-generator';
import { getPrisma } from '../../lib/prisma';
import { authenticateRequest, requireAuth } from '../auth';
import { isOwnerOrManager } from '../../lib/rbac';
import { syncCalendarFeed, syncAllActiveFeeds } from '../../lib/ical-sync';

// Robust interop: handle both default export, named export, and double-wrapped __toESM objects
const getIcalGenerator = (): typeof icalGeneratorModule.default => {
  const mod: any = icalGeneratorModule;
  if (typeof mod === 'function') return mod;
  if (typeof mod.default === 'function') return mod.default;
  if (mod.default && typeof mod.default.default === 'function') return mod.default.default;
  if (typeof mod.ICalCalendar === 'function') {
    return (data: any) => new mod.ICalCalendar(data);
  }
  throw new Error('Unable to resolve ical-generator constructor function');
};

const ICalEventBusyStatus = (icalGeneratorModule as any).ICalEventBusyStatus || { BUSY: 'BUSY', FREE: 'FREE' };
const ICalEventTransparency = (icalGeneratorModule as any).ICalEventTransparency || { OPAQUE: 'OPAQUE', TRANSPARENT: 'TRANSPARENT' };

const router = express.Router();

// Fallback default token if environment variable is not explicitly populated
const DEFAULT_FEED_SECRET = 'villa_inlet_feed_secret_default';

/**
 * Resolves the configured base URL for outbound feeds.
 * Priority: ICAL_BASE_URL > NEXT_PUBLIC_APP_URL > APP_URL > request Host header
 */
function resolveBaseUrl(req: Request): string {
  if (process.env.ICAL_BASE_URL && process.env.ICAL_BASE_URL.trim()) {
    return process.env.ICAL_BASE_URL.trim().replace(/\/+$/, '');
  }
  if (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/+$/, '');
  }
  if (process.env.APP_URL && process.env.APP_URL.trim()) {
    return process.env.APP_URL.trim().replace(/\/+$/, '');
  }

  // Fallback to request host
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  return `${protocol}://${host}`;
}

/**
 * Resolves the secret token for outbound iCal feeds.
 */
function resolveFeedSecret(): string {
  return (process.env.ICAL_FEED_SECRET && process.env.ICAL_FEED_SECRET.trim()) || DEFAULT_FEED_SECRET;
}

// ==========================================
// PART 1: PUBLIC OUTBOUND iCal FEED ENDPOINTS
// ==========================================

/**
 * Public, token-protected iCal export endpoint:
 * GET /api/ical/:token (or /api/ical/:token.ics)
 *
 * Generates an RFC 5545 compliant ICS calendar of all CONFIRMED reservations.
 * SUMMARY is strictly "Reserved" with zero guest PII.
 * Works standalone even with zero ExternalCalendarFeed rows configured.
 */
async function handleOutboundFeed(req: Request, res: Response) {
  const rawTokenParam = req.params.token || '';
  // Strip optional .ics extension if present in token parameter
  const cleanToken = rawTokenParam.replace(/\.ics$/i, '').trim();
  const queryToken = (req.query.token as string)?.trim();
  const token = cleanToken || queryToken;

  const expectedSecret = resolveFeedSecret();

  if (!token || token !== expectedSecret) {
    res.status(401);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send('Unauthorized: Invalid or missing iCal feed token.');
  }

  const { roomId } = req.query;

  try {
    const prisma = getPrisma();
    const whereClause: any = {
      status: 'CONFIRMED',
    };

    if (roomId && typeof roomId === 'string' && roomId !== 'ALL') {
      whereClause.roomId = roomId;
    }

    const confirmedBookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        room: {
          select: {
            id: true,
            name: true,
            roomNumber: true,
          },
        },
      },
      orderBy: { checkIn: 'asc' },
    });

    const createCalendar = getIcalGenerator();
    const calendar = createCalendar({
      name: 'Villa Inlet PMS - Outbound Calendar',
      description: 'Synchronized reservation calendar for Villa Inlet Galle',
      prodId: '//Villa Inlet PMS//Outbound iCal Feed//EN',
      timezone: 'Asia/Colombo',
      url: `${resolveBaseUrl(req)}/api/ical/${expectedSecret}.ics`,
    });

    for (const booking of confirmedBookings) {
      // Outbound feed: UID = booking id, DTSTART = checkIn, DTEND = checkOut, SUMMARY = "Reserved" (no guest PII)
      calendar.createEvent({
        id: booking.id,
        start: new Date(booking.checkIn),
        end: new Date(booking.checkOut),
        allDay: true,
        summary: 'Reserved',
        description: 'Villa Inlet Confirmed Reservation',
        location: `Villa Inlet - ${booking.room?.name || 'Suite'} (${booking.room?.roomNumber || 'Villa'})`,
        busystatus: ICalEventBusyStatus.BUSY,
        transparency: ICalEventTransparency.OPAQUE,
      });
    }

    const icsContent = calendar.toString();

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="villa-inlet-calendar.ics"');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300'); // Cache for 5 minutes
    return res.send(icsContent);
  } catch (err: any) {
    console.error('Error generating outbound iCal feed:', err);
    res.status(500);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send('Internal server error generating iCal feed.');
  }
}

// Support both /:token and /:token.ics patterns
router.get('/:token.ics', handleOutboundFeed);
router.get('/:token', (req, res, next) => {
  // If the parameter is a known sub-route, pass to next handlers
  const reservedPaths = ['feeds', 'sync', 'conflicts', 'info', 'cron'];
  if (reservedPaths.includes(req.params.token)) {
    return next();
  }
  return handleOutboundFeed(req, res);
});

// ==========================================
// PART 2: CRON SYNC ENDPOINT
// ==========================================

/**
 * Scheduled cron route for daily/hourly sync:
 * GET or POST /api/ical/cron/sync-all or /api/cron/sync-ical
 * Protected with CRON_SECRET authorization header or secret query parameter.
 * Gracefully handles 0 feeds without error.
 */
async function handleCronSync(req: Request, res: Response) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const authHeader = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    const querySecret = (req.query.secret as string)?.trim();

    if (bearerToken !== cronSecret && querySecret !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized: Invalid CRON_SECRET.' });
    }
  }

  try {
    const result = await syncAllActiveFeeds();
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      syncedFeeds: result.syncedFeeds,
      results: result.results,
      message: result.syncedFeeds === 0 ? 'No active calendar feeds configured' : `Successfully synchronized ${result.syncedFeeds} active feeds.`,
    });
  } catch (err: any) {
    console.error('Cron iCal sync error:', err);
    return res.status(500).json({ error: err?.message || 'Cron sync failed' });
  }
}

router.get('/cron/sync-all', handleCronSync);
router.post('/cron/sync-all', handleCronSync);

// ==========================================
// PART 3: SETTINGS & FEED MANAGEMENT ROUTES
// ==========================================

/**
 * GET /api/ical/info
 * Returns outbound feed URL, base URL, and configuration status.
 */
router.get('/info', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller || !isOwnerOrManager(caller.role)) {
    return res.status(401).json({ error: 'Unauthorized: Owner or Manager access required.' });
  }

  const baseUrl = resolveBaseUrl(req);
  const secret = resolveFeedSecret();
  const isCustomSecretConfigured = Boolean(process.env.ICAL_FEED_SECRET && process.env.ICAL_FEED_SECRET.trim());

  return res.json({
    baseUrl,
    feedSecret: secret,
    feedUrl: `${baseUrl}/api/ical/${secret}.ics`,
    isCustomSecretConfigured,
    cronSchedule: '0 3 * * * (Daily at 03:00 UTC)',
  });
});

/**
 * GET /api/ical/feeds
 * Lists all ExternalCalendarFeed records with counts and sync conflicts.
 */
router.get('/feeds', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller || !isOwnerOrManager(caller.role)) {
    return res.status(401).json({ error: 'Unauthorized: Owner or Manager access required.' });
  }

  try {
    const prisma = getPrisma();
    const feeds = await prisma.externalCalendarFeed.findMany({
      include: {
        room: {
          select: {
            id: true,
            name: true,
            roomNumber: true,
          },
        },
        _count: {
          select: {
            bookings: true,
            conflicts: {
              where: { resolved: false },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const conflicts = await prisma.syncConflict.findMany({
      where: { resolved: false },
      include: {
        feed: true,
        room: true,
        conflictingBooking: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ feeds, conflicts });
  } catch (err: any) {
    console.error('Error fetching calendar feeds:', err);
    return res.status(500).json({ error: 'Failed to retrieve calendar feeds.' });
  }
});

/**
 * POST /api/ical/feeds
 * Creates a new ExternalCalendarFeed.
 */
router.post('/feeds', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller || !isOwnerOrManager(caller.role)) {
    return res.status(401).json({ error: 'Unauthorized: Owner or Manager access required.' });
  }

  const { source, label, feedUrl, roomId, isActive } = req.body;

  if (!label || !label.trim()) {
    return res.status(400).json({ error: 'Feed label is required.' });
  }

  const validSources = ['AIRBNB', 'BOOKING_COM', 'OTHER'];
  const feedSource = validSources.includes(source) ? source : 'AIRBNB';

  try {
    const prisma = getPrisma();
    const feed = await prisma.externalCalendarFeed.create({
      data: {
        source: feedSource as any,
        label: label.trim(),
        feedUrl: feedUrl && feedUrl.trim() ? feedUrl.trim() : null,
        roomId: roomId && roomId !== 'ALL' ? roomId : null,
        isActive: isActive !== false,
        lastSyncStatus: 'NEVER_SYNCED',
      },
      include: { room: true },
    });

    // If feedUrl is provided and active, trigger initial sync in background
    let initialSyncResult = null;
    if (feed.feedUrl && feed.isActive) {
      try {
        initialSyncResult = await syncCalendarFeed(feed.id);
      } catch (syncErr) {
        console.warn('Initial feed sync error:', syncErr);
      }
    }

    return res.status(201).json({
      feed,
      initialSyncResult,
      message: 'Calendar feed connected successfully.',
    });
  } catch (err: any) {
    console.error('Error creating calendar feed:', err);
    return res.status(500).json({ error: 'Failed to create calendar feed.' });
  }
});

/**
 * PATCH /api/ical/feeds/:id
 * Updates an existing feed configuration.
 */
router.patch('/feeds/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller || !isOwnerOrManager(caller.role)) {
    return res.status(401).json({ error: 'Unauthorized: Owner or Manager access required.' });
  }

  const { id } = req.params;
  const { source, label, feedUrl, roomId, isActive } = req.body;

  try {
    const prisma = getPrisma();
    const updateData: any = {};

    if (source !== undefined) updateData.source = source;
    if (label !== undefined) updateData.label = label.trim();
    if (feedUrl !== undefined) updateData.feedUrl = feedUrl ? feedUrl.trim() : null;
    if (roomId !== undefined) updateData.roomId = roomId && roomId !== 'ALL' ? roomId : null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updatedFeed = await prisma.externalCalendarFeed.update({
      where: { id },
      data: updateData,
      include: { room: true },
    });

    return res.json({ feed: updatedFeed, message: 'Feed updated successfully.' });
  } catch (err: any) {
    console.error('Error updating calendar feed:', err);
    return res.status(500).json({ error: 'Failed to update calendar feed.' });
  }
});

/**
 * DELETE /api/ical/feeds/:id
 * Deletes a calendar feed and removes associated conflicts.
 */
router.delete('/feeds/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller || !isOwnerOrManager(caller.role)) {
    return res.status(401).json({ error: 'Unauthorized: Owner or Manager access required.' });
  }

  const { id } = req.params;

  try {
    const prisma = getPrisma();
    await prisma.externalCalendarFeed.delete({
      where: { id },
    });

    return res.json({ success: true, message: 'Calendar feed deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting calendar feed:', err);
    return res.status(500).json({ error: 'Failed to delete calendar feed.' });
  }
});

/**
 * POST /api/ical/sync/:feedId
 * On-demand manual sync endpoint for a single feed.
 */
router.post('/sync/:feedId', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller || !isOwnerOrManager(caller.role)) {
    return res.status(401).json({ error: 'Unauthorized: Owner or Manager access required.' });
  }

  const { feedId } = req.params;

  try {
    const result = await syncCalendarFeed(feedId);
    return res.json({
      result,
      message: result.success
        ? `Feed synced: ${result.countProcessed} events parsed (${result.countCreated} created, ${result.countUpdated} updated, ${result.countCancelled} cancelled).`
        : `Sync failed: ${result.error}`,
    });
  } catch (err: any) {
    console.error('Manual sync error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to sync calendar feed.' });
  }
});

/**
 * GET /api/ical/conflicts
 * Returns all sync conflicts.
 */
router.get('/conflicts', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller || !isOwnerOrManager(caller.role)) {
    return res.status(401).json({ error: 'Unauthorized: Owner or Manager access required.' });
  }

  try {
    const prisma = getPrisma();
    const conflicts = await prisma.syncConflict.findMany({
      include: {
        feed: true,
        room: true,
        conflictingBooking: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ conflicts });
  } catch (err: any) {
    console.error('Error fetching conflicts:', err);
    return res.status(500).json({ error: 'Failed to retrieve sync conflicts.' });
  }
});

/**
 * POST /api/ical/conflicts/:id/resolve
 * Marks a sync conflict as resolved.
 */
router.post('/conflicts/:id/resolve', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller || !isOwnerOrManager(caller.role)) {
    return res.status(401).json({ error: 'Unauthorized: Owner or Manager access required.' });
  }

  const { id } = req.params;

  try {
    const prisma = getPrisma();
    const conflict = await prisma.syncConflict.update({
      where: { id },
      data: { resolved: true },
    });

    return res.json({ conflict, message: 'Conflict marked as resolved.' });
  } catch (err: any) {
    console.error('Error resolving conflict:', err);
    return res.status(500).json({ error: 'Failed to resolve conflict.' });
  }
});

export default router;
