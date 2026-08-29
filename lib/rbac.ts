export type UserRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'HOUSEKEEPER' | 'MAINTENANCE';

export const ALL_ROLES: UserRole[] = ['OWNER', 'MANAGER', 'STAFF', 'HOUSEKEEPER', 'MAINTENANCE'];

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  OWNER: 100,
  MANAGER: 80,
  STAFF: 50,
  HOUSEKEEPER: 30,
  MAINTENANCE: 30,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: 'Owner',
  MANAGER: 'General Manager',
  STAFF: 'Front Desk / Staff',
  HOUSEKEEPER: 'Housekeeping',
  MAINTENANCE: 'Maintenance',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  OWNER: 'Full access to financial reports, property settings, user management, and role modifications.',
  MANAGER: 'Day-to-day operations, booking management, staff schedules, and user invitations.',
  STAFF: 'Front-desk operations, guest check-in/out, reservations, and room assignment views.',
  HOUSEKEEPER: 'Cleaning turnover logs, room cleanliness status updates, and linen inventory tracking.',
  MAINTENANCE: 'Work order tickets, repair status updates, and equipment servicing logs.',
};

/**
 * Checks if the given role is in the allowed list of roles.
 */
export function hasRole(currentRole: string | undefined | null, allowedRoles: UserRole[]): boolean {
  if (!currentRole) return false;
  return allowedRoles.includes(currentRole as UserRole);
}

/**
 * Checks if user is an OWNER.
 */
export function isOwner(role: string | undefined | null): boolean {
  return role === 'OWNER';
}

/**
 * Checks if user is OWNER or MANAGER.
 */
export function isOwnerOrManager(role: string | undefined | null): boolean {
  return role === 'OWNER' || role === 'MANAGER';
}

/**
 * Checks if current user can create/edit bookings (OWNER, MANAGER, STAFF).
 */
export function canManageBookings(role: string | undefined | null): boolean {
  return role === 'OWNER' || role === 'MANAGER' || role === 'STAFF';
}

/**
 * Checks if current user can configure recurring cleaning schedules and full task administration (OWNER, MANAGER).
 */
export function canManageHousekeepingSchedules(role: string | undefined | null): boolean {
  return role === 'OWNER' || role === 'MANAGER';
}

/**
 * Checks if current user can assign or reassign housekeeping tasks (OWNER, MANAGER).
 */
export function canAssignHousekeepingTasks(role: string | undefined | null): boolean {
  return role === 'OWNER' || role === 'MANAGER';
}

/**
 * Checks if current user can view and execute housekeeping tasks (OWNER, MANAGER, STAFF, HOUSEKEEPER).
 */
export function canAccessHousekeeping(role: string | undefined | null): boolean {
  return true; // All roles can see housekeeping view appropriate to their permission level
}

/**
 * Checks if current user can report maintenance issues (All roles).
 */
export function canReportMaintenance(role: string | undefined | null): boolean {
  return true;
}

/**
 * Checks if current user can assign maintenance issues (OWNER, MANAGER).
 */
export function canAssignMaintenance(role: string | undefined | null): boolean {
  return isOwnerOrManager(role);
}

/**
 * Checks if current user can update maintenance issue status / resolve (OWNER, MANAGER, MAINTENANCE, or assigned user).
 */
export function canUpdateMaintenanceStatus(
  role: string | undefined | null,
  isAssignedUser: boolean = false
): boolean {
  if (isOwnerOrManager(role)) return true;
  if (role === 'MAINTENANCE') return true;
  return isAssignedUser;
}

/**
 * Checks if current user can view the /users management module (OWNER or MANAGER).
 */
export function canAccessUsersTab(role: string | undefined | null): boolean {
  return isOwnerOrManager(role);
}

/**
 * Checks if current user can change another user's role (OWNER only).
 */
export function canChangeUserRole(role: string | undefined | null): boolean {
  return isOwner(role);
}

/**
 * Checks if current user can trigger a password reset for another user (OWNER only).
 */
export function canResetUserPassword(role: string | undefined | null): boolean {
  return isOwner(role);
}

/**
 * Checks if current user can deactivate/activate another user (OWNER or MANAGER).
 * Managers cannot deactivate Owners or other Managers.
 */
export function canToggleUserStatus(
  currentRole: string | undefined | null,
  targetRole: string | undefined | null
): boolean {
  if (!currentRole) return false;
  if (isOwner(currentRole)) return true;
  if (isOwnerOrManager(currentRole)) {
    // Managers can only deactivate lower tier staff
    return targetRole !== 'OWNER' && targetRole !== 'MANAGER';
  }
  return false;
}

/**
 * Reusable server-side / handler RBAC assertion helper.
 * Throws an error or returns a boolean indicating whether the action is permitted.
 */
export function requireRole(
  allowedRoles: UserRole[],
  currentRole: string | undefined | null
): { authorized: boolean; error?: string } {
  if (!currentRole || !allowedRoles.includes(currentRole as UserRole)) {
    return {
      authorized: false,
      error: `Access Denied: Action requires one of [${allowedRoles.join(', ')}]. Current role is ${currentRole || 'none'}.`,
    };
  }
  return { authorized: true };
}
