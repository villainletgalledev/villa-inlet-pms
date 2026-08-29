import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  KeyRound,
  Shield,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RotateCw,
  MoreHorizontal,
  Lock,
  ChevronDown,
  UserCheck,
  UserX,
  Sparkles,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  StaffUser,
  fetchUsers,
  inviteUser,
  resetUserPassword,
  updateUserRole,
  updateUserStatus,
  deleteUser,
} from '../../../lib/api/users';
import {
  UserRole,
  ALL_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  isOwner,
  isOwnerOrManager,
  canChangeUserRole,
  canResetUserPassword,
  canToggleUserStatus,
} from '../../../lib/rbac';
import { cn } from '../../../lib/utils';

interface UsersPageProps {
  currentUser?: {
    id?: string;
    email: string;
    fullName: string;
    role: UserRole | string;
  };
  onUnauthorizedRedirect?: (reason: string) => void;
}

export const UsersPage: React.FC<UsersPageProps> = ({
  currentUser = { email: 'manager@villainlet.com', fullName: 'Villa Manager', role: 'MANAGER' },
  onUnauthorizedRedirect,
}) => {
  const userRole = (currentUser.role as UserRole) || 'MANAGER';
  const isUserOwner = isOwner(userRole);
  const isAuthorized = isOwnerOrManager(userRole);

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Add User Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('STAFF');
  const [inviteLoading, setInviteLoading] = useState(false);

  // Action Confirmation Modal
  const [actionConfirm, setActionConfirm] = useState<{
    type: 'reset_password' | 'deactivate' | 'reactivate' | 'delete';
    user: StaffUser;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Check Route Guard
  useEffect(() => {
    if (!isAuthorized) {
      if (onUnauthorizedRedirect) {
        onUnauthorizedRedirect('Access Denied: The Staff & Users module is restricted to Owner and Manager roles.');
      }
    }
  }, [isAuthorized, onUnauthorizedRedirect]);

  // Load Users
  const loadUsersData = async () => {
    setLoading(true);
    setError(null);
    const result = await fetchUsers(currentUser);
    if (result.error) {
      setError(result.error);
    } else {
      setUsers(result.users);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthorized) {
      loadUsersData();
    }
  }, [isAuthorized]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.isActive) ||
        (statusFilter === 'INACTIVE' && !u.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const inactive = total - active;
    const owners = users.filter((u) => u.role === 'OWNER').length;
    const managers = users.filter((u) => u.role === 'MANAGER').length;
    const staff = users.filter((u) => u.role === 'STAFF').length;
    const housekeeping = users.filter((u) => u.role === 'HOUSEKEEPER').length;
    const maintenance = users.filter((u) => u.role === 'MAINTENANCE').length;

    return { total, active, inactive, owners, managers, staff, housekeeping, maintenance };
  }, [users]);

  // Handle Invite
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteFullName) return;

    setInviteLoading(true);
    const result = await inviteUser(
      { email: inviteEmail.trim(), fullName: inviteFullName.trim(), role: inviteRole },
      currentUser
    );

    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast(result.message || `Invitation created for ${inviteFullName}`, 'success');
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteFullName('');
      setInviteRole('STAFF');
      loadUsersData();
    }
    setInviteLoading(false);
  };

  // Handle Role Change (OWNER only)
  const handleRoleChange = async (targetUser: StaffUser, newRole: UserRole) => {
    if (!isUserOwner) {
      showToast('Permission Denied: Only Property Owners can change staff roles.', 'error');
      return;
    }

    if (targetUser.role === newRole) return;

    const result = await updateUserRole(targetUser.id, newRole, currentUser);
    if (result.success) {
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u))
      );
      showToast(`Updated ${targetUser.fullName}'s role to ${ROLE_LABELS[newRole]}`, 'success');
    } else {
      showToast(result.error || 'Failed to update role', 'error');
    }
  };

  // Handle Status Toggle (Deactivate / Reactivate)
  const handleConfirmStatusToggle = async () => {
    if (!actionConfirm) return;
    const targetUser = actionConfirm.user;
    const newStatus = actionConfirm.type === 'reactivate';

    setActionLoading(true);
    const result = await updateUserStatus(targetUser.id, newStatus, currentUser);
    if (result.success) {
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, isActive: newStatus } : u))
      );
      showToast(
        newStatus
          ? `${targetUser.fullName}'s account has been reactivated.`
          : `${targetUser.fullName}'s account has been deactivated.`,
        'success'
      );
      setActionConfirm(null);
    } else {
      showToast(result.error || 'Failed to update account status', 'error');
    }
    setActionLoading(false);
  };

  // Handle Password Reset Trigger (OWNER only)
  const handleConfirmPasswordReset = async () => {
    if (!actionConfirm) return;
    const targetUser = actionConfirm.user;

    if (!isUserOwner) {
      showToast('Permission Denied: Only Property Owners can trigger password resets.', 'error');
      return;
    }

    setActionLoading(true);
    const result = await resetUserPassword(targetUser.id, targetUser.email, currentUser);
    if (result.success) {
      showToast(result.message || `Password reset dispatched to ${targetUser.email}`, 'success');
      setActionConfirm(null);
    } else {
      showToast(result.error || 'Failed to trigger password reset', 'error');
    }
    setActionLoading(false);
  };

  // Handle Permanent User Deletion (OWNER only)
  const handleConfirmDelete = async () => {
    if (!actionConfirm) return;
    const targetUser = actionConfirm.user;

    if (!isUserOwner) {
      showToast('Permission Denied: Only Property Owners can delete user accounts.', 'error');
      return;
    }

    setActionLoading(true);
    const result = await deleteUser(targetUser.id, currentUser);
    if (result.success) {
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      showToast(result.message || `${targetUser.fullName}'s account has been deleted.`, 'success');
      setActionConfirm(null);
    } else {
      showToast(result.error || 'Failed to delete user account', 'error');
    }
    setActionLoading(false);
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-50 text-purple-700 border-purple-200/80';
      case 'MANAGER':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
      case 'STAFF':
        return 'bg-sky-50 text-sky-700 border-sky-200/80';
      case 'HOUSEKEEPER':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      case 'MAINTENANCE':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatLastLogin = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (!isAuthorized) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center bg-white border border-rose-200 rounded-xl p-8 shadow-xs">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-xs text-slate-600 mb-4">
            The <strong>Staff & Users</strong> module is restricted to <strong>OWNER</strong> and{' '}
            <strong>MANAGER</strong> roles. Your current role is{' '}
            <span className="font-semibold text-slate-800">{userRole}</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={cn(
            'fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-xl border shadow-lg flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-3',
            toastMessage.type === 'success' && 'bg-slate-900 border-slate-800 text-white',
            toastMessage.type === 'error' && 'bg-rose-950 border-rose-800 text-rose-100',
            toastMessage.type === 'info' && 'bg-slate-900 border-slate-800 text-white'
          )}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toastMessage.type === 'info' && <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />}
          <span className="text-xs font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Staff & Access Management</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              RBAC Enabled
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Manage villa team members, role assignments, Supabase Auth accounts, and login statuses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-refresh-users"
            onClick={loadUsersData}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-medium transition-colors shadow-2xs"
            title="Refresh user list"
          >
            <RotateCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>

          <button
            id="btn-open-invite-modal"
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add / Invite Staff</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total Staff</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">Across all 5 villa roles</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-emerald-700 mb-1">
            <span>Active Personnel</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{metrics.active}</div>
          <div className="text-[11px] text-emerald-600/80 mt-1">Authorized for login</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Deactivated</span>
            <UserX className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-700">{metrics.inactive}</div>
          <div className="text-[11px] text-slate-400 mt-1">Login blocked via middleware</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-purple-700 mb-1">
            <span>Leadership</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-900">{metrics.owners + metrics.managers}</div>
          <div className="text-[11px] text-purple-600/80 mt-1">
            {metrics.owners} Owner • {metrics.managers} Manager
          </div>
        </div>
      </div>

      {/* Role Permissions Callout */}
      {!isUserOwner && (
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl px-4 py-3 text-xs text-indigo-900 flex items-start gap-3">
          <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Manager Mode Active:</span> You can invite new staff members and manage
            turnover statuses. Role modification and administrative password reset triggers are reserved strictly for
            the <strong>Property Owner</strong>.
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id="input-user-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email address..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Role:</span>
          </div>
          <select
            id="filter-user-role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Roles</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0 ml-1">
            <span>Status:</span>
          </div>
          <select
            id="filter-user-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Staff Table & Mobile Stacked Cards */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Loading staff directory...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No staff members found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'Try adjusting your search criteria or role filters.'
                : 'Get started by inviting your first team member using the button above.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (md and above) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {filteredUsers.map((user) => {
                    const canChangeThisRole = isUserOwner;
                    const canToggleThisStatus = canToggleUserStatus(userRole, user.role);
                    const canResetThisPassword = isUserOwner;

                    return (
                      <tr
                        key={user.id}
                        className={cn(
                          'hover:bg-slate-50/60 transition-colors',
                          !user.isActive && 'bg-slate-50/40 text-slate-500'
                        )}
                      >
                        {/* Name & Email */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
                                user.isActive
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-slate-200 text-slate-500'
                              )}
                            >
                              {user.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                <span>{user.fullName}</span>
                                {user.email === currentUser.email && (
                                  <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role Dropdown / Badge */}
                        <td className="py-3.5 px-4">
                          {canChangeThisRole ? (
                            <div className="relative inline-block">
                              <select
                                id={`select-role-${user.id}`}
                                value={user.role}
                                onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                                className={cn(
                                  'text-[11px] font-semibold px-2.5 py-1 rounded-full border cursor-pointer appearance-none pr-6 focus:outline-hidden focus:ring-1 focus:ring-indigo-500',
                                  getRoleBadgeStyle(user.role)
                                )}
                              >
                                {ALL_ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_LABELS[r]}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-current pointer-events-none opacity-60" />
                            </div>
                          ) : (
                            <span
                              className={cn(
                                'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
                                getRoleBadgeStyle(user.role)
                              )}
                              title={ROLE_DESCRIPTIONS[user.role]}
                            >
                              {ROLE_LABELS[user.role]}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {user.isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              <span>Inactive</span>
                            </span>
                          )}
                        </td>

                        {/* Last Login */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{formatLastLogin(user.lastLoginAt)}</span>
                          </div>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Reset Password Button (OWNER only) */}
                            <button
                              id={`btn-reset-pw-${user.id}`}
                              disabled={!canResetThisPassword}
                              onClick={() =>
                                setActionConfirm({
                                  type: 'reset_password',
                                  user,
                                })
                              }
                              className={cn(
                                'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
                                canResetThisPassword
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer'
                                  : 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 border border-slate-100'
                              )}
                              title={
                                canResetThisPassword
                                  ? 'Trigger Supabase Admin password reset email'
                                  : 'Password reset is restricted to Property Owner'
                              }
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Reset Password</span>
                            </button>

                            {/* Deactivate / Reactivate Toggle */}
                            <button
                              id={`btn-toggle-status-${user.id}`}
                              disabled={!canToggleThisStatus}
                              onClick={() =>
                                setActionConfirm({
                                  type: user.isActive ? 'deactivate' : 'reactivate',
                                  user,
                                })
                              }
                              className={cn(
                                'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors border cursor-pointer',
                                !canToggleThisStatus && 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-100 text-slate-400',
                                canToggleThisStatus &&
                                  user.isActive &&
                                  'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200/70',
                                canToggleThisStatus &&
                                  !user.isActive &&
                                  'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200/70'
                              )}
                            >
                              {user.isActive ? (
                                <>
                                  <UserX className="w-3 h-3" />
                                  <span>Deactivate</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3 h-3" />
                                  <span>Reactivate</span>
                                </>
                              )}
                            </button>

                            {/* Delete User (OWNER only) */}
                            {isUserOwner && (
                              <button
                                id={`btn-delete-user-${user.id}`}
                                onClick={() =>
                                  setActionConfirm({
                                    type: 'delete',
                                    user,
                                  })
                                }
                                title="Delete user account"
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View (below md) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const canChangeThisRole = isUserOwner;
                const canToggleThisStatus = canToggleUserStatus(userRole, user.role);
                const canResetThisPassword = isUserOwner;

                return (
                  <div
                    key={user.id}
                    className={cn(
                      'p-4 space-y-3 transition-colors',
                      !user.isActive && 'bg-slate-50/50 text-slate-500'
                    )}
                  >
                    {/* User info header & Status badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            'w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
                            user.isActive
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-slate-200 text-slate-500'
                          )}
                        >
                          {user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-sm">
                            <span className="truncate">{user.fullName}</span>
                            {user.email === currentUser.email && (
                              <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono truncate">{user.email}</div>
                        </div>
                      </div>

                      {/* Status Pill */}
                      <div className="shrink-0">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Role and Last Login */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <div>
                        {canChangeThisRole ? (
                          <div className="relative inline-block">
                            <select
                              id={`mobile-select-role-${user.id}`}
                              value={user.role}
                              onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                              className={cn(
                                'text-[11px] font-semibold px-2.5 py-1 rounded-full border cursor-pointer appearance-none pr-6 focus:outline-hidden focus:ring-1 focus:ring-indigo-500',
                                getRoleBadgeStyle(user.role)
                              )}
                            >
                              {ALL_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-current pointer-events-none opacity-60" />
                          </div>
                        ) : (
                          <span
                            className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
                              getRoleBadgeStyle(user.role)
                            )}
                            title={ROLE_DESCRIPTIONS[user.role]}
                          >
                            {ROLE_LABELS[user.role]}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{formatLastLogin(user.lastLoginAt)}</span>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        id={`mobile-btn-reset-pw-${user.id}`}
                        disabled={!canResetThisPassword}
                        onClick={() =>
                          setActionConfirm({
                            type: 'reset_password',
                            user,
                          })
                        }
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors border min-h-[38px]',
                          canResetThisPassword
                            ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 cursor-pointer'
                            : 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-100'
                        )}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Reset PW</span>
                      </button>

                      <button
                        id={`mobile-btn-toggle-status-${user.id}`}
                        disabled={!canToggleThisStatus}
                        onClick={() =>
                          setActionConfirm({
                            type: user.isActive ? 'deactivate' : 'reactivate',
                            user,
                          })
                        }
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors border min-h-[38px] cursor-pointer',
                          !canToggleThisStatus && 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-100 text-slate-400',
                          canToggleThisStatus &&
                            user.isActive &&
                            'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200/70',
                          canToggleThisStatus &&
                            !user.isActive &&
                            'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200/70'
                        )}
                      >
                        {user.isActive ? (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            <span>Deactivate</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Reactivate</span>
                          </>
                        )}
                      </button>

                      {isUserOwner && (
                        <button
                          id={`mobile-btn-delete-user-${user.id}`}
                          onClick={() =>
                            setActionConfirm({
                              type: 'delete',
                              user,
                            })
                          }
                          title="Delete user account"
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors min-h-[38px] flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Invite User Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-t-2xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Invite Team Member</h3>
              </div>
              <button
                id="btn-close-invite-modal"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Dispatches an invitation via <strong>Supabase Admin API</strong> and provisions the staff record in the PMS
              database.
            </p>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  id="input-invite-fullname"
                  type="text"
                  required
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  placeholder="e.g. David Vance"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  id="input-invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="david.vance@villainlet.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role Assignment</label>
                <select
                  id="select-invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {ALL_ROLES.filter((r) => isUserOwner || r !== 'OWNER').map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  id="btn-cancel-invite"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-invite"
                  disabled={inviteLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
                >
                  {inviteLoading ? (
                    <span>Sending Invite...</span>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      <span>Send Invitation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Action Modal */}
      {actionConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-t-2xl sm:rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className={cn(
              'w-10 h-10 rounded-xl mb-3 flex items-center justify-center',
              actionConfirm.type === 'delete' && 'bg-rose-100 text-rose-600',
              actionConfirm.type === 'reset_password' && 'bg-indigo-100 text-indigo-600',
              actionConfirm.type === 'deactivate' && 'bg-rose-100 text-rose-600',
              actionConfirm.type === 'reactivate' && 'bg-emerald-100 text-emerald-600'
            )}>
              {actionConfirm.type === 'delete' && <Trash2 className="w-5 h-5 text-rose-600" />}
              {actionConfirm.type === 'reset_password' && <KeyRound className="w-5 h-5 text-indigo-600" />}
              {actionConfirm.type === 'deactivate' && <UserX className="w-5 h-5 text-rose-600" />}
              {actionConfirm.type === 'reactivate' && <UserCheck className="w-5 h-5 text-emerald-600" />}
            </div>

            <h3 className="text-sm font-bold text-slate-900 mb-1">
              {actionConfirm.type === 'delete' && 'Delete Staff Account'}
              {actionConfirm.type === 'reset_password' && 'Reset Staff Password'}
              {actionConfirm.type === 'deactivate' && 'Deactivate Staff Account'}
              {actionConfirm.type === 'reactivate' && 'Reactivate Staff Account'}
            </h3>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              {actionConfirm.type === 'delete' && (
                <>
                  Are you sure you want to permanently delete <strong>{actionConfirm.user.fullName}</strong> ({actionConfirm.user.email})?
                  This action will remove their account and cannot be undone.
                </>
              )}
              {actionConfirm.type === 'reset_password' && (
                <>
                  Trigger a secure recovery email to <strong>{actionConfirm.user.email}</strong> via Supabase Admin API.
                  No one can set passwords directly.
                </>
              )}
              {actionConfirm.type === 'deactivate' && (
                <>
                  Deactivating <strong>{actionConfirm.user.fullName}</strong> will set their account to inactive and
                  block future sign-ins at the session middleware level.
                </>
              )}
              {actionConfirm.type === 'reactivate' && (
                <>
                  Reactivating <strong>{actionConfirm.user.fullName}</strong> will restore full login and operational
                  access to the Villa PMS.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                id="btn-cancel-action"
                onClick={() => setActionConfirm(null)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                id="btn-confirm-action"
                disabled={actionLoading}
                onClick={
                  actionConfirm.type === 'delete'
                    ? handleConfirmDelete
                    : actionConfirm.type === 'reset_password'
                    ? handleConfirmPasswordReset
                    : handleConfirmStatusToggle
                }
                className={cn(
                  'px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50',
                  actionConfirm.type === 'delete' && 'bg-rose-600 hover:bg-rose-500',
                  actionConfirm.type === 'reset_password' && 'bg-indigo-600 hover:bg-indigo-500',
                  actionConfirm.type === 'deactivate' && 'bg-rose-600 hover:bg-rose-500',
                  actionConfirm.type === 'reactivate' && 'bg-emerald-600 hover:bg-emerald-500'
                )}
              >
                {actionLoading
                  ? 'Processing...'
                  : actionConfirm.type === 'delete'
                  ? 'Delete Account'
                  : actionConfirm.type === 'reset_password'
                  ? 'Send Reset Link'
                  : actionConfirm.type === 'deactivate'
                  ? 'Deactivate User'
                  : 'Reactivate User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom spacer for viewport clearance */}
      <div className="h-[50vh]" aria-hidden="true" />
    </div>
  );
};

export default UsersPage;
