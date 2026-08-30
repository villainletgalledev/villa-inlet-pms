import express from 'express';
import usersRouter from './routes/users';
import roomsRouter from './routes/rooms';
import bookingsRouter from './routes/bookings';
import housekeepingRouter from './routes/housekeeping';
import inventoryRouter from './routes/inventory';
import maintenanceRouter from './routes/maintenance';
import reportsRouter from './routes/reports';
import icalRouter from './routes/ical';
import { syncAllActiveFeeds } from '../lib/ical-sync';

export function createExpressApp() {
  const app = express();

  // JSON Body Parser Middleware (10mb for room photo uploads)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Villa Inlet PMS' });
  });

  // Dedicated cron endpoint for Vercel Cron
  app.all('/api/cron/sync-ical', async (req, res) => {
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
        message:
          result.syncedFeeds === 0
            ? 'No active calendar feeds configured'
            : `Successfully synchronized ${result.syncedFeeds} active feeds.`,
      });
    } catch (err: any) {
      console.error('Cron sync error:', err);
      return res.status(500).json({ error: err?.message || 'Cron sync failed' });
    }
  });

  // API Routes
  app.use('/api/users', usersRouter);
  app.use('/api/rooms', roomsRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/housekeeping', housekeepingRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/maintenance', maintenanceRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/ical', icalRouter);

  return app;
}
