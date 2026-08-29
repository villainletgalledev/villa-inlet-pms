import React, { useState, useEffect } from 'react';
import {
  CalendarSync,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  Sliders,
  BedDouble,
  Info,
  Globe,
  Link as LinkIcon,
  ToggleLeft,
  ToggleRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { isOwnerOrManager, UserRole } from '../../../../lib/rbac';
import { getAuthHeaders } from '../../../../lib/api/ical';

interface Room {
  id: string;
  name: string;
  roomNumber: string;
}

interface ExternalCalendarFeed {
  id: string;
  source: 'AIRBNB' | 'BOOKING_COM' | 'OTHER';
  label: string;
  feedUrl: string | null;
  roomId: string | null;
  room?: Room | null;
  lastSyncedAt: string | null;
  lastSyncStatus: 'NEVER_SYNCED' | 'SUCCESS' | 'FAILED';
  lastSyncError: string | null;
  isActive: boolean;
  _count?: {
    bookings: number;
    conflicts: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface SyncConflict {
  id: string;
  feedId: string;
  externalUid: string;
  roomId: string | null;
  conflictingBookingId: string | null;
  summary: string;
  checkIn: string;
  checkOut: string;
  resolved: boolean;
  createdAt: string;
  feed?: {
    label: string;
    source: string;
  };
  room?: {
    name: string;
    roomNumber: string;
  };
  conflictingBooking?: {
    id: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
  };
}

interface ICalInfo {
  baseUrl: string;
  feedSecret: string;
  feedUrl: string;
  isCustomSecretConfigured: boolean;
  cronSchedule: string;
}

interface SettingsIcalPageProps {
  currentUser?: {
    email: string;
    fullName: string;
    role: UserRole | string;
  };
  onUnauthorizedRedirect?: (reason: string) => void;
}

export const SettingsIcalPage: React.FC<SettingsIcalPageProps> = ({
  currentUser = { email: 'admin@villainlet.com', fullName: 'Villa Manager', role: 'MANAGER' },
  onUnauthorizedRedirect,
}) => {
  const isAuthorized = isOwnerOrManager(currentUser.role);

  // States
  const [icalInfo, setIcalInfo] = useState<ICalInfo | null>(null);
  const [feeds, setFeeds] = useState<ExternalCalendarFeed[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [syncingFeedId, setSyncingFeedId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // New Feed Form State
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [newSource, setNewSource] = useState<'AIRBNB' | 'BOOKING_COM' | 'OTHER'>('AIRBNB');
  const [newLabel, setNewLabel] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newRoomId, setNewRoomId] = useState('ALL');
  const [isSubmittingNewFeed, setIsSubmittingNewFeed] = useState(false);
  const [feedToDelete, setFeedToDelete] = useState<ExternalCalendarFeed | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Auth Guard
  useEffect(() => {
    if (!isAuthorized && onUnauthorizedRedirect) {
      onUnauthorizedRedirect('Access restricted: iCal Engine & Channel Manager requires Owner or Manager privileges.');
    }
  }, [isAuthorized, onUnauthorizedRedirect]);

  // Load Feeds & iCal Info
  const loadData = async () => {
    try {
      setIsLoading(true);
      const headers = await getAuthHeaders();

      const [infoRes, feedsRes, roomsRes] = await Promise.all([
        fetch('/api/ical/info', { headers }),
        fetch('/api/ical/feeds', { headers }),
        fetch('/api/rooms', { headers }),
      ]);

      if (infoRes.ok) {
        const infoData = await infoRes.json();
        setIcalInfo(infoData);
      }

      if (feedsRes.ok) {
        const feedsData = await feedsRes.json();
        setFeeds(feedsData.feeds || []);
        setConflicts(feedsData.conflicts || []);
      }

      if (roomsRes.ok) {
        const roomsData = await roomsRes.json();
        setRooms(roomsData.rooms || []);
      }
    } catch (err) {
      console.error('Error loading iCal settings data:', err);
      showToast('Failed to load iCal settings data.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [isAuthorized]);

  const handleCopyUrl = async () => {
    if (!icalInfo?.feedUrl) return;
    try {
      if (navigator?.clipboard) {
        await navigator.clipboard.writeText(icalInfo.feedUrl);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = icalInfo.feedUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      showToast('Outbound iCal Feed URL copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      showToast('Failed to copy to clipboard. Please copy manually.', 'error');
    }
  };

  const handleCreateFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      showToast('Please enter a descriptive label for this feed.', 'error');
      return;
    }

    try {
      setIsSubmittingNewFeed(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/ical/feeds', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: newSource,
          label: newLabel.trim(),
          feedUrl: newFeedUrl.trim() || null,
          roomId: newRoomId !== 'ALL' ? newRoomId : null,
          isActive: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create calendar feed.');
      }

      const data = await res.json();
      showToast(
        data.initialSyncResult?.success
          ? `Feed connected & initial sync completed (${data.initialSyncResult.countProcessed} events)!`
          : 'Calendar feed connected successfully.',
        'success'
      );

      // Reset form
      setNewLabel('');
      setNewFeedUrl('');
      setNewRoomId('ALL');
      setIsAddingFeed(false);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Error creating feed.', 'error');
    } finally {
      setIsSubmittingNewFeed(false);
    }
  };

  const handleToggleActive = async (feed: ExternalCalendarFeed) => {
    try {
      const headers = await getAuthHeaders();
      const updatedActive = !feed.isActive;
      const res = await fetch(`/api/ical/feeds/${feed.id}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: updatedActive }),
      });

      if (!res.ok) throw new Error('Failed to update feed state.');

      setFeeds((prev) =>
        prev.map((f) => (f.id === feed.id ? { ...f, isActive: updatedActive } : f))
      );
      showToast(`Feed ${updatedActive ? 'activated' : 'paused'}.`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to toggle feed.', 'error');
    }
  };

  const handleSyncNow = async (feedId: string) => {
    try {
      setSyncingFeedId(feedId);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/ical/sync/${feedId}`, {
        method: 'POST',
        headers,
      });

      const data = await res.json();
      if (!res.ok || !data.result?.success) {
        throw new Error(data.result?.error || data.error || 'Sync failed.');
      }

      showToast(data.message || 'Feed synchronized successfully.', 'success');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to synchronize feed.', 'error');
    } finally {
      setSyncingFeedId(null);
    }
  };

  const handleSyncAllFeeds = async () => {
    try {
      setSyncingAll(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/cron/sync-ical', {
        headers,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync all failed.');

      showToast(data.message || 'All active feeds synchronized.', 'success');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to synchronize feeds.', 'error');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDeleteFeed = async () => {
    if (!feedToDelete) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/ical/feeds/${feedToDelete.id}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) throw new Error('Failed to delete feed.');

      showToast('Calendar feed deleted successfully.', 'success');
      setFeedToDelete(null);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Error deleting feed.', 'error');
    }
  };

  const handleResolveConflict = async (conflictId: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/ical/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) throw new Error('Failed to resolve conflict.');

      setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
      showToast('Conflict resolved.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error resolving conflict.', 'error');
    }
  };

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never synced';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago (${date.toLocaleDateString()})`;
  };

  if (!isAuthorized) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-600 mt-1">
          Only Owners and General Managers can view and configure iCal feeds and channel management.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 text-xs font-medium',
            toast.type === 'success' && 'bg-slate-900 border-slate-800 text-white',
            toast.type === 'error' && 'bg-rose-950 border-rose-800 text-rose-100',
            toast.type === 'info' && 'bg-indigo-950 border-indigo-800 text-indigo-100'
          )}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-indigo-400 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <CalendarSync className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">Central iCal Engine & Channel Sync</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                Active Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Publish Villa Inlet reservations to OTAs and synchronize inbound calendars from Airbnb & Booking.com.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            id="btn-sync-all-channels"
            type="button"
            onClick={handleSyncAllFeeds}
            disabled={syncingAll || feeds.length === 0}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-xs"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', syncingAll && 'animate-spin')} />
            <span>{syncingAll ? 'Syncing All...' : 'Sync All Feeds'}</span>
          </button>
        </div>
      </div>

      {/* Sync Frequency Clarification Note (Mandated in Part 3.6) */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 px-4 flex items-start sm:items-center gap-3 text-amber-900">
        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
        <div className="text-xs">
          <span className="font-bold">Sync Schedule: </span>
          <span>Automatic sync runs once daily at 03:00 UTC. Use </span>
          <span className="font-semibold underline cursor-pointer" onClick={() => handleSyncAllFeeds()}>
            "Sync now"
          </span>
          <span> for an immediate manual refresh whenever you receive new OTA reservations.</span>
        </div>
      </div>

      {/* PART 1: OUTBOUND FEED CARD */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              1. Outbound iCal Calendar Feed (Villa Inlet → Channels)
            </h2>
          </div>
          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            Public Token-Protected
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Provide this public feed URL to external booking portals (Airbnb, Booking.com, VRBO, or website widgets). It automatically exports all confirmed reservations as anonymous block dates without exposing guest PII.
        </p>

        {/* URL Box */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1 font-mono text-xs text-slate-800 break-all select-all flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
            <span className="truncate">{icalInfo?.feedUrl || 'Generating outbound URL...'}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-copy-outbound-url"
              type="button"
              onClick={handleCopyUrl}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              )}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied URL!' : 'Copy URL'}</span>
            </button>

            {icalInfo?.feedUrl && (
              <a
                href={icalInfo.feedUrl}
                target="_blank"
                rel="noreferrer"
                title="Test / Download Raw .ics Feed"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
          <div>
            <span className="font-semibold text-slate-700">Base Domain: </span>
            <span className="font-mono text-slate-600">{icalInfo?.baseUrl || 'Loading...'}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-700">Format: </span>
            <span>RFC 5545 Standard (VEVENT, DTSTART, DTEND)</span>
          </div>
          <div>
            <span className="font-semibold text-slate-700">Privacy: </span>
            <span>SUMMARY = "Reserved" (Zero Guest PII)</span>
          </div>
        </div>
      </div>

      {/* PART 2: INBOUND FEEDS LIST & CONNECT FORM */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              2. Inbound Channel Feeds (Airbnb / Booking.com → Villa Inlet)
            </h2>
          </div>

          <button
            id="btn-toggle-add-feed-form"
            type="button"
            onClick={() => setIsAddingFeed((prev) => !prev)}
            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAddingFeed ? 'Close Form' : 'Connect New Calendar Feed'}</span>
          </button>
        </div>

        {/* Form to Add New ExternalCalendarFeed */}
        {isAddingFeed && (
          <form
            onSubmit={handleCreateFeed}
            className="p-4 sm:p-5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-4 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Connect External Calendar Channel
              </h3>
              <span className="text-[11px] text-slate-500">Links can be added or updated anytime</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Source Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Channel Source *</label>
                <select
                  id="select-feed-source"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value as any)}
                  className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="AIRBNB">Airbnb</option>
                  <option value="BOOKING_COM">Booking.com</option>
                  <option value="OTHER">Other OTA / Direct Widget</option>
                </select>
              </div>

              {/* Label */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Feed Label *</label>
                <input
                  id="input-feed-label"
                  type="text"
                  required
                  placeholder="e.g. Airbnb - Master Villa Suite"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Target Room */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Suite / Room</label>
                <select
                  id="select-feed-room"
                  value={newRoomId}
                  onChange={(e) => setNewRoomId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">Entire Property / Default Suite</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} ({room.roomNumber})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Feed URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                iCal Export URL (from Airbnb / Booking.com)
              </label>
              <input
                id="input-feed-url"
                type="url"
                placeholder="https://www.airbnb.com/calendar/ical/12345678.ics?s=abcdef123456"
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                You can save now and paste the URL later when ready. Inbound reservations will automatically sync once a URL is added.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingFeed(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-submit-new-feed"
                type="submit"
                disabled={isSubmittingNewFeed}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-all"
              >
                {isSubmittingNewFeed ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting Feed...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save & Connect Channel</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Existing Feeds List */}
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading connected calendar channels...</p>
          </div>
        ) : feeds.length === 0 ? (
          /* Empty State (Mandated in Part 3.4) */
          <div className="p-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <CalendarSync className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">No calendar feeds connected yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Add your Airbnb or Booking.com iCal export URLs above to synchronize reservations automatically with Villa Inlet PMS.
            </p>
            <button
              type="button"
              onClick={() => setIsAddingFeed(true)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect First Channel Feed</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {feeds.map((feed) => {
              const isSyncingThis = syncingFeedId === feed.id;

              return (
                <div
                  key={feed.id}
                  className={cn(
                    'p-4 rounded-xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4',
                    feed.isActive ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-50/80 border-slate-200/60 opacity-75'
                  )}
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    {/* Top row: Badges and Label */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider',
                          feed.source === 'AIRBNB' && 'bg-rose-50 text-rose-700 border border-rose-200',
                          feed.source === 'BOOKING_COM' && 'bg-blue-50 text-blue-700 border border-blue-200',
                          feed.source === 'OTHER' && 'bg-purple-50 text-purple-700 border border-purple-200'
                        )}
                      >
                        {feed.source === 'AIRBNB' ? 'Airbnb' : feed.source === 'BOOKING_COM' ? 'Booking.com' : 'Other OTA'}
                      </span>

                      <h3 className="text-xs font-bold text-slate-900 truncate">{feed.label}</h3>

                      {feed.room && (
                        <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                          <BedDouble className="w-3 h-3 text-slate-400" />
                          <span>{feed.room.name} ({feed.room.roomNumber})</span>
                        </span>
                      )}

                      {feed._count && (
                        <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {feed._count.bookings} reservations synced
                        </span>
                      )}
                    </div>

                    {/* Feed URL display */}
                    <div className="text-[11px] font-mono text-slate-500 truncate max-w-xl">
                      {feed.feedUrl ? (
                        <span className="text-slate-600">{feed.feedUrl}</span>
                      ) : (
                        <span className="text-amber-600 italic">No Feed URL configured (Pending URL input)</span>
                      )}
                    </div>

                    {/* Sync Status and Error Display */}
                    <div className="flex items-center gap-3 text-[11px] flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Last Synced:</span>
                        <span className="font-semibold text-slate-700">{formatRelativeTime(feed.lastSyncedAt)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Status:</span>
                        {feed.lastSyncStatus === 'SUCCESS' && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Success
                          </span>
                        )}
                        {feed.lastSyncStatus === 'FAILED' && (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-semibold" title={feed.lastSyncError || 'Sync failed'}>
                            <XCircle className="w-3 h-3" /> Failed
                          </span>
                        )}
                        {feed.lastSyncStatus === 'NEVER_SYNCED' && (
                          <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                            <Clock className="w-3 h-3" /> Never Synced
                          </span>
                        )}
                      </div>

                      {feed.lastSyncError && (
                        <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 truncate max-w-md">
                          Error: {feed.lastSyncError}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                    {/* Active Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(feed)}
                      title={feed.isActive ? 'Pause synchronization' : 'Activate synchronization'}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                    >
                      {feed.isActive ? (
                        <ToggleRight className="w-6 h-6 text-indigo-600" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-slate-300" />
                      )}
                    </button>

                    {/* Manual Sync Now Button (Mandated in Part 3.3) */}
                    <button
                      id={`btn-sync-feed-${feed.id}`}
                      type="button"
                      onClick={() => handleSyncNow(feed.id)}
                      disabled={isSyncingThis || !feed.feedUrl}
                      title="Run manual sync immediately"
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className={cn('w-3.5 h-3.5', isSyncingThis && 'animate-spin')} />
                      <span>{isSyncingThis ? 'Syncing...' : 'Sync now'}</span>
                    </button>

                    {/* Delete Feed Button */}
                    <button
                      type="button"
                      onClick={() => setFeedToDelete(feed)}
                      title="Delete feed connection"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PART 3: SYNC CONFLICTS PANEL */}
      {conflicts.length > 0 && (
        <div className="bg-white border border-rose-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h2 className="text-sm font-bold text-rose-900 uppercase tracking-wider">
              Detected Booking Conflicts ({conflicts.length})
            </h2>
          </div>

          <p className="text-xs text-slate-600">
            The iCal engine detected inbound OTA reservations that overlap with existing Direct bookings. Direct bookings are strictly preserved and were NOT overwritten. Review and resolve these conflicts below:
          </p>

          <div className="space-y-2.5">
            {conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>{conflict.summary}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold">Dates: </span>
                    <span>
                      {new Date(conflict.checkIn).toLocaleDateString()} — {new Date(conflict.checkOut).toLocaleDateString()}
                    </span>
                    {conflict.room && (
                      <span className="ml-2 font-semibold text-slate-700">
                        • {conflict.room.name} ({conflict.room.roomNumber})
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleResolveConflict(conflict.id)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-lg shadow-2xs self-start sm:self-auto transition-colors"
                >
                  Mark Resolved
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {feedToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Calendar Feed?</h3>
                <p className="text-xs text-slate-500">This will remove the inbound feed connection</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to disconnect <span className="font-bold text-slate-900">{feedToDelete.label}</span>? Inbound reservations will no longer sync from this external URL.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFeedToDelete(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFeed}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                Confirm Delete
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

export default SettingsIcalPage;
