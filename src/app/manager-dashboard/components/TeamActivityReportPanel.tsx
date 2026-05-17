'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAppContext } from '@/context/AppContext';
import { buildClientAuthHeaders, readClientIdentity } from '@/lib/clientAuth';

type Activity = {
  date: string;
  employeeName: string;
  month: string;
  category: string;
  status: string;
  leaveType?: string;
  units?: number;
  reason?: string;
};

type TeamLeaveRequest = {
  id: string;
  employeeName: string;
  leaveType: string;
  units: number;
  status: string;
  requestedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  cancelledAt?: string;
  reason?: string;
  rejectionReason?: string;
  cancelReason?: string;
  finalDecisionComment?: string;
};

const ACTIVITY_CATEGORIES = [
  'Leave Approved',
  'Leave Rejected',
  'Leave Pending',
  'Leave Cancelled',
];

function mapStatusToCategory(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return 'Leave Approved';
  if (normalized === 'rejected') return 'Leave Rejected';
  if (normalized === 'cancelled') return 'Leave Cancelled';
  return 'Leave Pending';
}

function resolveActivityDate(request: TeamLeaveRequest) {
  return request.approvedAt
    || request.rejectedAt
    || request.cancelledAt
    || request.requestedAt
    || new Date().toISOString();
}

function getMonthTimestamp(monthLabel: string) {
  const timestamp = new Date(`1 ${monthLabel}`).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export default function TeamActivityReportPanel() {
  const { selectedYear } = useAppContext();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const identity = useMemo(() => readClientIdentity('hod'), []);
  const authHeaders = useMemo(
    () => buildClientAuthHeaders(identity),
    [identity.department, identity.role, identity.userId],
  );
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadActivities = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        mode: 'team-history',
        year: String(selectedYear),
      });

      const response = await fetch(`/api/leave-requests?${query.toString()}`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error('Failed to load activities');
      }

      const data = await response.json();
      const requests = (data.requests || []) as TeamLeaveRequest[];

      const activitiesFromLeave: Activity[] = requests
        .map(req => {
          const activityDate = resolveActivityDate(req);
          const parsedDate = new Date(activityDate);
          const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

          return {
            date: safeDate.toISOString().slice(0, 10),
            employeeName: req.employeeName,
            month: safeDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
            category: mapStatusToCategory(req.status),
            status: req.status,
            leaveType: req.leaveType,
            units: Number(req.units || 0),
            reason: req.finalDecisionComment || req.rejectionReason || req.cancelReason || req.reason,
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setActivities(activitiesFromLeave);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadActivities();
  }, [authHeaders, selectedYear]);

  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      if (selectedMonth && activity.month !== selectedMonth) return false;
      if (selectedCategory !== 'All' && activity.category !== selectedCategory) return false;
      if (searchQuery && !activity.employeeName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [activities, selectedMonth, selectedCategory, searchQuery]);

  const uniqueMonths = Array.from(new Set(activities.map(a => a.month))).sort((a, b) => getMonthTimestamp(b) - getMonthTimestamp(a));
  const groupedByMonth = useMemo(() => {
    return filteredActivities.reduce(
      (acc, activity) => {
        if (!acc[activity.month]) acc[activity.month] = [];
        acc[activity.month].push(activity);
        return acc;
      },
      {} as Record<string, Activity[]>,
    );
  }, [filteredActivities]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Leave Approved':
        return { bg: 'rgba(52,211,153,0.12)', text: 'rgb(52 211 153)' };
      case 'Leave Rejected':
        return { bg: 'rgba(248,113,113,0.12)', text: 'rgb(248 113 113)' };
      case 'Leave Pending':
        return { bg: 'rgba(251,191,36,0.12)', text: 'rgb(251 191 36)' };
      case 'Leave Cancelled':
        return { bg: 'rgba(156,163,175,0.15)', text: 'rgb(156 163 175)' };
      default:
        return { bg: 'rgba(156,163,175,0.12)', text: 'rgb(156 163 175)' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Month Filter */}
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Month</label>
            <select
              className="input-base text-sm w-full"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              <option value="">All Months</option>
              {uniqueMonths.map(month => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Category</label>
            <select
              className="input-base text-sm w-full"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              {ACTIVITY_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Staff Name</label>
            <input
              type="text"
              className="input-base text-sm w-full"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      {loading ? (
        <div className="text-center text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Loading activities...</div>
      ) : filteredActivities.length === 0 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>No activities found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.keys(groupedByMonth)
            .sort((a, b) => getMonthTimestamp(b) - getMonthTimestamp(a))
            .map(month => (
              <div key={month}>
                <h3 className="text-sm font-semibold mb-4 sticky top-0 z-10 py-2" style={{ color: 'rgb(var(--text-primary))' }}>
                  {month}
                </h3>
                <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid rgb(var(--border-subtle))' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                        <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Staff Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Category</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedByMonth[month].map((activity, idx) => {
                        const colors = getCategoryColor(activity.category);
                        return (
                          <tr key={`${month}-${idx}`} style={{ borderBottom: '1px solid rgb(var(--border))' }}>
                            <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                              {new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                              {activity.employeeName}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="text-xs px-2.5 py-1 rounded-full"
                                style={{
                                  background: colors.bg,
                                  color: colors.text,
                                }}
                              >
                                {activity.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                              {activity.leaveType && (
                                <span className="mr-3">
                                  {activity.leaveType}
                                  {activity.units && <span> ({activity.units} days)</span>}
                                </span>
                              )}
                              {activity.reason && <span>{activity.reason}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Visible Approved</p>
          <p className="text-lg font-bold" style={{ color: 'rgb(52 211 153)' }}>
            {filteredActivities.filter(a => a.category === 'Leave Approved').length}
          </p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)' }}>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Visible Rejected</p>
          <p className="text-lg font-bold" style={{ color: 'rgb(248 113 113)' }}>
            {filteredActivities.filter(a => a.category === 'Leave Rejected').length}
          </p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Visible Pending</p>
          <p className="text-lg font-bold" style={{ color: 'rgb(245 158 11)' }}>
            {filteredActivities.filter(a => a.category === 'Leave Pending').length}
          </p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(79,127,255,0.12)', border: '1px solid rgba(79,127,255,0.3)' }}>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Visible Days Used</p>
          <p className="text-lg font-bold font-mono" style={{ color: 'rgb(79 127 255)' }}>
            {filteredActivities.reduce((sum, a) => sum + (a.units || 0), 0)}
          </p>
        </div>
      </div>
    </div>
  );
}
