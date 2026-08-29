import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Calendar,
  BedDouble,
  Download,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowUpRight,
  PieChart as PieIcon,
  ShieldCheck,
  AlertCircle,
  Clock,
  Building,
  Users,
  Search,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
  HelpCircle,
} from 'lucide-react';
import {
  ReportMetricsResult,
  fetchReportMetrics,
  downloadReportsCsv,
} from '../../../lib/api/reports';
import { isOwnerOrManager, UserRole } from '../../../lib/rbac';
import { cn } from '../../../lib/utils';

interface ReportsPageProps {
  currentUser?: {
    id?: string;
    email: string;
    fullName: string;
    role: UserRole | string;
  };
  onUnauthorizedRedirect?: (reason: string) => void;
}

export default function ReportsPage({
  currentUser = { email: 'manager@villainlet.com', fullName: 'Villa Manager', role: 'MANAGER' },
  onUnauthorizedRedirect,
}: ReportsPageProps) {
  // Preset range definitions
  const PRESETS = [
    { id: 'THIS_MONTH', label: 'August 2026 (Current)', start: '2026-08-01', end: '2026-08-31' },
    { id: 'LAST_30_DAYS', label: 'Last 30 Days', start: '2026-07-21', end: '2026-08-19' },
    { id: 'Q3_2026', label: 'Q3 2026 (Jul - Sep)', start: '2026-07-01', end: '2026-09-30' },
    { id: 'FULL_YEAR_2026', label: 'Full Year 2026', start: '2026-01-01', end: '2026-12-31' },
  ];

  const [activePreset, setActivePreset] = useState<string>('THIS_MONTH');
  const [startDate, setStartDate] = useState('2026-08-01');
  const [endDate, setEndDate] = useState('2026-08-31');
  const [customRangeActive, setCustomRangeActive] = useState(false);

  const [data, setData] = useState<ReportMetricsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTableQuery, setSearchTableQuery] = useState('');

  const isAuthorized = isOwnerOrManager(currentUser.role);

  // Check RBAC on mount
  useEffect(() => {
    if (!isAuthorized && onUnauthorizedRedirect) {
      onUnauthorizedRedirect('Not authorized: Reports & Analytics are accessible to Owners and Managers only.');
    }
  }, [isAuthorized, onUnauthorizedRedirect]);

  // Load metrics from server
  const loadMetrics = async (sDate: string, eDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchReportMetrics({ startDate: sDate, endDate: eDate }, currentUser);
      if (res.data) {
        setData(res.data);
      } else {
        setError(res.error || 'Failed to calculate analytics metrics');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadMetrics(startDate, endDate);
    }
  }, [startDate, endDate]);

  const handleSelectPreset = (preset: (typeof PRESETS)[0]) => {
    setActivePreset(preset.id);
    setCustomRangeActive(false);
    setStartDate(preset.start);
    setEndDate(preset.end);
  };

  const handleCustomDateApply = (e: React.FormEvent) => {
    e.preventDefault();
    setActivePreset('CUSTOM');
    setCustomRangeActive(true);
    loadMetrics(startDate, endDate);
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await downloadReportsCsv({ startDate, endDate }, currentUser);
    } catch (err) {
      console.error('Export CSV error:', err);
    } finally {
      setExporting(false);
    }
  };

  // Filter raw bookings in table
  const filteredBookings = useMemo(() => {
    if (!data?.rawBookings) return [];
    if (!searchTableQuery.trim()) return data.rawBookings;
    const q = searchTableQuery.toLowerCase();
    return data.rawBookings.filter(
      (b) =>
        b.guestName.toLowerCase().includes(q) ||
        b.guestEmail.toLowerCase().includes(q) ||
        b.roomNumber.toLowerCase().includes(q) ||
        b.roomName.toLowerCase().includes(q) ||
        b.source.toLowerCase().includes(q)
    );
  }, [data?.rawBookings, searchTableQuery]);

  if (!isAuthorized) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-[60vh]">
        <div className="max-w-md w-full text-center bg-white border border-rose-200 rounded-2xl p-8 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h2>
          <p className="text-xs text-slate-600 mb-4">
            Reports & Analytics are available to Property Owners and General Managers only.
          </p>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {
    totalRooms: 5,
    availableRoomNights: 0,
    bookedRoomNights: 0,
    occupancyRate: 0,
    totalRevenue: 0,
    adr: 0,
    revPar: 0,
    confirmedBookingsCount: 0,
    pendingBookingsCount: 0,
    cancelledBookingsCount: 0,
    averageLengthOfStay: 0,
    averageBookingValue: 0,
  };

  // Maximum timeline revenue for scaling bar heights
  const maxTimelineRevenue = Math.max(
    ...(data?.revenueTimeline.map((t) => t.revenue) || [1]),
    1
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-slate-900">
      {/* Header & Export Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Reports & Revenue Analytics
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Villa Inlet Analytics
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time occupancy yield, Average Daily Rate (ADR), RevPAR, pace, and channel distribution.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            id="btn-export-csv"
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || loading}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 sm:py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50 w-full sm:w-auto min-h-[40px] sm:min-h-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? 'Generating CSV...' : 'Export as CSV'}</span>
          </button>
        </div>
      </div>

      {/* Date Range Selector Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <span className="text-slate-400 font-semibold text-[11px] uppercase mr-1 shrink-0">
              Period:
            </span>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                id={`preset-${preset.id}`}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer text-xs shrink-0',
                  activePreset === preset.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 bg-slate-50 border border-slate-200/60'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Inputs */}
          <form
            onSubmit={handleCustomDateApply}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0"
          >
            <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg w-full sm:w-auto">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                id="input-reports-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-slate-800 font-medium focus:outline-none flex-1 sm:flex-initial"
              />
              <span className="text-slate-400 text-xs px-1">to</span>
              <input
                id="input-reports-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-slate-800 font-medium focus:outline-none flex-1 sm:flex-initial"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-apply-custom-range"
                type="submit"
                className="flex-1 sm:flex-initial px-3.5 py-2 sm:py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200 transition-colors cursor-pointer text-xs min-h-[38px] sm:min-h-0 text-center"
              >
                Apply Range
              </button>

              <button
                type="button"
                onClick={() => loadMetrics(startDate, endDate)}
                title="Refresh Analytics"
                className="p-2 sm:p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors min-h-[38px] sm:min-h-0 flex items-center justify-center"
              >
                <RotateCcw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              </button>
            </div>
          </form>
        </div>

        {data && (
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500">
            <span>
              Analyzing {data.dateRange.totalDays} calendar days ({data.dateRange.startDate} to{' '}
              {data.dateRange.endDate}) across 5 Luxury Villa Units
            </span>
            <span className="font-semibold text-slate-700">
              {summary.confirmedBookingsCount} confirmed bookings · {summary.bookedRoomNights} room-nights
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">Analytics Engine Error:</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 4 PRIMARY HOSPITALITY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Occupancy Rate */}
        <div
          id="kpi-occupancy-rate"
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Occupancy Rate
              </span>
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <BedDouble className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {summary.occupancyRate}%
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                ({summary.bookedRoomNights}/{summary.availableRoomNights} nights)
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, summary.occupancyRate)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
              <span>0%</span>
              <span>5-room capacity</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* 2. ADR (Average Daily Rate) */}
        <div
          id="kpi-adr"
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Average Daily Rate (ADR)
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <DollarSign className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ${summary.adr.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">/ booked night</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Avg Length of Stay:</span>
            <span className="font-bold text-slate-800">{summary.averageLengthOfStay} nights</span>
          </div>
        </div>

        {/* 3. RevPAR (Revenue Per Available Room) */}
        <div
          id="kpi-revpar"
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                RevPAR (Yield / Room)
              </span>
              <span className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ${summary.revPar.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">/ total room-night</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Room Yield Ratio:</span>
            <span className="font-bold text-sky-700">
              {summary.adr > 0 ? Math.round((summary.revPar / summary.adr) * 100) : 0}% of ADR
            </span>
          </div>
        </div>

        {/* 4. Total Confirmed Revenue */}
        <div
          id="kpi-total-revenue"
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Confirmed Revenue
              </span>
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <Sparkles className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ${summary.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">gross</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Avg Booking Value:</span>
            <span className="font-bold text-slate-800">
              ${summary.averageBookingValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* TWO COLUMN INTERACTIVE CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Revenue Over Time Timeline */}
        <div
          id="chart-revenue-timeline"
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Revenue & Occupancy Over Time</h3>
                <p className="text-[11px] text-slate-500">Monthly breakdown for the selected period</p>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {data?.revenueTimeline.length || 0} periods
              </span>
            </div>

            {data?.revenueTimeline && data.revenueTimeline.length > 0 ? (
              <div className="space-y-4 pt-2">
                {data.revenueTimeline.map((item) => {
                  const percentWidth = Math.max(8, Math.round((item.revenue / maxTimelineRevenue) * 100));
                  return (
                    <div key={item.periodKey} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-800">{item.label}</span>
                        <span className="font-bold text-slate-900 font-mono">
                          ${item.revenue.toLocaleString()}
                        </span>
                      </div>

                      <div className="w-full bg-slate-100 rounded-lg h-6 overflow-hidden flex items-center relative">
                        <div
                          className="bg-gradient-to-r from-indigo-600 to-indigo-500 h-6 rounded-lg transition-all duration-500 flex items-center px-2 text-[10px] text-white font-bold"
                          style={{ width: `${percentWidth}%` }}
                        >
                          {item.roomNights} nights
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                        <span>{item.bookingsCount} confirmed bookings</span>
                        <span>ADR: ${item.adr.toFixed(0)}</span>
                        <span>Occupancy: {item.occupancyRate}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                No revenue data recorded in this range.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Includes confirmed and completed stays</span>
            <span className="font-semibold text-slate-700">Villa Inlet PMS</span>
          </div>
        </div>

        {/* CHART 2: Booking Pace / Lead Time Distribution */}
        <div
          id="chart-booking-pace"
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Booking Pace & Lead Time</h3>
                <p className="text-[11px] text-slate-500">Days between booking reservation and guest check-in</p>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                Pace Velocity
              </span>
            </div>

            {data?.bookingPace && data.bookingPace.length > 0 ? (
              <div className="space-y-3.5 pt-1">
                {data.bookingPace.map((pace) => {
                  const maxPaceCount = Math.max(
                    ...(data?.bookingPace.map((p) => p.count) || [1]),
                    1
                  );
                  const barWidth = Math.max(12, Math.round((pace.count / maxPaceCount) * 100));

                  return (
                    <div key={pace.leadTimeBucket} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">{pace.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-slate-600 text-[11px]">
                            {pace.count} booking{pace.count !== 1 ? 's' : ''}
                          </span>
                          <span className="font-bold text-slate-900 font-mono">
                            ${pace.revenue.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-100 rounded-md h-3 overflow-hidden">
                        <div
                          className={cn(
                            'h-3 rounded-md transition-all duration-500',
                            pace.leadTimeBucket === 'LAST_MINUTE'
                              ? 'bg-rose-500'
                              : pace.leadTimeBucket === 'SHORT'
                              ? 'bg-amber-500'
                              : pace.leadTimeBucket === 'MEDIUM'
                              ? 'bg-indigo-500'
                              : 'bg-emerald-500'
                          )}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                No booking pace data available.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>High advance bookings reduce vacancy volatility</span>
            <span className="font-semibold text-indigo-700">Villa Lead Times</span>
          </div>
        </div>
      </div>

      {/* CHANNEL MIX & ROOM PERFORMANCE MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel Mix Breakdown */}
        <div
          id="chart-channel-mix"
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Channel Mix & OTA Share</h3>
                <p className="text-[11px] text-slate-500">Distribution by booking platform</p>
              </div>
              <PieIcon className="w-4 h-4 text-slate-400" />
            </div>

            {data?.channelMix && data.channelMix.length > 0 ? (
              <div className="space-y-4 pt-1">
                {data.channelMix.map((ch) => (
                  <div key={ch.source} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: ch.color }}
                        />
                        <span className="font-bold text-slate-800">{ch.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-500 text-[11px]">
                          {ch.count} ({ch.percentage}%)
                        </span>
                        <span className="font-bold text-slate-900 font-mono">
                          ${ch.revenue.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(4, ch.revenuePercentage)}%`,
                          backgroundColor: ch.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                No channel transactions recorded.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            Direct bookings yield zero OTA commission fees.
          </div>
        </div>

        {/* Room Performance Matrix */}
        <div
          id="table-room-performance"
          className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Room-by-Room Yield Matrix</h3>
                <p className="text-[11px] text-slate-500">
                  Individual villa unit occupancy, ADR, and revenue generation
                </p>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                5 Units Active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Villa Unit</th>
                    <th className="py-2.5 px-3">Bookings</th>
                    <th className="py-2.5 px-3">Nights Booked</th>
                    <th className="py-2.5 px-3">Occupancy</th>
                    <th className="py-2.5 px-3">ADR ($)</th>
                    <th className="py-2.5 px-3 text-right">Revenue ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.roomPerformance.map((room) => (
                    <tr key={room.roomId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <BedDouble className="w-3.5 h-3.5 text-slate-400" />
                          <span>{room.roomNumber}</span>
                          <span className="text-slate-500 font-normal">({room.roomName})</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 font-semibold text-slate-700">{room.totalBookings}</td>

                      <td className="py-2.5 px-3 font-semibold text-slate-700">{room.roomNights}</td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-1.5 rounded-full"
                              style={{ width: `${room.occupancyRate}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-900 font-mono text-[11px]">
                            {room.occupancyRate}%
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                        ${room.adr.toFixed(0)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ${room.revenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>5-room total inventory</span>
            <span className="font-semibold text-slate-900">
              Total: ${summary.totalRevenue.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* RAW BOOKINGS AUDIT LOG TABLE */}
      <div
        id="raw-bookings-audit-table"
        className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden"
      >
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>Raw Booking Transactions ({filteredBookings.length} records)</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Detailed audit trail for all reservations intersecting the selected date range.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-search-raw-bookings"
                type="text"
                placeholder="Search guest, room, source..."
                value={searchTableQuery}
                onChange={(e) => setSearchTableQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 w-48 sm:w-60"
              />
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200 transition-colors text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Guest</th>
                <th className="py-3 px-4">Room</th>
                <th className="py-3 px-4">Dates</th>
                <th className="py-3 px-4">Nights</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No matching booking records found in this range.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{b.guestName}</div>
                      <div className="text-[11px] text-slate-500">{b.guestEmail}</div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">
                        {b.roomNumber} - {b.roomName}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-medium">
                      {b.checkIn} → {b.checkOut}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-700">
                      {b.nights} nts
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-700 border-slate-200">
                        {b.source}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                          b.status === 'CONFIRMED' || b.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : b.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        )}
                      >
                        {b.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-bold text-slate-900">
                      ${b.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom spacer for viewport clearance */}
      <div className="h-[50vh]" aria-hidden="true" />
    </div>
  );
}
