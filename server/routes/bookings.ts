import express, { Request, Response } from 'express';
import { getPrisma } from '../../lib/prisma';
import { canManageBookings, isOwnerOrManager, UserRole } from '../../lib/rbac';
import { authenticateRequest } from '../auth';


const router = express.Router();

// Fallback in-memory bookings for sandbox / preview
let fallbackBookings: Array<any> = [];

/**
 * GET /api/bookings
 * Returns bookings filtered by date range, room, status, or search term.
 * Accessible to all authenticated staff roles.
 */
router.get('/', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const { startDate, endDate, roomId, status, source, search } = req.query;

  const prismaClient = getPrisma();
  if (prismaClient) {
    try {
      const whereClause: any = {};

      if (roomId && typeof roomId === 'string' && roomId !== 'ALL') {
        whereClause.roomId = roomId;
      }

      if (status && typeof status === 'string' && status !== 'ALL') {
        whereClause.status = status;
      }

      if (source && typeof source === 'string' && source !== 'ALL') {
        whereClause.source = source;
      }

      if (startDate || endDate) {
        whereClause.AND = [];
        if (startDate) {
          whereClause.AND.push({ checkOut: { gte: new Date(startDate as string) } });
        }
        if (endDate) {
          whereClause.AND.push({ checkIn: { lte: new Date(endDate as string) } });
        }
      }

      if (search && typeof search === 'string' && search.trim()) {
        const query = search.trim();
        whereClause.OR = [
          { guestName: { contains: query, mode: 'insensitive' } },
          { guestEmail: { contains: query, mode: 'insensitive' } },
          { guestPhone: { contains: query, mode: 'insensitive' } },
          { notes: { contains: query, mode: 'insensitive' } },
        ];
      }

      const bookings = await prismaClient.booking.findMany({
        where: whereClause,
        include: {
          room: {
            select: {
              id: true,
              name: true,
              roomNumber: true,
              basePrice: true,
              status: true,
              maxOccupancy: true,
            },
          },
        },
        orderBy: { checkIn: 'asc' },
      });

      return res.json({ bookings, source: 'database' });
    } catch (err) {
      console.warn('Prisma bookings fetch error:', err);
    }
  }

  return res.json({ bookings: fallbackBookings, source: 'fallback' });
});

/**
 * GET /api/bookings/:id
 * Fetches a single reservation.
 */
router.get('/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const { id } = req.params;
  const prismaClient = getPrisma();

  if (prismaClient) {
    try {
      const booking = await prismaClient.booking.findUnique({
        where: { id },
        include: { room: true },
      });
      if (booking) {
        return res.json({ booking, source: 'database' });
      }
    } catch (err) {
      console.warn('Prisma single booking fetch error:', err);
    }
  }

  const found = fallbackBookings.find((b) => b.id === id);
  if (found) {
    return res.json({ booking: found, source: 'fallback' });
  }

  return res.status(404).json({ error: 'Booking not found' });
});

/**
 * POST /api/bookings
 * Creates a new reservation.
 * Restricted to: OWNER, MANAGER, STAFF.
 * Enforces strict overlap prevention for CONFIRMED bookings on the same room.
 */
router.post('/', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!canManageBookings(caller.role)) {
    return res.status(403).json({ error: 'Permission Denied: Only Owner, Manager, or Front Desk Staff can create reservations.' });
  }

  const {
    roomId,
    guestName,
    guestEmail,
    guestPhone,
    checkIn,
    checkOut,
    numGuests,
    totalAmount,
    amountPaid,
    status = 'CONFIRMED',
    source = 'DIRECT',
    notes,
  } = req.body;

  if (!roomId || !guestName || !guestEmail || !checkIn || !checkOut || totalAmount === undefined) {
    return res.status(400).json({ error: 'Missing required reservation fields.' });
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return res.status(400).json({ error: 'Invalid check-in or check-out date format.' });
  }

  if (checkOutDate <= checkInDate) {
    return res.status(400).json({ error: 'Check-out date must be strictly after the check-in date.' });
  }

  const prismaClient = getPrisma();
  if (prismaClient) {
    try {
      // Overlap Verification for CONFIRMED reservations
      if (status === 'CONFIRMED') {
        const conflict = await prismaClient.booking.findFirst({
          where: {
            roomId,
            status: 'CONFIRMED',
            AND: [
              { checkIn: { lt: checkOutDate } },
              { checkOut: { gt: checkInDate } },
            ],
          },
          include: { room: true },
        });

        if (conflict) {
          const roomLabel = conflict.room ? `${conflict.room.roomNumber} (${conflict.room.name})` : 'Selected Suite';
          const rangeFormatted = `${new Date(conflict.checkIn).toLocaleDateString()} – ${new Date(conflict.checkOut).toLocaleDateString()}`;
          return res.status(409).json({
            error: `Booking Conflict: ${roomLabel} is already reserved for "${conflict.guestName}" (${rangeFormatted}). Please select different dates or choose another suite.`,
            conflictBookingId: conflict.id,
          });
        }
      }

      const booking = await prismaClient.booking.create({
        data: {
          roomId,
          guestName,
          guestEmail,
          guestPhone: guestPhone || '',
          checkIn: checkInDate,
          checkOut: checkOutDate,
          numGuests: Number(numGuests) || 1,
          totalAmount: Number(totalAmount),
          amountPaid: Number(amountPaid) || 0,
          status,
          source,
          notes: notes || '',
        },
        include: { room: true },
      });

      return res.status(201).json({ booking, success: true });
    } catch (err: any) {
      console.warn('Prisma create booking error:', err);
      return res.status(500).json({ error: err.message || 'Database error creating reservation' });
    }
  }

  // Fallback in-memory creation
  const newBooking = {
    id: `bkg-${Date.now()}`,
    roomId,
    guestName,
    guestEmail,
    guestPhone: guestPhone || '',
    checkIn: checkInDate.toISOString(),
    checkOut: checkOutDate.toISOString(),
    numGuests: Number(numGuests) || 1,
    totalAmount: Number(totalAmount),
    amountPaid: Number(amountPaid) || 0,
    status,
    source,
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fallbackBookings.unshift(newBooking);
  return res.status(201).json({ booking: newBooking, success: true });
});

/**
 * PATCH /api/bookings/:id
 * Updates an existing reservation.
 * Restricted to: OWNER, MANAGER, STAFF.
 * Enforces overlap check if dates, room, or status are changed to CONFIRMED.
 */
router.patch('/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!canManageBookings(caller.role)) {
    return res.status(403).json({ error: 'Permission Denied: Only Owner, Manager, or Front Desk Staff can modify reservations.' });
  }

  const { id } = req.params;
  const {
    roomId,
    guestName,
    guestEmail,
    guestPhone,
    checkIn,
    checkOut,
    numGuests,
    totalAmount,
    amountPaid,
    status,
    source,
    notes,
    checkedOutAt,
  } = req.body;

  const prismaClient = getPrisma();
  if (prismaClient) {
    try {
      const existing = await prismaClient.booking.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Reservation not found.' });
      }

      const targetRoomId = roomId || existing.roomId;
      const targetStatus = status || existing.status;
      const targetCheckIn = checkIn ? new Date(checkIn) : existing.checkIn;
      const targetCheckOut = checkOut ? new Date(checkOut) : existing.checkOut;

      if (targetCheckOut <= targetCheckIn) {
        return res.status(400).json({ error: 'Check-out date must be strictly after the check-in date.' });
      }

      // Check for overlap if status is CONFIRMED
      if (targetStatus === 'CONFIRMED') {
        const conflict = await prismaClient.booking.findFirst({
          where: {
            id: { not: id },
            roomId: targetRoomId,
            status: 'CONFIRMED',
            AND: [
              { checkIn: { lt: targetCheckOut } },
              { checkOut: { gt: targetCheckIn } },
            ],
          },
          include: { room: true },
        });

        if (conflict) {
          const roomLabel = conflict.room ? `${conflict.room.roomNumber} (${conflict.room.name})` : 'Selected Suite';
          const rangeFormatted = `${new Date(conflict.checkIn).toLocaleDateString()} – ${new Date(conflict.checkOut).toLocaleDateString()}`;
          return res.status(409).json({
            error: `Booking Conflict: ${roomLabel} is already reserved for "${conflict.guestName}" (${rangeFormatted}). Dates overlap with this booking.`,
            conflictBookingId: conflict.id,
          });
        }
      }

      const updated = await prismaClient.booking.update({
        where: { id },
        data: {
          ...(roomId && { roomId }),
          ...(guestName && { guestName }),
          ...(guestEmail && { guestEmail }),
          ...(guestPhone !== undefined && { guestPhone }),
          ...(checkIn && { checkIn: new Date(checkIn) }),
          ...(checkOut && { checkOut: new Date(checkOut) }),
          ...(numGuests !== undefined && { numGuests: Number(numGuests) }),
          ...(totalAmount !== undefined && { totalAmount: Number(totalAmount) }),
          ...(amountPaid !== undefined && { amountPaid: Number(amountPaid) }),
          ...(status && { status }),
          ...(source && { source }),
          ...(notes !== undefined && { notes }),
          ...(checkedOutAt !== undefined && { checkedOutAt: checkedOutAt ? new Date(checkedOutAt) : null }),
        },
        include: { room: true },
      });

      return res.json({ booking: updated, success: true });
    } catch (err: any) {
      console.warn('Prisma update booking error:', err);
      return res.status(500).json({ error: err.message || 'Database error updating reservation' });
    }
  }

  const idx = fallbackBookings.findIndex((b) => b.id === id);
  if (idx >= 0) {
    fallbackBookings[idx] = {
      ...fallbackBookings[idx],
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    return res.json({ booking: fallbackBookings[idx], success: true });
  }

  return res.status(404).json({ error: 'Reservation not found' });
});

/**
 * DELETE /api/bookings/:id
 * Cancels / removes a reservation.
 * Restricted to: OWNER and MANAGER.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwnerOrManager(caller.role)) {
    return res.status(403).json({ error: 'Permission Denied: Only Owner or Manager can delete reservations.' });
  }

  const { id } = req.params;
  const prismaClient = getPrisma();
  if (prismaClient) {
    try {
      await prismaClient.booking.delete({ where: { id } });
      return res.json({ success: true, message: 'Reservation deleted successfully.' });
    } catch (err: any) {
      console.warn('Prisma delete booking error:', err);
      return res.status(500).json({ error: err.message || 'Database error deleting reservation' });
    }
  }

  fallbackBookings = fallbackBookings.filter((b) => b.id !== id);
  return res.json({ success: true, message: 'Reservation deleted.' });
});

export default router;
