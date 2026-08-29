import express, { Request, Response } from 'express';
import { getPrisma } from '../../lib/prisma';
import { isOwnerOrManager, UserRole } from '../../lib/rbac';
import { calculateReportMetrics } from '../../lib/analytics/reports';
import { authenticateRequest } from '../auth';

const router = express.Router();

// ----------------------------------------------------------------------
// GET /api/reports - Analytics & Hospitality KPIs (OWNER / MANAGER ONLY)
// ----------------------------------------------------------------------
router.get('/', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwnerOrManager(caller.role)) {
    return res.status(403).json({
      error: 'Permission Denied: Reports & Analytics are accessible to Owners and Managers only.',
    });
  }

  const prisma = getPrisma();
  try {
    // Determine default date range (current month, e.g. August 2026)
    const now = new Date();
    const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

    const startDateStr = (req.query.startDate as string) || defaultStart.toISOString().split('T')[0];
    const endDateStr = (req.query.endDate as string) || defaultEnd.toISOString().split('T')[0];

    // Fetch all bookings and rooms from database
    const [bookings, rooms] = await Promise.all([
      prisma.booking.findMany({
        include: {
          room: {
            select: {
              id: true,
              roomNumber: true,
              name: true,
              basePrice: true,
            },
          },
        },
        orderBy: { checkIn: 'asc' },
      }),
      prisma.room.findMany({
        select: {
          id: true,
          roomNumber: true,
          name: true,
          basePrice: true,
          status: true,
        },
        orderBy: { roomNumber: 'asc' },
      }),
    ]);

    // Use shared calculation logic from lib/analytics/reports.ts
    const metrics = calculateReportMetrics(
      bookings as any,
      rooms as any,
      startDateStr,
      endDateStr
    );

    res.json(metrics);
  } catch (error: any) {
    console.error('Error computing reports & analytics:', error);
    res.status(500).json({ error: error.message || 'Failed to compute reports & analytics' });
  }
});

// ----------------------------------------------------------------------
// GET /api/reports/export-csv - Export Raw Bookings Data as CSV
// ----------------------------------------------------------------------
router.get('/export-csv', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwnerOrManager(caller.role)) {
    return res.status(403).json({
      error: 'Permission Denied: Reports & Analytics are accessible to Owners and Managers only.',
    });
  }

  const prisma = getPrisma();
  try {
    const now = new Date();
    const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

    const startDateStr = (req.query.startDate as string) || defaultStart.toISOString().split('T')[0];
    const endDateStr = (req.query.endDate as string) || defaultEnd.toISOString().split('T')[0];

    const [bookings, rooms] = await Promise.all([
      prisma.booking.findMany({
        include: {
          room: {
            select: {
              id: true,
              roomNumber: true,
              name: true,
              basePrice: true,
            },
          },
        },
        orderBy: { checkIn: 'asc' },
      }),
      prisma.room.findMany({
        select: {
          id: true,
          roomNumber: true,
          name: true,
          basePrice: true,
        },
      }),
    ]);

    const metrics = calculateReportMetrics(
      bookings as any,
      rooms as any,
      startDateStr,
      endDateStr
    );

    // Build CSV content
    const headers = [
      'Booking ID',
      'Guest Name',
      'Guest Email',
      'Guest Phone',
      'Room Number',
      'Room Name',
      'Check-In Date',
      'Check-Out Date',
      'Nights',
      'Total Amount ($)',
      'Booking Status',
      'Booking Source',
      'Created Date',
    ];

    const rows = metrics.rawBookings.map((b) => [
      `"${b.id}"`,
      `"${b.guestName.replace(/"/g, '""')}"`,
      `"${b.guestEmail.replace(/"/g, '""')}"`,
      `"${b.guestPhone.replace(/"/g, '""')}"`,
      `"${b.roomNumber}"`,
      `"${b.roomName.replace(/"/g, '""')}"`,
      `"${b.checkIn}"`,
      `"${b.checkOut}"`,
      b.nights,
      b.totalAmount.toFixed(2),
      `"${b.status}"`,
      `"${b.source}"`,
      `"${b.createdAt}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="villa-inlet-bookings-${startDateStr}-to-${endDateStr}.csv"`
    );
    res.status(200).send(csvContent);
  } catch (error: any) {
    console.error('Error generating CSV export:', error);
    res.status(500).json({ error: error.message || 'Failed to export CSV' });
  }
});

export default router;
