import express, { Request, Response } from 'express';
import { getPrisma } from '../../lib/prisma';
import { isOwnerOrManager, UserRole } from '../../lib/rbac';
import { authenticateRequest } from '../auth';
import {
  autoGenerateCheckoutCleans,
  autoGenerateRecurringCleans,
  DEFAULT_CHECKOUT_CHECKLIST,
  DEFAULT_RECURRING_CHECKLIST,
  DEFAULT_DEEP_CLEAN_CHECKLIST,
} from '../services/housekeepingEngine';

const router = express.Router();

/**
 * GET /api/housekeeping/tasks
 * Returns tasks filterable by roomId, assignedToUserId, status, taskType.
 * Auto-triggers checkout clean sync.
 * Restricts HOUSEKEEPER role to tasks assigned to them.
 */
router.get('/tasks', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const { roomId, assignedToUserId, status, taskType } = req.query;

  const prisma = getPrisma();
  if (prisma) {
    try {
      const whereClause: any = {};

      if (roomId && typeof roomId === 'string' && roomId !== 'ALL') {
        whereClause.roomId = roomId;
      }

      if (status && typeof status === 'string' && status !== 'ALL') {
        whereClause.status = status;
      }

      if (taskType && typeof taskType === 'string' && taskType !== 'ALL') {
        whereClause.taskType = taskType;
      }

      // Enforce HOUSEKEEPER visibility: view and update only tasks assigned to them
      if (caller.role === 'HOUSEKEEPER') {
        // If we have caller.id, match against assignedToUserId or caller's email
        if (caller.id) {
          whereClause.assignedToUserId = caller.id;
        } else if (caller.email) {
          const userRecord = await prisma.user.findUnique({ where: { email: caller.email } });
          if (userRecord) {
            whereClause.assignedToUserId = userRecord.id;
          }
        }
      } else if (assignedToUserId && typeof assignedToUserId === 'string' && assignedToUserId !== 'ALL') {
        if (assignedToUserId === 'UNASSIGNED') {
          whereClause.assignedToUserId = null;
        } else {
          whereClause.assignedToUserId = assignedToUserId;
        }
      }

      const tasks = await prisma.housekeepingTask.findMany({
        where: whereClause,
        include: {
          room: true,
          assignedTo: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: [{ status: 'asc' }, { scheduledDate: 'asc' }, { createdAt: 'desc' }],
      });

      return res.json({ tasks });
    } catch (err: any) {
      console.error('Error fetching housekeeping tasks:', err);
      return res.status(500).json({ error: err?.message || 'Failed to fetch tasks' });
    }
  }

  return res.json({ tasks: [] });
});

/**
 * POST /api/housekeeping/tasks
 * Create a new housekeeping task
 */
router.post('/tasks', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (caller.role === 'HOUSEKEEPER' || caller.role === 'MAINTENANCE') {
    return res.status(403).json({ error: 'Only Managers, Owners, and Staff can schedule new cleaning tasks.' });
  }

  const {
    roomId,
    assignedToUserId,
    taskType = 'CHECKOUT_CLEAN',
    status = 'PENDING',
    scheduledDate,
    checklist,
    isOutsourced = false,
    outsourcedVendorName,
    notes = '',
  } = req.body;

  if (!roomId) {
    return res.status(400).json({ error: 'Room selection is required.' });
  }

  const prisma = getPrisma();
  if (prisma) {
    try {
      let taskChecklist = checklist;
      if (!taskChecklist || (Array.isArray(taskChecklist) && taskChecklist.length === 0)) {
        if (taskType === 'CHECKOUT_CLEAN') taskChecklist = DEFAULT_CHECKOUT_CHECKLIST;
        else if (taskType === 'DEEP_CLEAN') taskChecklist = DEFAULT_DEEP_CLEAN_CHECKLIST;
        else taskChecklist = DEFAULT_RECURRING_CHECKLIST;
      }

      const task = await prisma.housekeepingTask.create({
        data: {
          roomId,
          assignedToUserId: assignedToUserId || null,
          taskType,
          status,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
          checklist: taskChecklist,
          isOutsourced: Boolean(isOutsourced),
          outsourcedVendorName: isOutsourced ? outsourcedVendorName : null,
          notes: notes.trim(),
        },
        include: {
          room: true,
          assignedTo: {
            select: { id: true, fullName: true, email: true, role: true },
          },
        },
      });

      // Update room status to CLEANING if currently AVAILABLE
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (room && room.status === 'AVAILABLE') {
        await prisma.room.update({
          where: { id: roomId },
          data: { status: 'CLEANING' },
        });
      }

      return res.status(201).json({ task, message: 'Housekeeping task created successfully.' });
    } catch (err: any) {
      console.error('Error creating housekeeping task:', err);
      return res.status(500).json({ error: err?.message || 'Failed to create task' });
    }
  }

  return res.status(500).json({ error: 'Database service unavailable' });
});

/**
 * PATCH /api/housekeeping/tasks/:id
 * Update task status, checklist items, staff assignment, or notes.
 * Handles auto-completion when all checklist items are checked,
 * and updates room status back to AVAILABLE on DONE.
 */
router.patch('/tasks/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const { id } = req.params;
  const {
    status,
    checklist,
    assignedToUserId,
    taskType,
    notes,
    scheduledDate,
    forceDone,
  } = req.body;

  const prisma = getPrisma();
  if (prisma) {
    try {
      const existing = await prisma.housekeepingTask.findUnique({
        where: { id },
        include: { room: true },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Housekeeping task not found.' });
      }

      // Check HOUSEKEEPER permissions: can only update tasks assigned to them
      if (caller.role === 'HOUSEKEEPER') {
        let isAssignedToCaller = false;
        if (caller.id && existing.assignedToUserId === caller.id) {
          isAssignedToCaller = true;
        } else if (caller.email) {
          const userRec = await prisma.user.findUnique({ where: { email: caller.email } });
          if (userRec && existing.assignedToUserId === userRec.id) {
            isAssignedToCaller = true;
          }
        }

        if (!isAssignedToCaller) {
          return res.status(403).json({
            error: 'Permission denied: Housekeepers can only update tasks assigned to them.',
          });
        }
      }

      const updateData: any = {};

      if (checklist !== undefined) {
        updateData.checklist = checklist;
      }

      if (notes !== undefined) {
        updateData.notes = notes;
      }

      if (scheduledDate !== undefined) {
        updateData.scheduledDate = new Date(scheduledDate);
      }

      // Reassign staff (Manager / Owner only)
      if (assignedToUserId !== undefined) {
        if (caller.role === 'HOUSEKEEPER' || caller.role === 'MAINTENANCE') {
          // Ignore or reject
        } else {
          updateData.assignedToUserId = assignedToUserId === '' || assignedToUserId === null ? null : assignedToUserId;
        }
      }

      if (taskType !== undefined && isOwnerOrManager(caller.role)) {
        updateData.taskType = taskType;
      }

      // Checklist evaluation: check if all items are done
      const currentChecklist = checklist !== undefined ? checklist : (existing.checklist as any[]);
      const hasItems = Array.isArray(currentChecklist) && currentChecklist.length > 0;
      const allItemsChecked = hasItems && currentChecklist.every((item: any) => item.done === true);

      let targetStatus = status || existing.status;

      // Rule: Task auto-moves to DONE once all items are checked
      if (allItemsChecked && existing.status !== 'DONE' && existing.status !== 'SKIPPED') {
        targetStatus = 'DONE';
      }

      // If user is trying to manually mark DONE, check if all items are checked or if forceDone (Manager/Owner override)
      if (status === 'DONE' && !allItemsChecked) {
        if (!forceDone && !isOwnerOrManager(caller.role)) {
          return res.status(400).json({
            error: 'All checklist items must be completed before marking task as Done.',
            requiresAllChecked: true,
          });
        }
        targetStatus = 'DONE';
      }

      if (targetStatus) {
        updateData.status = targetStatus;
        if (targetStatus === 'DONE') {
          updateData.completedAt = new Date();
        } else if (targetStatus === 'IN_PROGRESS' || targetStatus === 'PENDING') {
          updateData.completedAt = null;
        }
      }

      const updatedTask = await prisma.housekeepingTask.update({
        where: { id },
        data: updateData,
        include: {
          room: true,
          assignedTo: {
            select: { id: true, fullName: true, email: true, role: true },
          },
        },
      });

      // Feature 6: When task is marked DONE for a CHECKOUT_CLEAN (or any cleaning task),
      // update the related Room's status back to AVAILABLE (if currently in CLEANING)
      if (targetStatus === 'DONE') {
        const room = await prisma.room.findUnique({ where: { id: existing.roomId } });
        if (room && room.status === 'CLEANING') {
          await prisma.room.update({
            where: { id: existing.roomId },
            data: { status: 'AVAILABLE' },
          });
        }
      } else if (targetStatus === 'IN_PROGRESS') {
        // While task is in progress, ensure room status is CLEANING (unless MAINTENANCE)
        const room = await prisma.room.findUnique({ where: { id: existing.roomId } });
        if (room && room.status === 'AVAILABLE') {
          await prisma.room.update({
            where: { id: existing.roomId },
            data: { status: 'CLEANING' },
          });
        }
      }

      return res.json({ task: updatedTask, message: 'Task updated successfully.' });
    } catch (err: any) {
      console.error('Error updating housekeeping task:', err);
      return res.status(500).json({ error: err?.message || 'Failed to update task' });
    }
  }

  return res.status(500).json({ error: 'Database service unavailable' });
});

/**
 * DELETE /api/housekeeping/tasks/:id
 * Delete a housekeeping task (OWNER, MANAGER only)
 */
router.delete('/tasks/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwnerOrManager(caller.role)) {
    return res.status(403).json({ error: 'Only Owners and Managers can delete housekeeping tasks.' });
  }

  const { id } = req.params;
  const prisma = getPrisma();
  if (prisma) {
    try {
      await prisma.housekeepingTask.delete({ where: { id } });
      return res.json({ success: true, message: 'Housekeeping task deleted.' });
    } catch (err: any) {
      console.error('Error deleting task:', err);
      return res.status(500).json({ error: err?.message || 'Failed to delete task' });
    }
  }

  return res.status(500).json({ error: 'Database service unavailable' });
});

/**
 * GET /api/housekeeping/schedules
 * List recurring cleaning schedules
 */
router.get('/schedules', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const prisma = getPrisma();
  if (prisma) {
    try {
      const schedules = await prisma.recurringCleaningSchedule.findMany({
        include: { room: true },
        orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      });
      return res.json({ schedules });
    } catch (err: any) {
      console.error('Error fetching schedules:', err);
      return res.status(500).json({ error: err?.message || 'Failed to fetch schedules' });
    }
  }

  return res.json({ schedules: [] });
});

/**
 * POST /api/housekeeping/schedules
 * Create a recurring cleaning schedule (OWNER, MANAGER only)
 */
router.post('/schedules', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwnerOrManager(caller.role)) {
    return res.status(403).json({ error: 'Only Owners and Managers can create recurring cleaning schedules.' });
  }

  const {
    roomId,
    frequency = 'WEEKLY',
    dayOfWeek,
    dayOfMonth,
    specificDate,
    checklistTemplate,
    isOutsourced = false,
    outsourcedVendorName,
    active = true,
  } = req.body;

  if (!roomId) {
    return res.status(400).json({ error: 'Room selection is required.' });
  }

  const prisma = getPrisma();
  if (prisma) {
    try {
      let template = checklistTemplate;
      if (!template || (Array.isArray(template) && template.length === 0)) {
        template = isOutsourced ? DEFAULT_DEEP_CLEAN_CHECKLIST : DEFAULT_RECURRING_CHECKLIST;
      }

      const schedule = await prisma.recurringCleaningSchedule.create({
        data: {
          roomId,
          frequency,
          dayOfWeek: dayOfWeek !== undefined && dayOfWeek !== null ? Number(dayOfWeek) : null,
          dayOfMonth: dayOfMonth !== undefined && dayOfMonth !== null ? Number(dayOfMonth) : null,
          specificDate: specificDate ? new Date(specificDate) : null,
          checklistTemplate: template,
          isOutsourced: Boolean(isOutsourced),
          outsourcedVendorName: isOutsourced ? outsourcedVendorName : null,
          active: Boolean(active),
        },
        include: { room: true },
      });

      return res.status(201).json({ schedule, message: 'Recurring schedule created successfully.' });
    } catch (err: any) {
      console.error('Error creating schedule:', err);
      return res.status(500).json({ error: err?.message || 'Failed to create schedule' });
    }
  }

  return res.status(500).json({ error: 'Database service unavailable' });
});

/**
 * PATCH /api/housekeeping/schedules/:id
 * Update recurring cleaning schedule (OWNER, MANAGER only)
 */
router.patch('/schedules/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwnerOrManager(caller.role)) {
    return res.status(403).json({ error: 'Only Owners and Managers can update recurring cleaning schedules.' });
  }

  const { id } = req.params;
  const {
    frequency,
    dayOfWeek,
    dayOfMonth,
    specificDate,
    checklistTemplate,
    isOutsourced,
    outsourcedVendorName,
    active,
  } = req.body;

  const prisma = getPrisma();
  if (prisma) {
    try {
      const updateData: any = {};
      if (frequency !== undefined) updateData.frequency = frequency;
      if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek !== null ? Number(dayOfWeek) : null;
      if (dayOfMonth !== undefined) updateData.dayOfMonth = dayOfMonth !== null ? Number(dayOfMonth) : null;
      if (specificDate !== undefined) updateData.specificDate = specificDate ? new Date(specificDate) : null;
      if (checklistTemplate !== undefined) updateData.checklistTemplate = checklistTemplate;
      if (isOutsourced !== undefined) updateData.isOutsourced = Boolean(isOutsourced);
      if (outsourcedVendorName !== undefined) updateData.outsourcedVendorName = outsourcedVendorName;
      if (active !== undefined) updateData.active = Boolean(active);

      const schedule = await prisma.recurringCleaningSchedule.update({
        where: { id },
        data: updateData,
        include: { room: true },
      });

      return res.json({ schedule, message: 'Recurring schedule updated.' });
    } catch (err: any) {
      console.error('Error updating schedule:', err);
      return res.status(500).json({ error: err?.message || 'Failed to update schedule' });
    }
  }

  return res.status(500).json({ error: 'Database service unavailable' });
});

/**
 * DELETE /api/housekeeping/schedules/:id
 * Delete recurring cleaning schedule (OWNER, MANAGER only)
 */
router.delete('/schedules/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwnerOrManager(caller.role)) {
    return res.status(403).json({ error: 'Only Owners and Managers can delete recurring schedules.' });
  }

  const { id } = req.params;
  const prisma = getPrisma();
  if (prisma) {
    try {
      await prisma.recurringCleaningSchedule.delete({ where: { id } });
      return res.json({ success: true, message: 'Recurring schedule removed.' });
    } catch (err: any) {
      console.error('Error deleting schedule:', err);
      return res.status(500).json({ error: err?.message || 'Failed to delete schedule' });
    }
  }

  return res.status(500).json({ error: 'Database service unavailable' });
});

/**
 * POST /api/housekeeping/generate
 * Standalone trigger for auto-generation (e.g. for cron or manual refresh)
 */
router.post('/generate', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  try {
    const checkoutRes = await autoGenerateCheckoutCleans();
    const recurringRes = await autoGenerateRecurringCleans();

    return res.json({
      success: true,
      checkoutCleans: checkoutRes,
      recurringCleans: recurringRes,
      message: `Housekeeping generation cycle complete. ${checkoutRes.generatedCount + recurringRes.generatedCount} new task(s) generated.`,
    });
  } catch (err: any) {
    console.error('Error in housekeeping generation endpoint:', err);
    return res.status(500).json({ error: err?.message || 'Failed generation cycle' });
  }
});

export default router;
