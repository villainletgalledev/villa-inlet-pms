import { getPrisma } from '../../lib/prisma';

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export const DEFAULT_CHECKOUT_CHECKLIST: ChecklistItem[] = [
  { id: 'chk-1', label: 'Strip bed linens and replace with fresh laundered sheets & duvet', done: false },
  { id: 'chk-2', label: 'Replace bath towels, hand towels, and bathmats with fresh set', done: false },
  { id: 'chk-3', label: 'Sanitize bathroom vanity, shower glass, and toilet fixtures', done: false },
  { id: 'chk-4', label: 'Restock premium amenities (soaps, shampoo, lotion, dental kit)', done: false },
  { id: 'chk-5', label: 'Vacuum rugs and mop hardwood/tile flooring throughout suite', done: false },
  { id: 'chk-6', label: 'Wipe down all surfaces, nightstands, remotes, and switches', done: false },
  { id: 'chk-7', label: 'Restock minibar, espresso pods, and bottled spring water', done: false },
  { id: 'chk-8', label: 'Inspect plunge pool / terrace / balcony and wipe outdoor loungers', done: false },
  { id: 'chk-9', label: 'Final scent & ambiance check, set AC to 22°C (72°F) for welcome', done: false },
];

export const DEFAULT_RECURRING_CHECKLIST: ChecklistItem[] = [
  { id: 'rec-1', label: 'Daily bed making & decorative pillow staging', done: false },
  { id: 'rec-2', label: 'Tidy bathroom, empty trash receptacles, refresh towels as requested', done: false },
  { id: 'rec-3', label: 'Wipe bathroom counter & rinse sink', done: false },
  { id: 'rec-4', label: 'Replenish espresso pods, tea selection, and drinking water', done: false },
  { id: 'rec-5', label: 'Quick sweep of outdoor terrace and tidy loungers', done: false },
];

export const DEFAULT_DEEP_CLEAN_CHECKLIST: ChecklistItem[] = [
  { id: 'dp-1', label: 'Deep steam mattress, pillows, and upholstery', done: false },
  { id: 'dp-2', label: 'Descale shower heads, faucets, and Jacuzzi jets', done: false },
  { id: 'dp-3', label: 'Clean interior & exterior window panes and glass patio doors', done: false },
  { id: 'dp-4', label: 'Clean behind and underneath all heavy furniture & headboards', done: false },
  { id: 'dp-5', label: 'Wipe interior of all closets, drawers, luggage racks, and safe', done: false },
  { id: 'dp-6', label: 'Air conditioning filter wash and antimicrobial coil treatment', done: false },
  { id: 'dp-7', label: 'Deep grout scrubbing & natural stone sealant inspection', done: false },
];

// In-memory store fallback when PostgreSQL is in transient mode
export let fallbackHousekeepingTasks: any[] = [];
export let fallbackRecurringSchedules: any[] = [];

/**
 * Standalone Engine Function: Auto-generates CHECKOUT_CLEAN tasks for Bookings
 * when checkOut date arrives. Can be invoked directly or via a scheduled cron route.
 */
export async function autoGenerateCheckoutCleans(): Promise<{ generatedCount: number; message: string }> {
  const prisma = getPrisma();
  const now = new Date();
  let generatedCount = 0;

  if (prisma) {
    try {
      // Find all non-cancelled bookings where checkOut <= now or checkOut is today
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const candidateBookings = await prisma.booking.findMany({
        where: {
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          checkOut: { lte: endOfToday },
        },
        include: { room: true },
      });

      for (const booking of candidateBookings) {
        // Check if a task is already recorded for this booking
        const existingTask = await prisma.housekeepingTask.findFirst({
          where: {
            OR: [
              { bookingId: booking.id },
              {
                roomId: booking.roomId,
                taskType: 'CHECKOUT_CLEAN',
                scheduledDate: {
                  gte: startOfToday,
                  lte: endOfToday,
                },
              },
            ],
          },
        });

        if (!existingTask) {
          // Find an active housekeeper user to optionally assign or leave unassigned
          const housekeeperUser = await prisma.user.findFirst({
            where: { role: 'HOUSEKEEPER', isActive: true },
          });

          await prisma.housekeepingTask.create({
            data: {
              roomId: booking.roomId,
              bookingId: booking.id,
              assignedToUserId: housekeeperUser ? housekeeperUser.id : null,
              taskType: 'CHECKOUT_CLEAN',
              status: 'PENDING',
              scheduledDate: booking.checkOut,
              checklist: DEFAULT_CHECKOUT_CHECKLIST as any,
              isOutsourced: false,
              notes: `Auto-generated turnover clean for ${booking.guestName} (${booking.room.roomNumber} checkout).`,
            },
          });

          // Set the room status to CLEANING if not already in maintenance
          if (booking.room.status !== 'MAINTENANCE') {
            await prisma.room.update({
              where: { id: booking.roomId },
              data: { status: 'CLEANING' },
            });
          }

          generatedCount++;
        }
      }

      return {
        generatedCount,
        message: `Successfully verified checkout turnover queue. Generated ${generatedCount} new task(s).`,
      };
    } catch (err: any) {
      console.error('Error in autoGenerateCheckoutCleans (Prisma):', err);
      return { generatedCount: 0, message: err?.message || 'Failed auto-generation' };
    }
  }

  // Fallback in-memory generation
  return { generatedCount: 0, message: 'In-memory mode fallback' };
}

/**
 * Standalone Engine Function: Auto-generates RECURRING_CLEAN tasks for active schedules.
 */
export async function autoGenerateRecurringCleans(): Promise<{ generatedCount: number; message: string }> {
  const prisma = getPrisma();
  const now = new Date();
  let generatedCount = 0;

  if (prisma) {
    try {
      const activeSchedules = await prisma.recurringCleaningSchedule.findMany({
        where: { active: true },
        include: { room: true },
      });

      const currentDayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon...
      const currentDayOfMonth = now.getDate(); // 1 - 31
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      for (const schedule of activeSchedules) {
        let isDueToday = false;

        if (schedule.frequency === 'WEEKLY' && schedule.dayOfWeek === currentDayOfWeek) {
          isDueToday = true;
        } else if (schedule.frequency === 'MONTHLY' && schedule.dayOfMonth === currentDayOfMonth) {
          isDueToday = true;
        } else if (schedule.frequency === 'SPECIFIC_DATE' && schedule.specificDate) {
          const specDate = new Date(schedule.specificDate);
          if (
            specDate.getFullYear() === now.getFullYear() &&
            specDate.getMonth() === now.getMonth() &&
            specDate.getDate() === now.getDate()
          ) {
            isDueToday = true;
          }
        }

        if (isDueToday) {
          // Check if already created for today
          const existing = await prisma.housekeepingTask.findFirst({
            where: {
              roomId: schedule.roomId,
              scheduledDate: {
                gte: startOfToday,
                lte: endOfToday,
              },
            },
          });

          if (!existing) {
            const checklist =
              Array.isArray(schedule.checklistTemplate) && schedule.checklistTemplate.length > 0
                ? schedule.checklistTemplate
                : schedule.isOutsourced
                ? DEFAULT_DEEP_CLEAN_CHECKLIST
                : DEFAULT_RECURRING_CHECKLIST;

            const housekeeperUser = !schedule.isOutsourced
              ? await prisma.user.findFirst({ where: { role: 'HOUSEKEEPER', isActive: true } })
              : null;

            await prisma.housekeepingTask.create({
              data: {
                roomId: schedule.roomId,
                assignedToUserId: housekeeperUser ? housekeeperUser.id : null,
                taskType: schedule.isOutsourced ? 'OUTSOURCED' : 'RECURRING_CLEAN',
                status: 'PENDING',
                scheduledDate: now,
                checklist: checklist as any,
                isOutsourced: schedule.isOutsourced,
                outsourcedVendorName: schedule.outsourcedVendorName,
                notes: `Recurring ${schedule.frequency.toLowerCase()} schedule clean for ${schedule.room.roomNumber}.`,
              },
            });

            generatedCount++;
          }
        }
      }

      return {
        generatedCount,
        message: `Successfully verified recurring schedule queue. Generated ${generatedCount} new task(s).`,
      };
    } catch (err: any) {
      console.error('Error in autoGenerateRecurringCleans (Prisma):', err);
      return { generatedCount: 0, message: err?.message || 'Failed recurring generation' };
    }
  }

  return { generatedCount: 0, message: 'In-memory mode fallback' };
}
