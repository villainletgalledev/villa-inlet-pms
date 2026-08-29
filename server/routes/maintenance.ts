import express, { Request, Response } from 'express';
import { getPrisma } from '../../lib/prisma';
import { isOwnerOrManager, UserRole } from '../../lib/rbac';
import { authenticateRequest } from '../auth';

const router = express.Router();

// Priority rank helper for ordering
const PRIORITY_WEIGHT: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// Helper: Synchronize Room Status based on open HIGH/URGENT maintenance tickets
async function syncRoomMaintenanceStatus(prisma: any, roomId: string) {
  if (!roomId) return;

  const openHighUrgentIssues = await prisma.maintenanceIssue.findMany({
    where: {
      roomId,
      priority: { in: ['HIGH', 'URGENT'] },
      status: { notIn: ['RESOLVED'] },
    },
  });

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, status: true },
  });

  if (!room) return;

  if (openHighUrgentIssues.length > 0) {
    // If there is any active HIGH or URGENT issue, room must be marked MAINTENANCE
    if (room.status !== 'MAINTENANCE') {
      await prisma.room.update({
        where: { id: roomId },
        data: { status: 'MAINTENANCE' },
      });
    }
  } else {
    // If no active HIGH/URGENT issues remain, revert to AVAILABLE if it was in MAINTENANCE
    if (room.status === 'MAINTENANCE') {
      await prisma.room.update({
        where: { id: roomId },
        data: { status: 'AVAILABLE' },
      });
    }
  }
}

// ----------------------------------------------------------------------
// GET /api/maintenance - List issues with filters, summary & aging flags
// ----------------------------------------------------------------------
router.get('/', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const prisma = getPrisma();
  try {
    const { status, priority, category, roomId, assignedToUserId, agingOnly } = req.query;

    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = String(status);
    }
    if (priority && priority !== 'ALL') {
      where.priority = String(priority);
    }
    if (category && category !== 'ALL') {
      where.category = String(category);
    }
    if (roomId && roomId !== 'ALL') {
      where.roomId = roomId === 'PROPERTY_WIDE' ? null : String(roomId);
    }
    if (assignedToUserId && assignedToUserId !== 'ALL') {
      where.assignedToUserId = assignedToUserId === 'UNASSIGNED' ? null : String(assignedToUserId);
    }

    const rawIssues = await prisma.maintenanceIssue.findMany({
      where,
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            name: true,
            status: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        reportedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const now = Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    // Enhance with aging indicator (> 3 days open)
    let issues = rawIssues.map((issue: any) => {
      const isAging =
        issue.status !== 'RESOLVED' &&
        now - new Date(issue.createdAt).getTime() > THREE_DAYS_MS;

      const ageDays = Math.floor(
        (now - new Date(issue.createdAt).getTime()) / (24 * 60 * 60 * 1000)
      );

      return {
        ...issue,
        isAging,
        ageDays,
      };
    });

    if (agingOnly === 'true') {
      issues = issues.filter((i: any) => i.isAging);
    }

    // Sort by priority rank (URGENT -> HIGH -> MEDIUM -> LOW), then by createdAt desc
    issues.sort((a: any, b: any) => {
      const weightA = PRIORITY_WEIGHT[a.priority] || 0;
      const weightB = PRIORITY_WEIGHT[b.priority] || 0;
      if (weightB !== weightA) {
        return weightB - weightA;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Compute summary metrics across all tickets
    const allIssues = await prisma.maintenanceIssue.findMany({
      select: { status: true, priority: true, createdAt: true },
    });

    const totalIssues = allIssues.length;
    const openIssues = allIssues.filter((i: any) => i.status !== 'RESOLVED').length;
    const urgentIssues = allIssues.filter(
      (i: any) => (i.priority === 'URGENT' || i.priority === 'HIGH') && i.status !== 'RESOLVED'
    ).length;
    const agingIssues = allIssues.filter(
      (i: any) => i.status !== 'RESOLVED' && now - new Date(i.createdAt).getTime() > THREE_DAYS_MS
    ).length;
    const resolvedIssues = allIssues.filter((i: any) => i.status === 'RESOLVED').length;

    // Also fetch active maintenance technicians for easy client assignment dropdowns
    const technicians = await prisma.user.findMany({
      where: {
        role: { in: ['MAINTENANCE', 'OWNER', 'MANAGER'] },
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
      },
    });

    res.json({
      issues,
      summary: {
        totalIssues,
        openIssues,
        urgentIssues,
        agingIssues,
        resolvedIssues,
      },
      technicians,
    });
  } catch (error: any) {
    console.error('Error fetching maintenance issues:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch maintenance issues' });
  }
});

// ----------------------------------------------------------------------
// GET /api/maintenance/:id - Single issue details
// ----------------------------------------------------------------------
router.get('/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const prisma = getPrisma();
  try {
    const { id } = req.params;
    const issue = await prisma.maintenanceIssue.findUnique({
      where: { id },
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            name: true,
            status: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        reportedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!issue) {
      return res.status(404).json({ error: 'Maintenance issue not found' });
    }

    const now = Date.now();
    const isAging =
      issue.status !== 'RESOLVED' &&
      now - new Date(issue.createdAt).getTime() > 3 * 24 * 60 * 60 * 1000;

    res.json({
      issue: {
        ...issue,
        isAging,
      },
    });
  } catch (error: any) {
    console.error('Error fetching maintenance issue:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch maintenance issue' });
  }
});

// ----------------------------------------------------------------------
// POST /api/maintenance - Report Issue (OPEN TO ALL ROLES)
// ----------------------------------------------------------------------
router.post('/', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const prisma = getPrisma();
  try {
    const { title, description, category, priority, roomId, photoUrls } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Issue title is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Issue description is required' });
    }

    // Determine reportedByUserId
    let reporterId = caller.id;
    if (!reporterId && caller.email) {
      const user = await prisma.user.findUnique({ where: { email: caller.email } });
      if (user) reporterId = user.id;
    }

    if (!reporterId) {
      // Fallback to any existing user
      const firstUser = await prisma.user.findFirst();
      if (firstUser) reporterId = firstUser.id;
    }

    if (!reporterId) {
      return res.status(400).json({ error: 'Could not resolve user identity for ticket reporter' });
    }

    const issuePriority = priority || 'MEDIUM';
    const issueCategory = category || 'OTHER';

    const newIssue = await prisma.maintenanceIssue.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        category: issueCategory,
        priority: issuePriority,
        status: 'OPEN',
        roomId: roomId && roomId !== 'PROPERTY_WIDE' ? roomId : null,
        reportedByUserId: reporterId,
        photoUrls: Array.isArray(photoUrls) ? photoUrls : [],
      },
      include: {
        room: {
          select: { id: true, roomNumber: true, name: true, status: true },
        },
        reportedBy: {
          select: { id: true, fullName: true, email: true, role: true },
        },
        assignedTo: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });

    // Rule 4: If roomId is set and priority is HIGH/URGENT, set Room status to MAINTENANCE
    if (newIssue.roomId && (issuePriority === 'HIGH' || issuePriority === 'URGENT')) {
      await prisma.room.update({
        where: { id: newIssue.roomId },
        data: { status: 'MAINTENANCE' },
      });
    }

    res.status(201).json({
      success: true,
      issue: newIssue,
      message: 'Maintenance ticket created successfully.',
    });
  } catch (error: any) {
    console.error('Error creating maintenance issue:', error);
    res.status(500).json({ error: error.message || 'Failed to create maintenance issue' });
  }
});

// ----------------------------------------------------------------------
// PATCH /api/maintenance/:id/assign - Assign to Technician (OWNER / MANAGER ONLY)
// ----------------------------------------------------------------------
router.patch('/:id/assign', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const prisma = getPrisma();
  try {
    if (!isOwnerOrManager(caller.role)) {
      return res.status(403).json({
        error: 'Permission Denied: Only Owners and Managers can assign maintenance tickets.',
      });
    }

    const { id } = req.params;
    const { assignedToUserId } = req.body;

    const existing = await prisma.maintenanceIssue.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Maintenance ticket not found' });
    }

    let targetUserId: string | null = null;
    if (assignedToUserId) {
      const techUser = await prisma.user.findUnique({ where: { id: assignedToUserId } });
      if (!techUser) {
        return res.status(400).json({ error: 'Assigned user does not exist' });
      }
      targetUserId = techUser.id;
    }

    // If currently OPEN and now assigned, move status to ASSIGNED
    const newStatus =
      targetUserId && existing.status === 'OPEN' ? 'ASSIGNED' : existing.status;

    const updatedIssue = await prisma.maintenanceIssue.update({
      where: { id },
      data: {
        assignedToUserId: targetUserId,
        status: newStatus,
      },
      include: {
        room: { select: { id: true, roomNumber: true, name: true, status: true } },
        assignedTo: { select: { id: true, fullName: true, email: true, role: true } },
        reportedBy: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });

    res.json({
      success: true,
      issue: updatedIssue,
      message: targetUserId
        ? `Ticket assigned to ${updatedIssue.assignedTo?.fullName || 'technician'}.`
        : 'Ticket unassigned.',
    });
  } catch (error: any) {
    console.error('Error assigning maintenance issue:', error);
    res.status(500).json({ error: error.message || 'Failed to assign maintenance ticket' });
  }
});

// ----------------------------------------------------------------------
// PATCH /api/maintenance/:id/status - Update Status & Resolution (ASSIGNED TECH or OWNER/MANAGER)
// ----------------------------------------------------------------------
router.patch('/:id/status', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const prisma = getPrisma();
  try {
    const { id } = req.params;
    const { status, resolutionNotes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Target status is required' });
    }

    const existing = await prisma.maintenanceIssue.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Maintenance ticket not found' });
    }

    // RBAC check: Must be OWNER/MANAGER, role MAINTENANCE, or the specific assigned user
    const isPrivileged = isOwnerOrManager(caller.role);
    const isMaintenanceRole = caller.role === 'MAINTENANCE';
    const isAssigned = caller.id && existing.assignedToUserId === caller.id;

    if (!isPrivileged && !isMaintenanceRole && !isAssigned) {
      return res.status(403).json({
        error: 'Permission Denied: Only the assigned maintenance technician, Owners, or Managers can update ticket status.',
      });
    }

    // If CANNOT_FIX, require resolutionNotes
    if (status === 'CANNOT_FIX' && (!resolutionNotes || !resolutionNotes.trim())) {
      return res.status(400).json({
        error: 'A resolution note explaining why the issue cannot be fixed is required.',
      });
    }

    const resolvedAt = status === 'RESOLVED' ? new Date() : existing.resolvedAt;

    const updatedIssue = await prisma.maintenanceIssue.update({
      where: { id },
      data: {
        status,
        resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : existing.resolutionNotes,
        resolvedAt: status === 'RESOLVED' ? resolvedAt : null,
      },
      include: {
        room: { select: { id: true, roomNumber: true, name: true, status: true } },
        assignedTo: { select: { id: true, fullName: true, email: true, role: true } },
        reportedBy: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });

    // Rule 4: Revert Room status if RESOLVED (only if no other open HIGH/URGENT issues exist)
    if (existing.roomId) {
      await syncRoomMaintenanceStatus(prisma, existing.roomId);
    }

    res.json({
      success: true,
      issue: updatedIssue,
      message: `Status updated to ${status}.`,
    });
  } catch (error: any) {
    console.error('Error updating maintenance status:', error);
    res.status(500).json({ error: error.message || 'Failed to update maintenance status' });
  }
});

// ----------------------------------------------------------------------
// PUT /api/maintenance/:id - Full Update (OWNER / MANAGER ONLY)
// ----------------------------------------------------------------------
router.put('/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const prisma = getPrisma();
  try {
    if (!isOwnerOrManager(caller.role)) {
      return res.status(403).json({
        error: 'Permission Denied: Only Owners and Managers can edit maintenance tickets.',
      });
    }

    const { id } = req.params;
    const { title, description, category, priority, status, roomId, assignedToUserId, photoUrls, resolutionNotes } = req.body;

    const existing = await prisma.maintenanceIssue.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Maintenance ticket not found' });
    }

    const oldRoomId = existing.roomId;
    const newRoomId = roomId && roomId !== 'PROPERTY_WIDE' ? roomId : null;
    const targetStatus = status || existing.status;
    const targetPriority = priority || existing.priority;

    const updatedIssue = await prisma.maintenanceIssue.update({
      where: { id },
      data: {
        title: title ? title.trim() : existing.title,
        description: description ? description.trim() : existing.description,
        category: category || existing.category,
        priority: targetPriority,
        status: targetStatus,
        roomId: newRoomId,
        assignedToUserId: assignedToUserId !== undefined ? (assignedToUserId || null) : existing.assignedToUserId,
        photoUrls: Array.isArray(photoUrls) ? photoUrls : existing.photoUrls,
        resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : existing.resolutionNotes,
        resolvedAt: targetStatus === 'RESOLVED' ? (existing.resolvedAt || new Date()) : null,
      },
      include: {
        room: { select: { id: true, roomNumber: true, name: true, status: true } },
        assignedTo: { select: { id: true, fullName: true, email: true, role: true } },
        reportedBy: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });

    // Sync old and new rooms
    if (oldRoomId) await syncRoomMaintenanceStatus(prisma, oldRoomId);
    if (newRoomId && newRoomId !== oldRoomId) await syncRoomMaintenanceStatus(prisma, newRoomId);

    res.json({
      success: true,
      issue: updatedIssue,
      message: 'Maintenance ticket updated successfully.',
    });
  } catch (error: any) {
    console.error('Error updating maintenance issue:', error);
    res.status(500).json({ error: error.message || 'Failed to update maintenance issue' });
  }
});

// ----------------------------------------------------------------------
// DELETE /api/maintenance/:id - Delete ticket (OWNER / MANAGER ONLY)
// ----------------------------------------------------------------------
router.delete('/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const prisma = getPrisma();
  try {
    if (!isOwnerOrManager(caller.role)) {
      return res.status(403).json({
        error: 'Permission Denied: Only Owners and Managers can delete maintenance tickets.',
      });
    }

    const { id } = req.params;
    const existing = await prisma.maintenanceIssue.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Maintenance ticket not found' });
    }

    await prisma.maintenanceIssue.delete({ where: { id } });

    if (existing.roomId) {
      await syncRoomMaintenanceStatus(prisma, existing.roomId);
    }

    res.json({ success: true, message: 'Maintenance ticket deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting maintenance issue:', error);
    res.status(500).json({ error: error.message || 'Failed to delete maintenance ticket' });
  }
});

export default router;
