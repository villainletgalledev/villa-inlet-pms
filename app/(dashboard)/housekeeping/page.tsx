import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  Play,
  RotateCw,
  Calendar,
  UserCheck,
  UserX,
  Building,
  CheckSquare,
  Square,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  Settings2,
  Trash2,
  Edit,
  X,
  Users,
  Layers,
  ArrowRight,
  Sparkle,
  Truck,
  ShieldAlert,
  Info,
  CalendarDays,
  Repeat,
  Flame,
  Check,
} from 'lucide-react';
import {
  HousekeepingTask,
  HousekeepingTaskType,
  HousekeepingTaskStatus,
  RecurringCleaningSchedule,
  ScheduleFrequency,
  ChecklistItem,
  fetchHousekeepingTasks,
  createHousekeepingTask,
  updateHousekeepingTask,
  deleteHousekeepingTask,
  fetchRecurringSchedules,
  createRecurringSchedule,
  updateRecurringSchedule,
  deleteRecurringSchedule,
  triggerHousekeepingGeneration,
  TASK_TYPE_CONFIG,
  TASK_STATUS_CONFIG,
  FREQUENCY_CONFIG,
  DAYS_OF_WEEK,
  DEFAULT_CHECKOUT_CHECKLIST,
  DEFAULT_RECURRING_CHECKLIST,
  DEFAULT_DEEP_CLEAN_CHECKLIST,
} from '../../../lib/api/housekeeping';
import { Room, fetchRooms } from '../../../lib/api/rooms';
import { StaffUser, fetchAssignees } from '../../../lib/api/users';
import {
  isOwnerOrManager,
  canManageHousekeepingSchedules,
  canAssignHousekeepingTasks,
  UserRole,
} from '../../../lib/rbac';
import { cn } from '../../../lib/utils';

interface HousekeepingPageProps {
  currentUser?: {
    id?: string;
    email: string;
    fullName: string;
    role: string;
  };
}

export const HousekeepingPage: React.FC<HousekeepingPageProps> = ({
  currentUser = { email: 'manager@villainlet.com', fullName: 'Villa Manager', role: 'MANAGER' },
}) => {
  const [activeTab, setActiveTab] = useState<'board' | 'schedules'>('board');
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [schedules, setSchedules] = useState<RecurringCleaningSchedule[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [housekeepers, setHousekeepers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Filters
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('ALL');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [activeTaskModal, setActiveTaskModal] = useState<HousekeepingTask | null>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RecurringCleaningSchedule | null>(null);

  // Form states for new task
  const [newTaskForm, setNewTaskForm] = useState<{
    roomId: string;
    assignedToUserId: string;
    taskType: HousekeepingTaskType;
    scheduledDate: string;
    isOutsourced: boolean;
    outsourcedVendorName: string;
    notes: string;
    templateType: 'checkout' | 'recurring' | 'deep' | 'custom';
  }>({
    roomId: '',
    assignedToUserId: '',
    taskType: 'CHECKOUT_CLEAN',
    scheduledDate: new Date().toISOString().split('T')[0],
    isOutsourced: false,
    outsourcedVendorName: '',
    notes: '',
    templateType: 'checkout',
  });

  // Form states for schedule
  const [scheduleForm, setScheduleForm] = useState<{
    roomId: string;
    frequency: ScheduleFrequency;
    dayOfWeek: number;
    dayOfMonth: number;
    specificDate: string;
    isOutsourced: boolean;
    outsourcedVendorName: string;
    active: boolean;
    templateType: 'recurring' | 'deep' | 'checkout';
  }>({
    roomId: '',
    frequency: 'WEEKLY',
    dayOfWeek: 1, // Monday
    dayOfMonth: 1,
    specificDate: new Date().toISOString().split('T')[0],
    isOutsourced: false,
    outsourcedVendorName: '',
    active: true,
    templateType: 'recurring',
  });

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const isManagerOrOwner = isOwnerOrManager(currentUser.role);
  const isHousekeeper = currentUser.role === 'HOUSEKEEPER';

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, schedRes, roomsRes, usersRes] = await Promise.all([
        fetchHousekeepingTasks({}, currentUser),
        fetchRecurringSchedules(currentUser),
        fetchRooms(currentUser),
        fetchAssignees('HOUSEKEEPER', currentUser),
      ]);

      if (tasksRes.tasks) setTasks(tasksRes.tasks);
      if (schedRes.schedules) setSchedules(schedRes.schedules);
      if (roomsRes.rooms) setRooms(roomsRes.rooms);
      if (usersRes.users) setHousekeepers(usersRes.users);
    } catch (err) {
      console.error('Failed to load housekeeping data:', err);
      showToast('Failed to load housekeeping tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser.role]);

  // Set default room in forms once rooms load
  useEffect(() => {
    if (rooms.length > 0) {
      if (!newTaskForm.roomId) setNewTaskForm((prev) => ({ ...prev, roomId: rooms[0].id }));
      if (!scheduleForm.roomId) setScheduleForm((prev) => ({ ...prev, roomId: rooms[0].id }));
    }
  }, [rooms]);

  const handleSyncEngine = async () => {
    setSyncing(true);
    try {
      const res = await triggerHousekeepingGeneration(currentUser);
      if (res.success) {
        showToast(res.message || 'Housekeeping turnover engine synced successfully!', 'success');
        await loadData();
      } else {
        showToast(res.error || 'Failed to sync turnover engine', 'error');
      }
    } catch (err: any) {
      showToast('Error syncing housekeeping tasks', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedRoomFilter !== 'ALL' && t.roomId !== selectedRoomFilter) return false;
      if (selectedStaffFilter === 'UNASSIGNED' && t.assignedToUserId !== null) return false;
      if (selectedStaffFilter !== 'ALL' && selectedStaffFilter !== 'UNASSIGNED' && t.assignedToUserId !== selectedStaffFilter)
        return false;
      if (selectedTypeFilter !== 'ALL' && t.taskType !== selectedTypeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const roomName = t.room?.name?.toLowerCase() || '';
        const roomNum = t.room?.roomNumber?.toLowerCase() || '';
        const notes = t.notes?.toLowerCase() || '';
        const vendor = t.outsourcedVendorName?.toLowerCase() || '';
        const staff = t.assignedTo?.fullName?.toLowerCase() || '';
        if (!roomName.includes(q) && !roomNum.includes(q) && !notes.includes(q) && !vendor.includes(q) && !staff.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, selectedRoomFilter, selectedStaffFilter, selectedTypeFilter, searchQuery]);

  // Tasks partitioned into Kanban columns
  const pendingTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'PENDING'), [filteredTasks]);
  const inProgressTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'IN_PROGRESS'), [filteredTasks]);
  const doneTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'DONE'), [filteredTasks]);

  // Task Status updates
  const handleUpdateTaskStatus = async (task: HousekeepingTask, newStatus: HousekeepingTaskStatus, forceDone = false) => {
    try {
      const res = await updateHousekeepingTask(task.id, { status: newStatus, forceDone }, currentUser);
      if (res.error) {
        if (res.requiresAllChecked) {
          showToast('All checklist items must be completed before marking as Done.', 'error');
        } else {
          showToast(res.error, 'error');
        }
        return;
      }

      if (res.task) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? res.task! : t)));
        if (activeTaskModal?.id === task.id) {
          setActiveTaskModal(res.task);
        }

        if (newStatus === 'DONE') {
          showToast(`Task for ${task.room?.roomNumber} marked Completed! Suite is now Available.`, 'success');
        } else if (newStatus === 'IN_PROGRESS') {
          showToast(`Turnover for ${task.room?.roomNumber} is now In Progress.`, 'info');
        }
      }
    } catch (err) {
      showToast('Failed to update task status', 'error');
    }
  };

  // Checklist Item Toggle
  const handleToggleChecklistItem = async (task: HousekeepingTask, itemId: string) => {
    const updatedChecklist = (task.checklist || []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );

    try {
      const res = await updateHousekeepingTask(task.id, { checklist: updatedChecklist }, currentUser);
      if (res.error) {
        showToast(res.error, 'error');
        return;
      }

      if (res.task) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? res.task! : t)));
        setActiveTaskModal(res.task);

        if (res.task.status === 'DONE' && task.status !== 'DONE') {
          showToast(`All items checked! Task for ${task.room?.roomNumber} completed & Suite is Available!`, 'success');
        }
      }
    } catch (err) {
      showToast('Failed to update checklist item', 'error');
    }
  };

  // Assign staff to task
  const handleAssignStaff = async (task: HousekeepingTask, staffId: string | null) => {
    try {
      const res = await updateHousekeepingTask(task.id, { assignedToUserId: staffId || '' as any }, currentUser);
      if (res.error) {
        showToast(res.error, 'error');
        return;
      }
      if (res.task) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? res.task! : t)));
        if (activeTaskModal?.id === task.id) setActiveTaskModal(res.task);
        showToast('Housekeeper assigned successfully', 'success');
      }
    } catch (err) {
      showToast('Failed to assign staff', 'error');
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to remove this housekeeping task?')) return;
    try {
      const res = await deleteHousekeepingTask(taskId, currentUser);
      if (res.success) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        if (activeTaskModal?.id === taskId) setActiveTaskModal(null);
        showToast('Housekeeping task deleted', 'info');
      } else {
        showToast(res.error || 'Failed to delete task', 'error');
      }
    } catch (err) {
      showToast('Error deleting task', 'error');
    }
  };

  // Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskForm.roomId) {
      showToast('Please select a villa suite', 'error');
      return;
    }

    let checklist = DEFAULT_CHECKOUT_CHECKLIST;
    if (newTaskForm.templateType === 'recurring') checklist = DEFAULT_RECURRING_CHECKLIST;
    else if (newTaskForm.templateType === 'deep') checklist = DEFAULT_DEEP_CLEAN_CHECKLIST;

    try {
      const res = await createHousekeepingTask(
        {
          roomId: newTaskForm.roomId,
          assignedToUserId: newTaskForm.assignedToUserId || null,
          taskType: newTaskForm.taskType,
          status: 'PENDING',
          scheduledDate: newTaskForm.scheduledDate,
          isOutsourced: newTaskForm.isOutsourced,
          outsourcedVendorName: newTaskForm.isOutsourced ? newTaskForm.outsourcedVendorName : null,
          checklist: checklist as any,
          notes: newTaskForm.notes,
        },
        currentUser
      );

      if (res.error) {
        showToast(res.error, 'error');
        return;
      }

      if (res.task) {
        setTasks((prev) => [res.task!, ...prev]);
        setShowCreateTaskModal(false);
        setNewTaskForm({
          roomId: rooms[0]?.id || '',
          assignedToUserId: '',
          taskType: 'CHECKOUT_CLEAN',
          scheduledDate: new Date().toISOString().split('T')[0],
          isOutsourced: false,
          outsourcedVendorName: '',
          notes: '',
          templateType: 'checkout',
        });
        showToast('Housekeeping task scheduled successfully!', 'success');
      }
    } catch (err) {
      showToast('Failed to create task', 'error');
    }
  };

  // Schedule Save / Update
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.roomId) {
      showToast('Please select a suite for the schedule', 'error');
      return;
    }

    let template = DEFAULT_RECURRING_CHECKLIST;
    if (scheduleForm.templateType === 'deep') template = DEFAULT_DEEP_CLEAN_CHECKLIST;
    else if (scheduleForm.templateType === 'checkout') template = DEFAULT_CHECKOUT_CHECKLIST;

    try {
      if (editingSchedule) {
        const res = await updateRecurringSchedule(
          editingSchedule.id,
          {
            roomId: scheduleForm.roomId,
            frequency: scheduleForm.frequency,
            dayOfWeek: scheduleForm.frequency === 'WEEKLY' ? Number(scheduleForm.dayOfWeek) : null,
            dayOfMonth: scheduleForm.frequency === 'MONTHLY' ? Number(scheduleForm.dayOfMonth) : null,
            specificDate: scheduleForm.frequency === 'SPECIFIC_DATE' ? scheduleForm.specificDate : null,
            isOutsourced: scheduleForm.isOutsourced,
            outsourcedVendorName: scheduleForm.isOutsourced ? scheduleForm.outsourcedVendorName : null,
            active: scheduleForm.active,
            checklistTemplate: template as any,
          },
          currentUser
        );

        if (res.error) {
          showToast(res.error, 'error');
          return;
        }

        if (res.schedule) {
          setSchedules((prev) => prev.map((s) => (s.id === editingSchedule.id ? res.schedule! : s)));
          setShowScheduleModal(false);
          setEditingSchedule(null);
          showToast('Recurring cleaning schedule updated!', 'success');
        }
      } else {
        const res = await createRecurringSchedule(
          {
            roomId: scheduleForm.roomId,
            frequency: scheduleForm.frequency,
            dayOfWeek: scheduleForm.frequency === 'WEEKLY' ? Number(scheduleForm.dayOfWeek) : null,
            dayOfMonth: scheduleForm.frequency === 'MONTHLY' ? Number(scheduleForm.dayOfMonth) : null,
            specificDate: scheduleForm.frequency === 'SPECIFIC_DATE' ? scheduleForm.specificDate : null,
            isOutsourced: scheduleForm.isOutsourced,
            outsourcedVendorName: scheduleForm.isOutsourced ? scheduleForm.outsourcedVendorName : null,
            active: scheduleForm.active,
            checklistTemplate: template as any,
          },
          currentUser
        );

        if (res.error) {
          showToast(res.error, 'error');
          return;
        }

        if (res.schedule) {
          setSchedules((prev) => [res.schedule!, ...prev]);
          setShowScheduleModal(false);
          showToast('New recurring cleaning schedule established!', 'success');
        }
      }
    } catch (err) {
      showToast('Failed to save recurring schedule', 'error');
    }
  };

  const handleDeleteSchedule = async (schedId: string) => {
    if (!confirm('Are you sure you want to remove this recurring cleaning schedule?')) return;
    try {
      const res = await deleteRecurringSchedule(schedId, currentUser);
      if (res.success) {
        setSchedules((prev) => prev.filter((s) => s.id !== schedId));
        showToast('Recurring schedule removed', 'info');
      } else {
        showToast(res.error || 'Failed to remove schedule', 'error');
      }
    } catch (err) {
      showToast('Error removing schedule', 'error');
    }
  };

  const handleToggleScheduleActive = async (schedule: RecurringCleaningSchedule) => {
    try {
      const res = await updateRecurringSchedule(schedule.id, { active: !schedule.active }, currentUser);
      if (res.schedule) {
        setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? res.schedule! : s)));
        showToast(
          `Schedule for ${schedule.room?.roomNumber} ${res.schedule.active ? 'Activated' : 'Paused'}`,
          'info'
        );
      }
    } catch (err) {
      showToast('Failed to toggle schedule state', 'error');
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter((t) => t.status === 'PENDING').length;
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const doneToday = tasks.filter((t) => t.status === 'DONE').length;
    const activeHousekeepers = housekeepers.filter((h) => h.isActive).length;
    return { total, pending, inProgress, doneToday, activeHousekeepers };
  }, [tasks, housekeepers]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3',
            toastMessage.type === 'success' && 'bg-emerald-900 text-white border-emerald-700',
            toastMessage.type === 'error' && 'bg-rose-900 text-white border-rose-700',
            toastMessage.type === 'info' && 'bg-slate-900 text-white border-slate-700'
          )}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toastMessage.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Housekeeping & Turnovers</h1>
                {isHousekeeper && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    Housekeeper Mode (Assigned Tasks)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Suite turnover workflows, interactive readiness checklists, staff assignment, and recurring clean schedules.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sync Trigger */}
          <button
            id="btn-sync-housekeeping"
            onClick={handleSyncEngine}
            disabled={syncing || loading}
            className="flex items-center gap-1.5 px-3 py-2 text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
            title="Auto-scan check-out dates and trigger pending turnover cleans"
          >
            <RotateCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
            <span>{syncing ? 'Scanning Turnovers...' : 'Auto-Sync Cleans'}</span>
          </button>

          {/* Create Task Button (Manager/Owner/Staff) */}
          {!isHousekeeper && (
            <button
              id="btn-new-cleaning-task"
              onClick={() => setShowCreateTaskModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Clean</span>
            </button>
          )}

          {/* New Schedule Button (Manager/Owner) */}
          {isManagerOrOwner && (
            <button
              id="btn-new-recurring-schedule"
              onClick={() => {
                setEditingSchedule(null);
                setScheduleForm({
                  roomId: rooms[0]?.id || '',
                  frequency: 'WEEKLY',
                  dayOfWeek: 1,
                  dayOfMonth: 1,
                  specificDate: new Date().toISOString().split('T')[0],
                  isOutsourced: false,
                  outsourcedVendorName: '',
                  active: true,
                  templateType: 'recurring',
                });
                setShowScheduleModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Recurring Schedule</span>
            </button>
          )}
        </div>
      </div>

      {/* Analytics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Pending Turnovers</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{metrics.pending}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">In Progress</div>
            <div className="text-xl font-bold text-blue-600 mt-0.5">{metrics.inProgress}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Play className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Completed Cleans</div>
            <div className="text-xl font-bold text-emerald-600 mt-0.5">{metrics.doneToday}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Housekeepers Active</div>
            <div className="text-xl font-bold text-indigo-600 mt-0.5">{metrics.activeHousekeepers}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('board')}
            className={cn(
              'px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap',
              activeTab === 'board'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Turnover Task Board</span>
            <span
              className={cn(
                'px-1.5 py-0.2 text-[10px] rounded-full',
                activeTab === 'board' ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'
              )}
            >
              {tasks.length}
            </span>
          </button>

          {isManagerOrOwner && (
            <button
              onClick={() => setActiveTab('schedules')}
              className={cn(
                'px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap',
                activeTab === 'schedules'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Recurring Cleaning Schedules</span>
              <span
                className={cn(
                  'px-1.5 py-0.2 text-[10px] rounded-full',
                  activeTab === 'schedules' ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'
                )}
              >
                {schedules.length}
              </span>
            </button>
          )}
        </div>

        {activeTab === 'board' && (
          <div className="text-xs text-slate-400 hidden lg:block shrink-0">
            Auto-syncs room readiness back to <strong>Available</strong> upon completion.
          </div>
        )}
      </div>

      {/* TAB 1: KANBAN TASK BOARD */}
      {activeTab === 'board' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 flex-1">
              {/* Search */}
              <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[160px] sm:max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search suite, notes, staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Room Filter */}
              <select
                value={selectedRoomFilter}
                onChange={(e) => setSelectedRoomFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 flex-1 sm:flex-initial"
              >
                <option value="ALL">All Suites</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber} - {r.name}
                  </option>
                ))}
              </select>

              {/* Staff Filter (Hidden for Housekeeper role) */}
              {!isHousekeeper && (
                <select
                  value={selectedStaffFilter}
                  onChange={(e) => setSelectedStaffFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 flex-1 sm:flex-initial"
                >
                  <option value="ALL">All Staff</option>
                  <option value="UNASSIGNED">Unassigned Only</option>
                  {housekeepers.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.fullName}
                    </option>
                  ))}
                </select>
              )}

              {/* Task Type Filter */}
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 flex-1 sm:flex-initial"
              >
                <option value="ALL">All Clean Types</option>
                <option value="CHECKOUT_CLEAN">Turnover Clean</option>
                <option value="RECURRING_CLEAN">Daily Refresh</option>
                <option value="DEEP_CLEAN">Deep Clean</option>
                <option value="OUTSOURCED">Outsourced Vendor</option>
              </select>
            </div>

            {(selectedRoomFilter !== 'ALL' || selectedStaffFilter !== 'ALL' || selectedTypeFilter !== 'ALL' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedRoomFilter('ALL');
                  setSelectedStaffFilter('ALL');
                  setSelectedTypeFilter('ALL');
                  setSearchQuery('');
                }}
                className="text-xs text-amber-600 hover:text-amber-700 font-semibold self-end sm:self-auto"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Mobile Swipe Hint */}
          <div className="flex md:hidden items-center justify-between text-[11px] text-slate-400 px-1">
            <span>Swipe horizontally to view status columns</span>
            <span className="font-medium text-amber-700">3 Board Columns</span>
          </div>

          {/* Kanban Board 3 Columns (Scrollable on mobile, Grid on desktop) */}
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading housekeeping task board...</p>
            </div>
          ) : (
            <div className="flex overflow-x-auto pb-4 md:pb-0 md:grid md:grid-cols-3 gap-4 md:gap-5 items-start snap-x snap-mandatory scrollbar-none">
              {/* COLUMN 1: PENDING */}
              <div className="bg-slate-100/70 border border-slate-200 rounded-2xl p-4 space-y-3 min-w-[85vw] sm:min-w-[340px] md:min-w-0 flex-1 shrink-0 snap-center">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Pending Turnover
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
                    {pendingTasks.length}
                  </span>
                </div>

                {pendingTasks.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-xs italic bg-white/60 rounded-xl border border-dashed border-slate-200">
                    No pending tasks in queue
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isHousekeeper={isHousekeeper}
                        isManagerOrOwner={isManagerOrOwner}
                        housekeepers={housekeepers}
                        onOpenModal={() => setActiveTaskModal(task)}
                        onStartClean={() => handleUpdateTaskStatus(task, 'IN_PROGRESS')}
                        onAssign={(staffId) => handleAssignStaff(task, staffId)}
                        onDelete={() => handleDeleteTask(task.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* COLUMN 2: IN PROGRESS */}
              <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-4 space-y-3 min-w-[85vw] sm:min-w-[340px] md:min-w-0 flex-1 shrink-0 snap-center">
                <div className="flex items-center justify-between pb-2 border-b border-blue-200/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                      In Progress
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white text-blue-700 border border-blue-200 shadow-2xs">
                    {inProgressTasks.length}
                  </span>
                </div>

                {inProgressTasks.length === 0 ? (
                  <div className="py-10 text-center text-blue-400 text-xs italic bg-white/60 rounded-xl border border-dashed border-blue-200">
                    No active cleans underway
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inProgressTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isHousekeeper={isHousekeeper}
                        isManagerOrOwner={isManagerOrOwner}
                        housekeepers={housekeepers}
                        onOpenModal={() => setActiveTaskModal(task)}
                        onAssign={(staffId) => handleAssignStaff(task, staffId)}
                        onDelete={() => handleDeleteTask(task.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* COLUMN 3: DONE */}
              <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 space-y-3 min-w-[85vw] sm:min-w-[340px] md:min-w-0 flex-1 shrink-0 snap-center">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                      Completed & Ready
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white text-emerald-700 border border-emerald-200 shadow-2xs">
                    {doneTasks.length}
                  </span>
                </div>

                {doneTasks.length === 0 ? (
                  <div className="py-10 text-center text-emerald-500 text-xs italic bg-white/60 rounded-xl border border-dashed border-emerald-200">
                    No completed cleans recorded
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                    {doneTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isHousekeeper={isHousekeeper}
                        isManagerOrOwner={isManagerOrOwner}
                        housekeepers={housekeepers}
                        onOpenModal={() => setActiveTaskModal(task)}
                        onDelete={() => handleDeleteTask(task.id)}
                      />
                    ))}
                    {/* Internal scroll spacer */}
                    <div className="h-[20vh]" aria-hidden="true" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RECURRING SCHEDULE CONFIG SCREEN */}
      {activeTab === 'schedules' && isManagerOrOwner && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Automated Recurring Cleaning Schedules
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure recurring turnover rules per suite (e.g. weekly linen refreshes, monthly deep cleans, or outsourced contractors).
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingSchedule(null);
                  setScheduleForm({
                    roomId: rooms[0]?.id || '',
                    frequency: 'WEEKLY',
                    dayOfWeek: 1,
                    dayOfMonth: 1,
                    specificDate: new Date().toISOString().split('T')[0],
                    isOutsourced: false,
                    outsourcedVendorName: '',
                    active: true,
                    templateType: 'recurring',
                  });
                  setShowScheduleModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-xs self-start sm:self-auto transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Schedule Rule</span>
              </button>
            </div>

            {schedules.length === 0 ? (
              <div className="py-14 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8">
                <Repeat className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">No Recurring Schedules Configured</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Set up automated weekly or monthly cleaning schedules to keep your luxury suites perpetually maintained.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {schedules.map((schedule) => {
                  const freqCfg = FREQUENCY_CONFIG[schedule.frequency] || FREQUENCY_CONFIG.WEEKLY;
                  const dayName =
                    schedule.frequency === 'WEEKLY' && schedule.dayOfWeek !== null
                      ? DAYS_OF_WEEK.find((d) => d.value === schedule.dayOfWeek)?.label
                      : null;

                  return (
                    <div
                      key={schedule.id}
                      className={cn(
                        'bg-slate-50 border rounded-xl p-4 shadow-2xs transition-all flex flex-col justify-between',
                        schedule.active ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200/60 opacity-65'
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-white">
                            {schedule.room?.roomNumber}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                                schedule.active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-300'
                              )}
                            >
                              {schedule.active ? 'Active Rule' : 'Paused'}
                            </span>
                          </div>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{schedule.room?.name}</h4>

                        <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="font-semibold text-slate-800">{freqCfg.label}</span>
                            {schedule.frequency === 'WEEKLY' && <span>(Every {dayName})</span>}
                            {schedule.frequency === 'MONTHLY' && <span>(Day {schedule.dayOfMonth} of month)</span>}
                            {schedule.frequency === 'SPECIFIC_DATE' && schedule.specificDate && (
                              <span>({new Date(schedule.specificDate).toLocaleDateString()})</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {schedule.isOutsourced ? (
                              <div className="flex items-center gap-1.5 text-sky-700">
                                <Truck className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                <span className="font-medium">
                                  Outsourced: <strong>{schedule.outsourcedVendorName || 'External Contractor'}</strong>
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>In-House Villa Team</span>
                              </div>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-400">
                            Checklist template:{' '}
                            {Array.isArray(schedule.checklistTemplate) ? `${schedule.checklistTemplate.length} items` : 'Default'}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-200/80 flex items-center justify-between">
                        <button
                          onClick={() => handleToggleScheduleActive(schedule)}
                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                        >
                          {schedule.active ? 'Pause Rule' : 'Activate Rule'}
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingSchedule(schedule);
                              setScheduleForm({
                                roomId: schedule.roomId,
                                frequency: schedule.frequency,
                                dayOfWeek: schedule.dayOfWeek !== null ? schedule.dayOfWeek : 1,
                                dayOfMonth: schedule.dayOfMonth !== null ? schedule.dayOfMonth : 1,
                                specificDate: schedule.specificDate
                                  ? new Date(schedule.specificDate).toISOString().split('T')[0]
                                  : new Date().toISOString().split('T')[0],
                                isOutsourced: schedule.isOutsourced,
                                outsourcedVendorName: schedule.outsourcedVendorName || '',
                                active: schedule.active,
                                templateType: 'recurring',
                              });
                              setShowScheduleModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
                            title="Edit schedule"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete schedule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: TASK DETAIL & INTERACTIVE CHECKLIST */}
      {activeTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[90vh] my-auto">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-900 text-white">
                  {activeTaskModal.room?.roomNumber}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{activeTaskModal.room?.name}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5">
                    <span
                      className={cn(
                        'px-2 py-0.2 rounded-full text-[10px] font-bold border',
                        TASK_TYPE_CONFIG[activeTaskModal.taskType]?.bg,
                        TASK_TYPE_CONFIG[activeTaskModal.taskType]?.text,
                        TASK_TYPE_CONFIG[activeTaskModal.taskType]?.border
                      )}
                    >
                      {TASK_TYPE_CONFIG[activeTaskModal.taskType]?.label}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Scheduled for {new Date(activeTaskModal.scheduledDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveTaskModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
              {/* Status & Assignment Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Execution Status</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5',
                        TASK_STATUS_CONFIG[activeTaskModal.status]?.bg,
                        TASK_STATUS_CONFIG[activeTaskModal.status]?.text,
                        TASK_STATUS_CONFIG[activeTaskModal.status]?.border
                      )}
                    >
                      <span className={cn('w-2 h-2 rounded-full', TASK_STATUS_CONFIG[activeTaskModal.status]?.dot)} />
                      {TASK_STATUS_CONFIG[activeTaskModal.status]?.label}
                    </span>

                    {activeTaskModal.status === 'PENDING' && (
                      <button
                        onClick={() => handleUpdateTaskStatus(activeTaskModal, 'IN_PROGRESS')}
                        className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" />
                        <span>Start Clean</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Assigned Staff Control */}
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Assigned Housekeeper</span>
                  {isManagerOrOwner ? (
                    <select
                      value={activeTaskModal.assignedToUserId || ''}
                      onChange={(e) => handleAssignStaff(activeTaskModal, e.target.value || null)}
                      className="mt-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                    >
                      <option value="">Unassigned</option>
                      {housekeepers.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.fullName} ({h.email})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 text-xs font-bold text-slate-800">
                      {activeTaskModal.assignedTo?.fullName || 'Unassigned'}
                    </div>
                  )}
                </div>

                {activeTaskModal.isOutsourced && (
                  <div className="w-full pt-2 border-t border-slate-200/60 text-xs text-sky-800 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span>
                      Outsourced Contractor: <strong>{activeTaskModal.outsourcedVendorName || 'External Team'}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Checklist Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Turnover Readiness Checklist
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Check each item as completed. Task will auto-mark Completed and return suite to Available once all items are checked.
                    </p>
                  </div>
                  {activeTaskModal.checklist && activeTaskModal.checklist.length > 0 && (
                    <span className="text-xs font-mono font-bold text-slate-700 px-2 py-0.5 bg-slate-100 rounded-full">
                      {activeTaskModal.checklist.filter((i) => i.done).length} / {activeTaskModal.checklist.length} Done
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                {activeTaskModal.checklist && activeTaskModal.checklist.length > 0 && (
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round(
                          (activeTaskModal.checklist.filter((i) => i.done).length / activeTaskModal.checklist.length) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                )}

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {(!activeTaskModal.checklist || activeTaskModal.checklist.length === 0) ? (
                    <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl">
                      No specific checklist items attached.
                    </div>
                  ) : (
                    activeTaskModal.checklist.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        onClick={() => handleToggleChecklistItem(activeTaskModal, item.id)}
                        className={cn(
                          'p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3',
                          item.done
                            ? 'bg-emerald-50/50 border-emerald-200 text-slate-600 line-through'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900 shadow-2xs'
                        )}
                      >
                        <div className="mt-0.5 shrink-0">
                          {item.done ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <span className="text-xs leading-relaxed select-none">{item.label}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Notes */}
              {activeTaskModal.notes && (
                <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-3 text-xs text-slate-700">
                  <span className="font-bold text-amber-900 block mb-0.5">Housekeeping Notes:</span>
                  <p className="leading-relaxed">{activeTaskModal.notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              {isManagerOrOwner ? (
                <button
                  onClick={() => handleDeleteTask(activeTaskModal.id)}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Task</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                {isManagerOrOwner && activeTaskModal.status !== 'DONE' && (
                  <button
                    onClick={() => handleUpdateTaskStatus(activeTaskModal, 'DONE', true)}
                    className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors"
                  >
                    Force Mark Complete
                  </button>
                )}

                <button
                  onClick={() => setActiveTaskModal(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE TASK MODAL */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[90vh] my-auto">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Schedule Housekeeping Clean</h3>
                <p className="text-[11px] text-slate-500">Create a turnover or deep cleaning task for a villa suite.</p>
              </div>
              <button
                onClick={() => setShowCreateTaskModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Room Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Villa Suite *</label>
                <select
                  required
                  value={newTaskForm.roomId}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, roomId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomNumber} - {r.name} ({r.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Task Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Clean Type</label>
                  <select
                    value={newTaskForm.taskType}
                    onChange={(e) =>
                      setNewTaskForm({ ...newTaskForm, taskType: e.target.value as HousekeepingTaskType })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="CHECKOUT_CLEAN">Turnover Clean</option>
                    <option value="RECURRING_CLEAN">Daily Refresh</option>
                    <option value="DEEP_CLEAN">Deep Clean</option>
                    <option value="OUTSOURCED">Outsourced Vendor</option>
                  </select>
                </div>

                {/* Scheduled Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    required
                    value={newTaskForm.scheduledDate}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, scheduledDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              {/* Staff Assignee */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assign Housekeeper</label>
                <select
                  value={newTaskForm.assignedToUserId}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, assignedToUserId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="">Leave Unassigned</option>
                  {housekeepers.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.fullName} ({h.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Checklist Template */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Checklist Template</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTaskForm({ ...newTaskForm, templateType: 'checkout' })}
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs font-medium border text-center transition-colors',
                      newTaskForm.templateType === 'checkout'
                        ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    Turnover (9 items)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTaskForm({ ...newTaskForm, templateType: 'recurring' })}
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs font-medium border text-center transition-colors',
                      newTaskForm.templateType === 'recurring'
                        ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    Daily Refresh (5 items)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTaskForm({ ...newTaskForm, templateType: 'deep' })}
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs font-medium border text-center transition-colors',
                      newTaskForm.templateType === 'deep'
                        ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    Deep Clean (7 items)
                  </button>
                </div>
              </div>

              {/* Outsourced Toggle */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTaskForm.isOutsourced}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, isOutsourced: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Mark as Outsourced Vendor Clean</span>
                </label>

                {newTaskForm.isOutsourced && (
                  <input
                    type="text"
                    placeholder="Vendor Name (e.g. PureClean Bali Co.)"
                    value={newTaskForm.outsourcedVendorName}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, outsourcedVendorName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                  />
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes & Special Instructions</label>
                <textarea
                  rows={2}
                  value={newTaskForm.notes}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, notes: e.target.value })}
                  placeholder="Special guest arrival requests, VIP flower staging, extra towels..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTaskModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECURRING SCHEDULE CONFIG MODAL */}
      {showScheduleModal && isManagerOrOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[90vh] my-auto">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingSchedule ? 'Edit Recurring Schedule' : 'Create Recurring Cleaning Rule'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Set recurring cleaning cadence for continuous property upkeep.
                </p>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Room Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Suite *</label>
                <select
                  required
                  value={scheduleForm.roomId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, roomId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomNumber} - {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Frequency Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Recurrence Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['WEEKLY', 'MONTHLY', 'SPECIFIC_DATE'] as ScheduleFrequency[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setScheduleForm({ ...scheduleForm, frequency: f })}
                      className={cn(
                        'px-3 py-2 rounded-xl text-xs font-semibold border text-center transition-colors',
                        scheduleForm.frequency === f
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {FREQUENCY_CONFIG[f].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frequency Details */}
              {scheduleForm.frequency === 'WEEKLY' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Day of the Week</label>
                  <select
                    value={scheduleForm.dayOfWeek}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, dayOfWeek: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d.value} value={d.value}>
                        Every {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {scheduleForm.frequency === 'MONTHLY' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Day of Month (1 - 31)</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={scheduleForm.dayOfMonth}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, dayOfMonth: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}

              {scheduleForm.frequency === 'SPECIFIC_DATE' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Custom Scheduled Date</label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.specificDate}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, specificDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}

              {/* Checklist Template */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Checklist Template</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleForm({ ...scheduleForm, templateType: 'recurring' })}
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs font-medium border text-center transition-colors',
                      scheduleForm.templateType === 'recurring'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    Daily Refresh Template
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleForm({ ...scheduleForm, templateType: 'deep' })}
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs font-medium border text-center transition-colors',
                      scheduleForm.templateType === 'deep'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    Deep Clean Sanitization
                  </button>
                </div>
              </div>

              {/* Outsourced vendor */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleForm.isOutsourced}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, isOutsourced: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Assign to External Outsourced Vendor</span>
                </label>

                {scheduleForm.isOutsourced && (
                  <input
                    type="text"
                    placeholder="Outsourced Company Name (e.g. Bali Deep Clean Specialists)"
                    value={scheduleForm.outsourcedVendorName}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, outsourcedVendorName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  {editingSchedule ? 'Save Changes' : 'Establish Schedule'}
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
};

// Sub-component: Task Card in Kanban Column
interface TaskCardProps {
  task: HousekeepingTask;
  isHousekeeper: boolean;
  isManagerOrOwner: boolean;
  housekeepers: StaffUser[];
  onOpenModal: () => void;
  onStartClean?: () => void;
  onAssign?: (staffId: string | null) => void;
  onDelete?: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isHousekeeper,
  isManagerOrOwner,
  housekeepers,
  onOpenModal,
  onStartClean,
  onAssign,
  onDelete,
}) => {
  const typeCfg = TASK_TYPE_CONFIG[task.taskType] || TASK_TYPE_CONFIG.CHECKOUT_CLEAN;
  const statusCfg = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.PENDING;

  const totalItems = task.checklist ? task.checklist.length : 0;
  const doneItems = task.checklist ? task.checklist.filter((i) => i.done).length : 0;
  const percent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <div
      onClick={onOpenModal}
      className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl p-3.5 shadow-2xs transition-all cursor-pointer group flex flex-col justify-between"
    >
      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-white">
              {task.room?.roomNumber}
            </span>
            <span
              className={cn(
                'px-2 py-0.2 rounded-full text-[10px] font-bold border',
                typeCfg.bg,
                typeCfg.text,
                typeCfg.border
              )}
            >
              {typeCfg.label}
            </span>
          </div>

          <span className="text-[10px] text-slate-400">
            {new Date(task.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>

        <h4 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-amber-700 transition-colors">
          {task.room?.name}
        </h4>

        {/* Outsourced indicator */}
        {task.isOutsourced && (
          <div className="text-[10px] text-sky-700 font-medium mt-1 flex items-center gap-1">
            <Truck className="w-3 h-3 text-sky-500" />
            <span className="truncate">{task.outsourcedVendorName || 'Outsourced Vendor'}</span>
          </div>
        )}

        {/* Notes preview */}
        {task.notes && (
          <p className="text-[11px] text-slate-400 italic mt-1.5 line-clamp-1">"{task.notes}"</p>
        )}

        {/* Checklist Progress */}
        {totalItems > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
              <span>Checklist Progress</span>
              <span className="font-semibold text-slate-700">
                {doneItems}/{totalItems} ({percent}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={cn('h-1.5 rounded-full transition-all', percent === 100 ? 'bg-emerald-500' : 'bg-amber-500')}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer / Assignee / Action */}
      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="min-w-0">
          {task.assignedTo ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 truncate">
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                {task.assignedTo.fullName.charAt(0)}
              </span>
              <span className="truncate text-[11px]">{task.assignedTo.fullName}</span>
            </div>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
              Unassigned
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {task.status === 'PENDING' && onStartClean && (
            <button
              onClick={onStartClean}
              className="px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors flex items-center gap-0.5"
            >
              <Play className="w-2.5 h-2.5" />
              <span>Start</span>
            </button>
          )}

          <button
            onClick={onOpenModal}
            className="text-[11px] text-slate-400 hover:text-slate-700 font-medium px-1.5 py-0.5 rounded"
          >
            Checklist →
          </button>
        </div>
      </div>
    </div>
  );
};

export default HousekeepingPage;
