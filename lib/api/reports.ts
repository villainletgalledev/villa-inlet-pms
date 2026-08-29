import { supabase, isSupabaseConfigured } from '../supabase/client';
import { ReportMetricsResult } from '../analytics/reports';

export type {
  ReportMetricsResult,
  ChannelMixItem,
  BookingPaceItem,
  RevenueTimelineItem,
  RoomPerformanceItem,
} from '../analytics/reports';

async function getAuthHeaders(_currentUser?: { role?: string; email?: string }): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers['Authorization'] = `Bearer ${data.session.access_token}`;
      }
    } catch {
      // ignore
    }
  }

  return headers;
}

export async function fetchReportMetrics(
  params?: {
    startDate?: string;
    endDate?: string;
  },
  currentUser?: { role?: string; email?: string }
): Promise<{
  data?: ReportMetricsResult;
  error?: string;
}> {
  try {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/reports?${query.toString()}`, { headers });
    const result = await res.json();

    if (!res.ok) {
      return { error: result.error || 'Failed to fetch analytics metrics' };
    }
    return { data: result };
  } catch (err: any) {
    return { error: err.message || 'Network error fetching analytics' };
  }
}

export async function downloadReportsCsv(
  params?: {
    startDate?: string;
    endDate?: string;
  },
  currentUser?: { role?: string; email?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    const headers = await getAuthHeaders(currentUser);
    const res = await fetch(`/api/reports/export-csv?${query.toString()}`, { headers });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || 'Failed to export CSV' };
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `villa-inlet-bookings-${params?.startDate || 'start'}-to-${params?.endDate || 'end'}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error downloading CSV' };
  }
}
