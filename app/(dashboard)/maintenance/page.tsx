import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  AlertTriangle,
  Flame,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Filter,
  RotateCcw,
  BedDouble,
  UserCheck,
  UserPlus,
  ArrowRight,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  Camera,
  Layers,
  Building,
  ShieldCheck,
  Zap,
  Droplets,
  Wind,
  Tv,
  Hammer,
  HelpCircle,
  LayoutGrid,
  ListFilter,
  Check,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react';
import {
  MaintenanceIssue,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceSummary,
  TechnicianUser,
  CATEGORY_CONFIG,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  fetchMaintenanceIssues,
  fetchMaintenanceIssue,
  createMaintenanceIssue,
  assignMaintenanceIssue,
  updateMaintenanceStatus,
  updateMaintenanceIssue,
  deleteMaintenanceIssue,
} from '../../../lib/api/maintenance';
import { Room, fetchRooms } from '../../../lib/api/rooms';
import {
  isOwnerOrManager,
  canAssignMaintenance,
  canUpdateMaintenanceStatus,
  UserRole,
  ROLE_LABELS,
} from '../../../lib/rbac';
import { cn } from '../../../lib/utils';

interface MaintenancePageProps {
  currentUser?: {
    id?: string;
    email: string;
    fullName: string;
    role: UserRole | string;
  };
}

export default function MaintenancePage({
  currentUser = { email: 'manager@villainlet.com', fullName: 'Villa Manager', role: 'MANAGER' },
}: MaintenancePageProps) {
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [summary, setSummary] = useState<MaintenanceSummary>({
    totalIssues: 0,
    openIssues: 0,
    urgentIssues: 0,
    agingIssues: 0,
    resolvedIssues: 0,
  });
  const [technicians, setTechnicians] = useState<TechnicianUser[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [roomFilter, setRoomFilter] = useState<string>('ALL');
  const [agingFilterOnly, setAgingFilterOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'BOARD' | 'LIST'>('BOARD');

  // Modals state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<MaintenanceIssue | null>(null);

  // Form states
  const [reportForm, setReportForm] = useState({
    title: '',
    description: '',
    category: 'AC' as MaintenanceCategory,
    priority: 'MEDIUM' as MaintenancePriority,
    roomId: '',
    photoUrlInput: '',
    photoUrls: [] as string[],
  });

  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: 'AC' as MaintenanceCategory,
    priority: 'MEDIUM' as MaintenancePriority,
    status: 'OPEN' as MaintenanceStatus,
    roomId: '',
    assignedToUserId: '',
    resolutionNotes: '',
  });

  const [assignForm, setAssignForm] = useState({
    assignedToUserId: '',
  });

  const [statusForm, setStatusForm] = useState({
    status: 'IN_PROGRESS' as MaintenanceStatus,
    resolutionNotes: '',
  });

  // Action status
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const canAssign = canAssignMaintenance(currentUser.role);
  const isManagerOrOwner = isOwnerOrManager(currentUser.role);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch initial data
  const loadData = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const [maintRes, roomsRes] = await Promise.all([
        fetchMaintenanceIssues({}, currentUser),
        fetchRooms(currentUser),
      ]);

      if (maintRes.issues) {
        setIssues(maintRes.issues);
      }
      if (maintRes.summary) {
        setSummary(maintRes.summary);
      }
      if (maintRes.technicians) {
        setTechnicians(maintRes.technicians);
      }
      if (roomsRes.rooms) {
        setRooms(roomsRes.rooms);
      }
    } catch (err: any) {
      console.error('Failed to load maintenance issues:', err);
      setActionError(err.message || 'Failed to load maintenance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered issues computation
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'OPEN_GROUP') {
          if (issue.status === 'RESOLVED') return false;
        } else if (issue.status !== statusFilter) {
          return false;
        }
      }
      if (priorityFilter !== 'ALL' && issue.priority !== priorityFilter) {
        return false;
      }
      if (categoryFilter !== 'ALL' && issue.category !== categoryFilter) {
        return false;
      }
      if (roomFilter !== 'ALL') {
        if (roomFilter === 'PROPERTY_WIDE') {
          if (issue.roomId !== null) return false;
        } else if (issue.roomId !== roomFilter) {
          return false;
        }
      }
      if (agingFilterOnly && !issue.isAging) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = issue.title.toLowerCase().includes(q);
        const matchDesc = issue.description.toLowerCase().includes(q);
        const matchRoom = issue.room
          ? `${issue.room.roomNumber} ${issue.room.name}`.toLowerCase().includes(q)
          : false;
        const matchCategory = CATEGORY_CONFIG[issue.category]?.label.toLowerCase().includes(q);
        const matchAssignee = issue.assignedTo?.fullName.toLowerCase().includes(q);
        return matchTitle || matchDesc || matchRoom || matchCategory || matchAssignee;
      }
      return true;
    });
  }, [issues, statusFilter, priorityFilter, categoryFilter, roomFilter, agingFilterOnly, searchQuery]);

  // Aging issues list for top alert
  const agingIssuesList = useMemo(() => {
    return issues.filter((i) => i.isAging);
  }, [issues]);

  // Category Icon helper
  const getCategoryIcon = (category: MaintenanceCategory) => {
    switch (category) {
      case 'AC':
        return <Wind className="w-3.5 h-3.5" />;
      case 'POOL':
        return <Droplets className="w-3.5 h-3.5" />;
      case 'ELECTRICAL':
        return <Zap className="w-3.5 h-3.5" />;
      case 'PLUMBING':
        return <Droplets className="w-3.5 h-3.5" />;
      case 'APPLIANCE':
        return <Tv className="w-3.5 h-3.5" />;
      case 'STRUCTURAL':
        return <Hammer className="w-3.5 h-3.5" />;
      default:
        return <Wrench className="w-3.5 h-3.5" />;
    }
  };

  // Open Report Issue Modal
  const handleOpenReport = () => {
    setReportForm({
      title: '',
      description: '',
      category: 'AC',
      priority: 'MEDIUM',
      roomId: rooms.length > 0 ? rooms[0].id : '',
      photoUrlInput: '',
      photoUrls: [],
    });
    setActionError(null);
    setIsReportModalOpen(true);
  };

  // Open Assign Modal
  const handleOpenAssign = (issue: MaintenanceIssue) => {
    if (!canAssign) return;
    setSelectedIssue(issue);
    setAssignForm({
      assignedToUserId: issue.assignedToUserId || (technicians.length > 0 ? technicians[0].id : ''),
    });
    setActionError(null);
    setIsAssignModalOpen(true);
  };

  // Open Status Transition Modal
  const handleOpenStatusModal = (issue: MaintenanceIssue, targetStatus: MaintenanceStatus) => {
    const isAssigned = currentUser.id && issue.assignedToUserId === currentUser.id;
    if (!canUpdateMaintenanceStatus(currentUser.role, Boolean(isAssigned))) {
      showToast('Only assigned technician or managers can update status', 'error');
      return;
    }

    setSelectedIssue(issue);
    setStatusForm({
      status: targetStatus,
      resolutionNotes: issue.resolutionNotes || '',
    });
    setActionError(null);
    setIsStatusModalOpen(true);
  };

  // Open Detail Modal
  const handleOpenDetail = async (issue: MaintenanceIssue) => {
    setSelectedIssue(issue);
    setIsDetailModalOpen(true);
    try {
      const res = await fetchMaintenanceIssue(issue.id, currentUser);
      if (res.issue) {
        setSelectedIssue(res.issue);
      }
    } catch {
      // ignore
    }
  };

  // Open Edit Modal (Manager/Owner only)
  const handleOpenEdit = (issue: MaintenanceIssue) => {
    if (!isManagerOrOwner) return;
    setSelectedIssue(issue);
    setEditForm({
      title: issue.title,
      description: issue.description,
      category: issue.category,
      priority: issue.priority,
      status: issue.status,
      roomId: issue.roomId || '',
      assignedToUserId: issue.assignedToUserId || '',
      resolutionNotes: issue.resolutionNotes || '',
    });
    setActionError(null);
    setIsEditModalOpen(true);
  };

  // Submit Report Form
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportForm.title.trim()) {
      setActionError('Ticket title is required.');
      return;
    }
    if (!reportForm.description.trim()) {
      setActionError('Ticket description is required.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await createMaintenanceIssue(
        {
          title: reportForm.title.trim(),
          description: reportForm.description.trim(),
          category: reportForm.category,
          priority: reportForm.priority,
          roomId: reportForm.roomId || null,
          photoUrls: reportForm.photoUrls,
        },
        currentUser
      );

      if (res.success && res.issue) {
        showToast(
          `Maintenance ticket reported: "${res.issue.title}"${
            res.issue.priority === 'HIGH' || res.issue.priority === 'URGENT'
              ? ' (Room placed Under Maintenance)'
              : ''
          }`,
          'success'
        );
        setIsReportModalOpen(false);
        await loadData();
      } else {
        setActionError(res.error || 'Failed to report ticket.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error reporting issue.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Assign Form
  const handleSubmitAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await assignMaintenanceIssue(
        selectedIssue.id,
        assignForm.assignedToUserId || null,
        currentUser
      );

      if (res.success && res.issue) {
        showToast(`Assigned ticket to ${res.issue.assignedTo?.fullName || 'Technician'}`, 'success');
        setIsAssignModalOpen(false);
        await loadData();
        if (selectedIssue.id === res.issue.id) {
          setSelectedIssue(res.issue);
        }
      } else {
        setActionError(res.error || 'Failed to assign technician.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error assigning ticket.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Status Update Form
  const handleSubmitStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) return;

    if (statusForm.status === 'CANNOT_FIX' && !statusForm.resolutionNotes.trim()) {
      setActionError('A note explaining why this issue cannot be fixed is required.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await updateMaintenanceStatus(
        selectedIssue.id,
        {
          status: statusForm.status,
          resolutionNotes: statusForm.resolutionNotes.trim() || undefined,
        },
        currentUser
      );

      if (res.success && res.issue) {
        showToast(
          `Ticket updated to ${STATUS_CONFIG[res.issue.status].label}${
            res.issue.status === 'RESOLVED' ? ' (Room status synchronized)' : ''
          }`,
          'success'
        );
        setIsStatusModalOpen(false);
        await loadData();
        if (selectedIssue.id === res.issue.id) {
          setSelectedIssue(res.issue);
        }
      } else {
        setActionError(res.error || 'Failed to update status.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error updating status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Edit Form
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue || !isManagerOrOwner) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await updateMaintenanceIssue(
        selectedIssue.id,
        {
          title: editForm.title,
          description: editForm.description,
          category: editForm.category,
          priority: editForm.priority,
          status: editForm.status,
          roomId: editForm.roomId || null,
          assignedToUserId: editForm.assignedToUserId || null,
          resolutionNotes: editForm.resolutionNotes || null,
        },
        currentUser
      );

      if (res.success && res.issue) {
        showToast(`Updated ticket: "${res.issue.title}"`, 'success');
        setIsEditModalOpen(false);
        await loadData();
      } else {
        setActionError(res.error || 'Failed to update ticket.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error updating ticket.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Ticket
  const handleDeleteTicket = async (issue: MaintenanceIssue) => {
    if (!isManagerOrOwner) return;
    if (!window.confirm(`Are you sure you want to delete ticket "${issue.title}"?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await deleteMaintenanceIssue(issue.id, currentUser);
      if (res.success) {
        showToast(`Deleted ticket "${issue.title}"`, 'success');
        setIsDetailModalOpen(false);
        setIsEditModalOpen(false);
        await loadData();
      } else {
        showToast(res.error || 'Failed to delete ticket', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting ticket', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast */}
      {toastMessage && (
        <div
          id="maintenance-toast"
          className={cn(
            'fixed top-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2',
            toastMessage.type === 'success'
              ? 'bg-slate-900 border-slate-800 text-white'
              : 'bg-rose-950 border-rose-800 text-rose-100'
          )}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-medium">{toastMessage.message}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Maintenance & Work Orders</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active PMS Module
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Work orders, HVAC & pool equipment servicing, priority work orders, and technician assignments for Villa Inlet.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="btn-report-issue-header"
            type="button"
            onClick={handleOpenReport}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Report Maintenance Issue</span>
          </button>
        </div>
      </div>

      {/* Aging Issues Alert Banner */}
      {agingIssuesList.length > 0 && (
        <div
          id="aging-issues-banner"
          className="bg-amber-50 border border-amber-300/80 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Attention: Aging Work Orders ({agingIssuesList.length}{' '}
                  {agingIssuesList.length === 1 ? 'ticket' : 'tickets'} &gt; 3 Days Old)
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                  SLA Alert
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                The following maintenance tickets have been open for over 72 hours without resolution:{' '}
                <span className="font-semibold">
                  {agingIssuesList.map((i) => `"${i.title}" (${i.ageDays}d old)`).join(' · ')}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              id="btn-filter-aging"
              type="button"
              onClick={() => setAgingFilterOnly(!agingFilterOnly)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border',
                agingFilterOnly
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
              )}
            >
              {agingFilterOnly ? 'Show All Tickets' : 'Filter Aging Only'}
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Active Open Tickets</span>
            <Wrench className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{summary.openIssues}</div>
          <div className="text-[11px] text-slate-500 mt-1">Open, Assigned & In Progress</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Urgent & High Priority</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-2xl font-bold', summary.urgentIssues > 0 ? 'text-rose-600' : 'text-slate-900')}>
              {summary.urgentIssues}
            </span>
            {summary.urgentIssues > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                Blocking Rooms
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Triggers room maintenance lock</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Aging Tickets (&gt;3d)</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-2xl font-bold', summary.agingIssues > 0 ? 'text-amber-600' : 'text-slate-900')}>
              {summary.agingIssues}
            </span>
            {summary.agingIssues > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                Review Needed
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Over 72 hours open</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Resolved & Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{summary.resolvedIssues}</div>
          <div className="text-[11px] text-slate-500 mt-1">Serviced and rooms released</div>
        </div>
      </div>

      {/* Filter and View Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-2xs space-y-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              id="status-tab-ALL"
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer',
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              All Statuses ({issues.length})
            </button>
            <button
              id="status-tab-OPEN_GROUP"
              type="button"
              onClick={() => setStatusFilter('OPEN_GROUP')}
              className={cn(
                'px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer',
                statusFilter === 'OPEN_GROUP'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              Active Work Queue ({summary.openIssues})
            </button>
            {(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANNOT_FIX'] as MaintenanceStatus[]).map((st) => {
              const count = issues.filter((i) => i.status === st).length;
              return (
                <button
                  key={st}
                  id={`status-tab-${st}`}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer',
                    statusFilter === st
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <span>{STATUS_CONFIG[st].label.split('/')[0].trim()}</span>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded font-mono',
                      statusFilter === st ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* View mode toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('BOARD')}
              title="Board view"
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'BOARD' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-400 hover:text-slate-700'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              title="List view"
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'LIST' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-400 hover:text-slate-700'
              )}
            >
              <ListFilter className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Secondary Filters: Priority, Category, Room, Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-maintenance-search"
              type="text"
              placeholder="Search issues, specs, rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div>
            <select
              id="filter-maint-priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium"
            >
              <option value="ALL">All Priorities (Urgent first)</option>
              <option value="URGENT">🔴 Urgent Priority</option>
              <option value="HIGH">🟠 High Priority</option>
              <option value="MEDIUM">🔵 Medium Priority</option>
              <option value="LOW">⚪ Low Priority</option>
            </select>
          </div>

          <div>
            <select
              id="filter-maint-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium"
            >
              <option value="ALL">All Categories</option>
              {(Object.keys(CATEGORY_CONFIG) as MaintenanceCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_CONFIG[c].label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              id="filter-maint-room"
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium"
            >
              <option value="ALL">All Locations</option>
              <option value="PROPERTY_WIDE">Property-Wide / Common Areas</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} - {r.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={loadData}
              title="Refresh tickets"
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors shrink-0"
            >
              <RotateCcw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && issues.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-2xs">
          <RotateCcw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">Loading Villa Inlet Maintenance Orders...</h3>
          <p className="text-xs text-slate-500 mt-1">Checking active work order pipeline and equipment logs.</p>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-2xs">
          <Wrench className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">No maintenance tickets found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search criteria or report a new maintenance issue.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ALL');
              setPriorityFilter('ALL');
              setCategoryFilter('ALL');
              setRoomFilter('ALL');
              setAgingFilterOnly(false);
              setSearchQuery('');
            }}
            className="mt-4 px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'BOARD' ? (
        /* ------------------------------------------------------------- */
        /* BOARD / GRID VIEW */
        /* ------------------------------------------------------------- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIssues.map((issue) => {
            const catConfig = CATEGORY_CONFIG[issue.category] || CATEGORY_CONFIG.OTHER;
            const prioConfig = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.MEDIUM;
            const statusConfig = STATUS_CONFIG[issue.status] || STATUS_CONFIG.OPEN;
            const isAssignedToMe = currentUser.id && issue.assignedToUserId === currentUser.id;
            const canUpdateThis = canUpdateMaintenanceStatus(currentUser.role, Boolean(isAssignedToMe));

            return (
              <div
                key={issue.id}
                id={`maintenance-card-${issue.id}`}
                className={cn(
                  'bg-white border rounded-xl p-4 shadow-2xs transition-all flex flex-col justify-between hover:border-slate-300 relative',
                  prioConfig.border
                )}
              >
                <div>
                  {/* Top Badges: Category, Priority, Aging */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1', catConfig.badge)}>
                        {getCategoryIcon(issue.category)}
                        <span>{catConfig.label.split('&')[0].trim()}</span>
                      </span>

                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1', prioConfig.badge)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', prioConfig.dot)} />
                        <span>{prioConfig.label}</span>
                      </span>
                    </div>

                    {issue.isAging && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300 flex items-center gap-1 shrink-0 animate-pulse">
                        <Clock className="w-3 h-3" />
                        Aging: {issue.ageDays}d
                      </span>
                    )}
                  </div>

                  {/* Title & Location */}
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{issue.title}</h3>

                  <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
                    {issue.room ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                        <BedDouble className="w-3 h-3 text-slate-500" />
                        {issue.room.roomNumber} - {issue.room.name}
                        {issue.room.status === 'MAINTENANCE' && (
                          <span className="text-[9px] font-bold px-1 rounded bg-rose-200 text-rose-800 ml-1">
                            Locked Out
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        <Building className="w-3 h-3 text-slate-500" />
                        Property-Wide Common Area
                      </span>
                    )}
                  </div>

                  {/* Description snippet */}
                  <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 leading-relaxed">
                    {issue.description}
                  </p>

                  {/* Photo thumbnail if present */}
                  {issue.photoUrls && issue.photoUrls.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                        <img
                          src={issue.photoUrls[0]}
                          alt="Issue photo"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {issue.photoUrls.length} attachment{issue.photoUrls.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}

                  {/* Resolution Notes if Resolved / Cannot Fix */}
                  {issue.resolutionNotes && (
                    <div className="mt-2.5 p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-700 space-y-0.5">
                      <span className="font-semibold text-slate-900 block">Resolution Note:</span>
                      <p className="line-clamp-2 italic">{issue.resolutionNotes}</p>
                    </div>
                  )}
                </div>

                {/* Bottom Section: Assignee + Status + Action Controls */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                  {/* Status and Assignee Info */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 font-medium">Status:</span>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', statusConfig.badge)}>
                        {statusConfig.label}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 font-medium truncate max-w-[140px]">
                      {issue.assignedTo ? (
                        <span className="flex items-center gap-1" title={`Assigned to ${issue.assignedTo.fullName}`}>
                          <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">{issue.assignedTo.fullName}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </div>
                  </div>

                  {/* Pipeline Quick Action Bar */}
                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    <div className="flex items-center gap-1.5">
                      {/* Assign button */}
                      {canAssign && (
                        <button
                          id={`btn-assign-${issue.id}`}
                          type="button"
                          onClick={() => handleOpenAssign(issue)}
                          title="Assign technician"
                          className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3 text-indigo-600" />
                          <span>{issue.assignedTo ? 'Reassign' : 'Assign'}</span>
                        </button>
                      )}

                      {/* Transition button (Assigned Tech or Manager) */}
                      {canUpdateThis && issue.status !== 'RESOLVED' && (
                        <>
                          {issue.status === 'OPEN' || issue.status === 'ASSIGNED' ? (
                            <button
                              id={`btn-start-${issue.id}`}
                              type="button"
                              onClick={() => handleOpenStatusModal(issue, 'IN_PROGRESS')}
                              className="px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Wrench className="w-3 h-3 text-amber-600" />
                              <span>Start Work</span>
                            </button>
                          ) : (
                            <button
                              id={`btn-resolve-${issue.id}`}
                              type="button"
                              onClick={() => handleOpenStatusModal(issue, 'RESOLVED')}
                              className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Resolve</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        id={`btn-detail-${issue.id}`}
                        type="button"
                        onClick={() => handleOpenDetail(issue)}
                        title="View full details & history"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      {isManagerOrOwner && (
                        <button
                          id={`btn-edit-${issue.id}`}
                          type="button"
                          onClick={() => handleOpenEdit(issue)}
                          title="Edit ticket"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ------------------------------------------------------------- */
        /* LIST / TABLE VIEW */
        /* ------------------------------------------------------------- */
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Priority & ID</th>
                  <th className="py-3 px-4">Category & Title</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assigned Tech</th>
                  <th className="py-3 px-4">Reported</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIssues.map((issue) => {
                  const catConfig = CATEGORY_CONFIG[issue.category] || CATEGORY_CONFIG.OTHER;
                  const prioConfig = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.MEDIUM;
                  const statusConfig = STATUS_CONFIG[issue.status] || STATUS_CONFIG.OPEN;
                  const isAssignedToMe = currentUser.id && issue.assignedToUserId === currentUser.id;
                  const canUpdateThis = canUpdateMaintenanceStatus(currentUser.role, Boolean(isAssignedToMe));

                  return (
                    <tr key={issue.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', prioConfig.badge)}>
                            {prioConfig.label}
                          </span>
                          {issue.isAging && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                              {issue.ageDays}d
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{issue.title}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>{catConfig.label}</span>
                          {issue.photoUrls?.length > 0 && (
                            <span className="text-indigo-600 font-medium">({issue.photoUrls.length} photos)</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {issue.room ? (
                          <span className="font-semibold text-slate-800">
                            {issue.room.roomNumber} - {issue.room.name}
                          </span>
                        ) : (
                          <span className="text-slate-500">Property-Wide</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', statusConfig.badge)}>
                          {statusConfig.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {issue.assignedTo ? (
                          <span className="font-medium text-slate-800">{issue.assignedTo.fullName}</span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                        {new Date(issue.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canAssign && (
                            <button
                              type="button"
                              onClick={() => handleOpenAssign(issue)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold"
                            >
                              Assign
                            </button>
                          )}
                          {canUpdateThis && issue.status !== 'RESOLVED' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenStatusModal(
                                  issue,
                                  issue.status === 'IN_PROGRESS' ? 'RESOLVED' : 'IN_PROGRESS'
                                )
                              }
                              className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-semibold border border-indigo-200"
                            >
                              {issue.status === 'IN_PROGRESS' ? 'Resolve' : 'Start'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(issue)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Report Issue (Open to ALL roles) */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-2xl max-w-lg w-full flex flex-col h-full sm:h-auto sm:max-h-[90vh] my-auto shadow-2xl animate-in zoom-in-95 overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-6 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Report Maintenance Issue</h3>
                  <p className="text-[11px] text-slate-500">Create a work order for engineering & facilities</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReport} className="p-4 sm:p-6 space-y-3.5 text-xs overflow-y-auto flex-1">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Issue Title *</label>
                <input
                  id="input-report-title"
                  type="text"
                  placeholder="e.g. Master Bedroom split AC condensation leak"
                  value={reportForm.title}
                  onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category *</label>
                  <select
                    id="select-report-category"
                    value={reportForm.category}
                    onChange={(e) =>
                      setReportForm({ ...reportForm, category: e.target.value as MaintenanceCategory })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900"
                  >
                    {(Object.keys(CATEGORY_CONFIG) as MaintenanceCategory[]).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_CONFIG[c].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Priority *</label>
                  <select
                    id="select-report-priority"
                    value={reportForm.priority}
                    onChange={(e) =>
                      setReportForm({ ...reportForm, priority: e.target.value as MaintenancePriority })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 font-semibold"
                  >
                    <option value="URGENT">🔴 Urgent (Blocks Room)</option>
                    <option value="HIGH">🟠 High (Blocks Room)</option>
                    <option value="MEDIUM">🔵 Medium Priority</option>
                    <option value="LOW">⚪ Low Priority</option>
                  </select>
                </div>
              </div>

              {(reportForm.priority === 'HIGH' || reportForm.priority === 'URGENT') && reportForm.roomId && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Automatic Room Lockout:</strong> Reporting a High or Urgent issue for a room will
                    automatically set the room's status to <strong>MAINTENANCE</strong> until resolved.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Location / Room</label>
                <select
                  id="select-report-room"
                  value={reportForm.roomId}
                  onChange={(e) => setReportForm({ ...reportForm, roomId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900"
                >
                  <option value="">-- Property-Wide / Central Amenities (Pool, Grounds, Gate) --</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomNumber} - {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Detailed Description *</label>
                <textarea
                  id="textarea-report-desc"
                  rows={3}
                  placeholder="Describe the issue, symptoms, exact location, error codes, or safety concerns..."
                  value={reportForm.description}
                  onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 resize-none"
                />
              </div>

              {/* Photo attachment input */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                  <span>Photo Attachments (Image URL)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={reportForm.photoUrlInput}
                    onChange={(e) => setReportForm({ ...reportForm, photoUrlInput: e.target.value })}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (reportForm.photoUrlInput.trim()) {
                        setReportForm({
                          ...reportForm,
                          photoUrls: [...reportForm.photoUrls, reportForm.photoUrlInput.trim()],
                          photoUrlInput: '',
                        });
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                  >
                    Add
                  </button>
                </div>

                {reportForm.photoUrls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {reportForm.photoUrls.map((url, idx) => (
                      <div key={idx} className="relative group w-12 h-12 rounded-lg border border-slate-200 overflow-hidden">
                        <img src={url} alt="Attachment" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() =>
                            setReportForm({
                              ...reportForm,
                              photoUrls: reportForm.photoUrls.filter((_, i) => i !== idx),
                            })
                          }
                          className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reporter Attribution */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    Reporting as: <strong className="text-slate-800">{currentUser.fullName}</strong>
                  </span>
                </div>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                  {ROLE_LABELS[currentUser.role as UserRole] || currentUser.role}
                </span>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-report"
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Submit Work Order</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Assign Technician (OWNER / MANAGER ONLY) */}
      {isAssignModalOpen && selectedIssue && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-2xl max-w-md w-full flex flex-col h-full sm:h-auto my-auto shadow-2xl animate-in zoom-in-95 overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-6 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Assign Maintenance Technician</h3>
                  <p className="text-[11px] text-slate-500">Dispatch ticket to on-duty staff</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAssign} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] text-slate-400 font-semibold block uppercase">Target Ticket</span>
                <div className="font-bold text-slate-900 mt-0.5">{selectedIssue.title}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Location: {selectedIssue.room ? `${selectedIssue.room.roomNumber} - ${selectedIssue.room.name}` : 'Property-Wide'}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Technician *</label>
                <select
                  id="select-assign-tech"
                  value={assignForm.assignedToUserId}
                  onChange={(e) => setAssignForm({ assignedToUserId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 font-medium"
                >
                  <option value="">-- Unassigned --</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.role}) - {t.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-assign"
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Confirm Assignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Update Status & Resolution Notes (Technician or Manager) */}
      {isStatusModalOpen && selectedIssue && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-2xl max-w-md w-full flex flex-col h-full sm:h-auto my-auto p-4 sm:p-6 shadow-2xl animate-in zoom-in-95 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Update Ticket Pipeline Status</h3>
                  <p className="text-[11px] text-slate-500">Log repair progress, signoff, or escalation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitStatus} className="mt-4 space-y-3.5 text-xs overflow-y-auto flex-1">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Target Status *</label>
                <select
                  id="select-update-status"
                  value={statusForm.status}
                  onChange={(e) =>
                    setStatusForm({ ...statusForm, status: e.target.value as MaintenanceStatus })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 font-semibold"
                >
                  <option value="ASSIGNED">Assigned to Tech</option>
                  <option value="IN_PROGRESS">In Progress / Servicing</option>
                  <option value="RESOLVED">Resolved & Serviced (Release Room)</option>
                  <option value="CANNOT_FIX">Cannot Fix / Outside Contractor Required</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Resolution Notes {statusForm.status === 'CANNOT_FIX' ? '(Required *)' : '(Optional)'}
                </label>
                <textarea
                  id="textarea-status-notes"
                  rows={3}
                  placeholder={
                    statusForm.status === 'CANNOT_FIX'
                      ? 'Explain why this cannot be fixed in-house (e.g. Specialized parts backordered, vendor service scheduled)...'
                      : 'Describe the repairs performed, replacement parts used, and testing confirmation...'
                  }
                  value={statusForm.resolutionNotes}
                  onChange={(e) => setStatusForm({ ...statusForm, resolutionNotes: e.target.value })}
                  required={statusForm.status === 'CANNOT_FIX'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 resize-none"
                />
              </div>

              {statusForm.status === 'RESOLVED' && selectedIssue.room && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Room Status Release:</strong> Marking this issue as Resolved will automatically check if
                    any other High/Urgent issues remain. If none, Room {selectedIssue.room.roomNumber} will revert to{' '}
                    <strong>AVAILABLE</strong>.
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-status"
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Status Change</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Issue Detail View */}
      {isDetailModalOpen && selectedIssue && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-2xl max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] my-auto flex flex-col p-4 sm:p-6 shadow-2xl animate-in zoom-in-95 overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1',
                      CATEGORY_CONFIG[selectedIssue.category]?.badge
                    )}
                  >
                    {getCategoryIcon(selectedIssue.category)}
                    {CATEGORY_CONFIG[selectedIssue.category]?.label}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                      PRIORITY_CONFIG[selectedIssue.priority]?.badge
                    )}
                  >
                    {PRIORITY_CONFIG[selectedIssue.priority]?.label}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                      STATUS_CONFIG[selectedIssue.status]?.badge
                    )}
                  >
                    {STATUS_CONFIG[selectedIssue.status]?.label}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-2">{selectedIssue.title}</h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isManagerOrOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenEdit(selectedIssue);
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit Ticket"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 text-xs">
              {/* Location Card */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium block">Location</span>
                    <span className="font-bold text-slate-900">
                      {selectedIssue.room
                        ? `${selectedIssue.room.roomNumber} - ${selectedIssue.room.name}`
                        : 'Property-Wide Common Area'}
                    </span>
                  </div>
                </div>
                {selectedIssue.room?.status === 'MAINTENANCE' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                    Room Locked Out
                  </span>
                )}
              </div>

              {/* Description */}
              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">
                  Problem Description
                </h4>
                <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                  {selectedIssue.description}
                </p>
              </div>

              {/* Photo Gallery */}
              {selectedIssue.photoUrls && selectedIssue.photoUrls.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                    Photo Attachments ({selectedIssue.photoUrls.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedIssue.photoUrls.map((url, i) => (
                      <div key={i} className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 h-40">
                        <img
                          src={url}
                          alt={`Attachment ${i + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution Notes */}
              {selectedIssue.resolutionNotes && (
                <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Resolution & Service Notes</span>
                  </div>
                  <p className="text-emerald-800 leading-relaxed italic">{selectedIssue.resolutionNotes}</p>
                </div>
              )}

              {/* People & Meta info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                <div>
                  <span className="block text-slate-400">Reported By:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedIssue.reportedBy?.fullName || 'Staff'} ({selectedIssue.reportedBy?.role || 'User'})
                  </span>
                  <span className="block text-slate-400 mt-0.5">
                    {new Date(selectedIssue.createdAt).toLocaleString()}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-400">Assigned Technician:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedIssue.assignedTo?.fullName || 'None Assigned'}
                  </span>
                  {selectedIssue.resolvedAt && (
                    <span className="block text-slate-400 mt-0.5">
                      Resolved: {new Date(selectedIssue.resolvedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              {isManagerOrOwner && (
                <button
                  type="button"
                  onClick={() => handleDeleteTicket(selectedIssue)}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors flex items-center gap-1 border border-rose-200 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Ticket</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Edit Ticket (OWNER / MANAGER ONLY) */}
      {isEditModalOpen && selectedIssue && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-2xl max-w-lg w-full flex flex-col h-full sm:h-auto sm:max-h-[90vh] my-auto p-4 sm:p-6 shadow-2xl animate-in zoom-in-95 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Maintenance Ticket</h3>
                  <p className="text-[11px] text-slate-500">Update parameters, room allocation, and priority</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitEdit} className="mt-4 space-y-3.5 text-xs overflow-y-auto flex-1">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Title *</label>
                <input
                  id="input-edit-maint-title"
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category *</label>
                  <select
                    id="select-edit-maint-category"
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm({ ...editForm, category: e.target.value as MaintenanceCategory })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-slate-900"
                  >
                    {(Object.keys(CATEGORY_CONFIG) as MaintenanceCategory[]).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_CONFIG[c].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Priority *</label>
                  <select
                    id="select-edit-maint-priority"
                    value={editForm.priority}
                    onChange={(e) =>
                      setEditForm({ ...editForm, priority: e.target.value as MaintenancePriority })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-slate-900 font-semibold"
                  >
                    <option value="URGENT">🔴 Urgent</option>
                    <option value="HIGH">🟠 High</option>
                    <option value="MEDIUM">🔵 Medium</option>
                    <option value="LOW">⚪ Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Status *</label>
                  <select
                    id="select-edit-maint-status"
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value as MaintenanceStatus })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-slate-900 font-semibold"
                  >
                    <option value="OPEN">Open</option>
                    <option value="ASSIGNED">Assigned</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CANNOT_FIX">Cannot Fix</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Location / Room</label>
                  <select
                    id="select-edit-maint-room"
                    value={editForm.roomId}
                    onChange={(e) => setEditForm({ ...editForm, roomId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-slate-900"
                  >
                    <option value="">-- Property-Wide Common Area --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.roomNumber} - {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Assigned Technician</label>
                <select
                  id="select-edit-maint-tech"
                  value={editForm.assignedToUserId}
                  onChange={(e) => setEditForm({ ...editForm, assignedToUserId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-slate-900"
                >
                  <option value="">-- Unassigned --</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description *</label>
                <textarea
                  id="textarea-edit-maint-desc"
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-slate-900 resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Resolution Notes</label>
                <textarea
                  id="textarea-edit-maint-notes"
                  rows={2}
                  value={editForm.resolutionNotes}
                  onChange={(e) => setEditForm({ ...editForm, resolutionNotes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-slate-900 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-update-maint-submit"
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom spacer for viewport clearance */}
      <div className="h-[50vh]" aria-hidden="true" />
    </div>
  );
}
