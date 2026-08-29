import express, { Request, Response } from 'express';
import { getPrisma } from '../../lib/prisma';
import { createServerClient } from '../../lib/supabase/server';
import { isOwner, isOwnerOrManager, UserRole } from '../../lib/rbac';
import { authenticateRequest } from '../auth';

const router = express.Router();

/**
 * Helper to count active owners in database
 */
async function getActiveOwnerCount(): Promise<number> {
  const prismaClient = getPrisma();
  return await prismaClient.user.count({
    where: {
      role: 'OWNER',
      isActive: true,
    },
  });
}

/**
 * GET /api/users/assignees
 * Lists active staff members for assignment dropdowns (Housekeepers, Maintenance, Staff).
 * Accessible to all authenticated villa roles.
 */
router.get('/assignees', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  const { role } = req.query;
  const prismaClient = getPrisma();

  try {
    const whereClause: any = { isActive: true };
    if (role && typeof role === 'string' && role !== 'ALL') {
      whereClause.role = role;
    }

    const users = await prismaClient.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
      },
      orderBy: { fullName: 'asc' },
    });

    return res.json({ users });
  } catch (err: any) {
    console.error('Error fetching assignees:', err);
    return res.status(500).json({ error: 'Failed to fetch assignees from database.' });
  }
});

/**
 * GET /api/users
 * Lists all staff members. Restricted to OWNER and MANAGER.
 */
router.get('/', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwnerOrManager(caller.role)) {
    return res.status(403).json({ error: 'Unauthorized: Only OWNER and MANAGER can view staff users.' });
  }

  const prismaClient = getPrisma();
  try {
    const dbUsers = await prismaClient.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ users: dbUsers, source: 'database' });
  } catch (err: any) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ error: 'Failed to fetch users from database.' });
  }
});

/**
 * POST /api/users/invite
 * Invites a new staff member via Supabase Admin API and creates a database record.
 * Allowed for: OWNER, MANAGER
 */
router.post('/invite', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwnerOrManager(caller.role)) {
    return res.status(403).json({ error: 'Unauthorized: Only OWNER and MANAGER can invite users.' });
  }

  const { email, fullName, role } = req.body;
  if (!email || !fullName || !role) {
    return res.status(400).json({ error: 'Missing required fields: email, fullName, and role are required.' });
  }

  // Managers cannot invite an OWNER
  if (caller.role === 'MANAGER' && role === 'OWNER') {
    return res.status(403).json({ error: 'Managers cannot invite users with the OWNER role.' });
  }

  let supabaseUserId: string | null = null;
  let inviteMethod = 'direct';

  // Trigger Supabase Admin API
  try {
    const origin = req.headers.origin || 'http://localhost:3000';
    const callbackUrl = `${origin}/callback`;
    const supabaseAdmin = createServerClient();
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: callbackUrl,
      data: {
        full_name: fullName,
        role: role,
        isActive: true,
      },
    });

    if (inviteError) {
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: role,
          isActive: true,
        },
      });

      if (!createError && createData?.user) {
        supabaseUserId = createData.user.id;
        inviteMethod = 'admin_create';
      }
    } else if (inviteData?.user) {
      supabaseUserId = inviteData.user.id;
      inviteMethod = 'email_invite';
    }
  } catch (adminErr: any) {
    console.error('Supabase admin invitation error:', adminErr);
  }

  // Persist to Prisma DB
  const prismaClient = getPrisma();
  try {
    const user = await prismaClient.user.upsert({
      where: { email },
      create: {
        id: supabaseUserId || undefined,
        email,
        fullName,
        role: role as any,
        isActive: true,
      },
      update: {
        fullName,
        role: role as any,
        isActive: true,
      },
    });
    return res.status(201).json({ user, inviteMethod, success: true });
  } catch (err: any) {
    console.error('Error saving invited user to database:', err);
    return res.status(500).json({ error: 'Failed to create user record in database.' });
  }
});

/**
 * POST /api/users/:id/reset-password
 * Triggers a Supabase password reset email.
 * Allowed for: OWNER ONLY.
 */
router.post('/:id/reset-password', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwner(caller.role)) {
    return res.status(403).json({ error: 'Permission Denied: Only OWNER can trigger password resets.' });
  }

  const { id } = req.params;
  const { email } = req.body;

  let targetEmail = email;
  const prismaClient = getPrisma();
  if (!targetEmail) {
    try {
      const user = await prismaClient.user.findUnique({ where: { id } });
      targetEmail = user?.email;
    } catch {
      // ignore
    }
  }

  if (!targetEmail) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Call Supabase Admin password reset / recovery link generator
  try {
    const supabaseAdmin = createServerClient();
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${req.headers.origin || 'http://localhost:3000'}/login`,
    });

    if (error) {
      await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: targetEmail,
      });
    }

    return res.json({
      success: true,
      message: `Password reset email dispatched to ${targetEmail} via Supabase Admin.`,
    });
  } catch (err: any) {
    console.error('Password reset error:', err);
    return res.status(500).json({ error: 'Failed to dispatch password reset email.' });
  }
});

/**
 * PATCH /api/users/:id/role
 * Changes a user's role.
 * Allowed for: OWNER ONLY.
 */
router.patch('/:id/role', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwner(caller.role)) {
    return res.status(403).json({ error: 'Permission Denied: Only OWNER can modify user roles.' });
  }

  const { id } = req.params;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ error: 'Missing target role parameter.' });
  }

  const prismaClient = getPrisma();
  const targetUser = await prismaClient.user.findUnique({ where: { id } });

  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Prevent demoting the last active OWNER
  if (targetUser.role === 'OWNER' && targetUser.isActive && role !== 'OWNER') {
    const activeOwnerCount = await getActiveOwnerCount();
    if (activeOwnerCount <= 1) {
      return res.status(400).json({
        error: 'Action Blocked: Cannot demote the last remaining active OWNER account. At least one active Owner must remain to manage the system.',
      });
    }
  }

  // Update Supabase user metadata
  try {
    const supabaseAdmin = createServerClient();
    await supabaseAdmin.auth.admin.updateUserById(id, {
      user_metadata: { role },
    });
  } catch (authErr: any) {
    console.warn('Could not update role in Supabase auth metadata:', authErr);
  }

  try {
    const updated = await prismaClient.user.update({
      where: { id },
      data: { role: role as any },
    });
    return res.json({ user: updated, success: true });
  } catch (err: any) {
    console.error('Error updating user role in database:', err);
    return res.status(500).json({ error: 'Failed to update user role in database.' });
  }
});

/**
 * PATCH /api/users/:id/status
 * Deactivates or Reactivates a user.
 * Allowed for: OWNER or MANAGER (Managers cannot deactivate Owners).
 */
router.patch('/:id/status', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwnerOrManager(caller.role)) {
    return res.status(403).json({ error: 'Unauthorized: Only OWNER and MANAGER can change account status.' });
  }

  const { id } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'isActive must be a boolean value.' });
  }

  const prismaClient = getPrisma();
  const targetUser = await prismaClient.user.findUnique({ where: { id } });

  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (caller.role === 'MANAGER' && targetUser.role === 'OWNER') {
    return res.status(403).json({ error: 'Managers are not permitted to deactivate the Property Owner.' });
  }

  // Prevent deactivating the last active OWNER
  if (targetUser.role === 'OWNER' && targetUser.isActive && isActive === false) {
    const activeOwnerCount = await getActiveOwnerCount();
    if (activeOwnerCount <= 1) {
      return res.status(400).json({
        error: 'Action Blocked: Cannot deactivate the last remaining active OWNER account. At least one active Owner must remain to prevent system lockout.',
      });
    }
  }

  // Update Supabase user metadata and ban/unban
  try {
    const supabaseAdmin = createServerClient();
    await supabaseAdmin.auth.admin.updateUserById(id, {
      user_metadata: { isActive },
      ban_duration: isActive ? 'none' : '876000h', // 100 years if deactivated
    });
  } catch (authErr: any) {
    console.warn('Could not update ban status in Supabase auth:', authErr);
  }

  try {
    const updated = await prismaClient.user.update({
      where: { id },
      data: { isActive },
    });
    return res.json({ user: updated, success: true });
  } catch (err: any) {
    console.error('Error updating user status in database:', err);
    return res.status(500).json({ error: 'Failed to update user status in database.' });
  }
});

/**
 * DELETE /api/users/:id
 * Permanently deletes a user account.
 * Allowed for: OWNER ONLY (Managers cannot delete users).
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const caller = await authenticateRequest(req);
  if (!caller) {
    return res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
  }

  if (!isOwner(caller.role)) {
    return res.status(403).json({ error: 'Permission Denied: Only OWNER accounts can delete user accounts.' });
  }

  const { id } = req.params;
  const prismaClient = getPrisma();
  const targetUser = await prismaClient.user.findUnique({ where: { id } });

  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Prevent deleting the last active OWNER
  if (targetUser.role === 'OWNER' && targetUser.isActive) {
    const activeOwnerCount = await getActiveOwnerCount();
    if (activeOwnerCount <= 1) {
      return res.status(400).json({
        error: 'Action Blocked: Cannot delete the last remaining active OWNER account. At least one active Owner must remain to prevent system lockout.',
      });
    }
  }

  // Delete from Supabase Admin
  try {
    const supabaseAdmin = createServerClient();
    await supabaseAdmin.auth.admin.deleteUser(id);
  } catch (authErr: any) {
    console.warn('Could not delete user from Supabase auth:', authErr);
  }

  try {
    await prismaClient.user.delete({
      where: { id },
    });
    return res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting user from database:', err);
    return res.status(500).json({ error: 'Failed to delete user from database.' });
  }
});

export default router;
