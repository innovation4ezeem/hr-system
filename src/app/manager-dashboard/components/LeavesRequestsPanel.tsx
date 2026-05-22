'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { useAppContext } from '@/context/AppContext';
import { buildClientAuthHeaders, readClientIdentity } from '@/lib/clientAuth';

type LeaveType = 'Annual Leave' | 'MC' | 'WFH' | 'Unpaid' | 'Reward Leave' | 'CS Replacement';
type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

type TeamHistoryLeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  dept: string;
  leaveType: string;
  employmentType?: string;
  startDate: string;
  endDate: string;
  session?: string;
  units?: number;
  reason?: string;
  status: string;
  requestedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  cancelledAt?: string;
  finalDecisionComment?: string;
  rejectionReason?: string;
  cancelReason?: string;
};

interface LeaveRequest {
  id: string;
  employee: string;
  dept: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  halfDay: boolean;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  appliedAt: string;
}

const leaveTypeColor: Record<LeaveType, { bg: string; text: string }> = {
  'Annual Leave': { bg: 'rgba(79,127,255,0.1)', text: 'rgb(79 127 255)' },
  MC: { bg: 'rgba(248,113,113,0.1)', text: 'rgb(248 113 113)' },
  WFH: { bg: 'rgba(52,211,153,0.1)', text: 'rgb(52 211 153)' },
  Unpaid: { bg: 'rgba(100,100,130,0.15)', text: 'rgb(var(--text-secondary))' },
  'Reward Leave': { bg: 'rgba(251,191,36,0.1)', text: 'rgb(251 191 36)' },
  'CS Replacement': { bg: 'rgba(167,139,250,0.1)', text: 'rgb(167 139 250)' },
};

const statusStyle: Record<LeaveStatus, { bg: string; text: string }> = {
  Pending: { bg: 'rgba(251,191,36,0.1)', text: 'rgb(251 191 36)' },
  Approved: { bg: 'rgba(52,211,153,0.1)', text: 'rgb(52 211 153)' },
  Rejected: { bg: 'rgba(248,113,113,0.1)', text: 'rgb(248 113 113)' },
};

interface LeaveRequestsPanelProps {
  compact?: boolean;
  departmentScope?: string | null;
  canManage?: boolean;
}

function normalizeStatus(status: string): LeaveStatus {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return 'Approved';
  if (normalized === 'rejected' || normalized === 'cancelled') return 'Rejected';
  return 'Pending';
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB');
}

function mapRequest(request: TeamHistoryLeaveRequest): LeaveRequest {
  const halfDay = String(request.session || '').toUpperCase() !== 'FULL' || Number(request.units || 0) < 1;
  const appliedSource = request.requestedAt || request.approvedAt || request.rejectedAt || request.cancelledAt || new Date().toISOString();
  const appliedOn = formatDate(appliedSource);
  return {
    id: request.id,
    employee: request.employeeName,
    dept: request.dept,
    type: (request.leaveType as LeaveType) || 'Annual Leave',
    startDate: formatDate(request.startDate),
    endDate: formatDate(request.endDate),
    days: Number(request.units ?? 0),
    halfDay,
    reason: request.finalDecisionComment || request.rejectionReason || request.cancelReason || request.reason || '-',
    status: normalizeStatus(request.status),
    appliedOn,
    appliedAt: appliedSource,
  };
}

export default function LeaveRequestsPanel({ compact = false, departmentScope = null, canManage = true }: LeaveRequestsPanelProps) {
  const { selectedYear, userRole } = useAppContext();
  
  if (userRole !== 'admin' && userRole !== 'hod' && userRole !== 'director') {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed rounded-xl" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
        <Icon name="ShieldExclamationIcon" size={32} className="text-red-500/50 mb-2" />
        <p className="text-xs text-slate-400">Management Access Only</p>
      </div>
    );
  }

  const identity = useMemo(() => readClientIdentity('hod'), []);
  const authHeaders = useMemo(
    () => buildClientAuthHeaders(identity),
    [identity.department, identity.role, identity.userId],
  );
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveDepartment = departmentScope ?? (identity.role === 'hod' ? identity.department : null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mode: 'team-history', year: String(selectedYear), status: 'all' });
      if (effectiveDepartment) {
        params.set('department', effectiveDepartment);
      }

      const response = await fetch(`/api/leave-requests?${params.toString()}`, { headers: authHeaders });
      const contentType = response.headers.get('content-type');
      let payload: any = {};
      
      if (contentType && contentType.includes('application/json')) {
        payload = await response.json().catch(() => ({}));
      }

      if (!response.ok) {
        throw new Error(payload?.error || `Server returned ${response.status}`);
      }
      const mapped = Array.isArray(payload.requests) ? (payload.requests as TeamHistoryLeaveRequest[]).map(mapRequest) : [];
      setRequests(mapped);
    } catch (error) {
      console.error('Failed to load leave requests:', error);
      toast.error(`History Error: ${error instanceof Error ? error.message : 'Failed to load leave requests'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDepartment, selectedYear]);

  const handleDecision = async (requestId: string, action: 'approve' | 'reject') => {
    const body = action === 'approve'
      ? { action: 'approve', actor: identity.userId, comment: '' }
      : { action: 'reject', actor: identity.userId, reason: 'Rejected from manager panel', comment: '' };

    try {
      const response = await fetch(`/api/leave-requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to ${action} leave request`);
      }

      const updated = payload.request ? mapRequest(payload.request as TeamHistoryLeaveRequest) : null;
      if (updated) {
        setRequests(prev => prev.map(item => (item.id === requestId ? updated : item)));
      } else {
        await loadRequests();
      }

      toast.success(action === 'approve' ? 'Leave request approved' : 'Leave request rejected');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${action === 'approve' ? 'Approval' : 'Rejection'} failed`);
    }
  };

  const scoped = effectiveDepartment ? requests.filter(request => request.dept === effectiveDepartment) : requests;
  const pendingCount = scoped.filter(request => request.status === 'Pending').length;
  const sorted = [...scoped].sort((a, b) => {
    if (a.status === b.status) {
      return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
    }
    if (a.status === 'Pending') return -1;
    if (b.status === 'Pending') return 1;
    return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
  });
  const displayed = compact ? sorted.slice(0, 4) : sorted;

  return (
    <div className="rounded-xl overflow-hidden h-full" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
            Leave Requests
            {pendingCount > 0 && (
              <span
                className="ml-2 text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(251,191,36,0.15)', color: 'rgb(251 191 36)' }}
              >
                {pendingCount} pending
              </span>
            )}
          </h2>
        </div>
      </div>

      <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
        {loading ? (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
            Loading leave requests...
          </div>
        ) : displayed.length > 0 ? (
          displayed.map(req => {
            const ltc = leaveTypeColor[req.type] || leaveTypeColor['Annual Leave'];
            const sc = statusStyle[req.status];
            return (
              <div key={req.id} className="px-5 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{decodeURIComponent(req.employee)}</span>
                      <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{req.dept}</span>
                      {req.halfDay && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(167,139,250,0.1)', color: 'rgb(167 139 250)' }}
                        >
                          Half Day
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: ltc.bg, color: ltc.text }}>
                        {req.type}
                      </span>
                      <span className="text-xs font-mono" style={{ color: 'rgb(var(--text-secondary))', fontVariantNumeric: 'tabular-nums' }}>
                        {req.startDate} {req.startDate !== req.endDate ? `→ ${req.endDate}` : ''} · {req.days}d
                      </span>
                    </div>
                    {!compact && <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{req.reason}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.text }}>
                      {req.status}
                    </span>
                    {req.status === 'Pending' && canManage && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => void handleDecision(req.id, 'approve')}
                          className="p-1.5 rounded-lg hover:bg-emerald-400/10 transition-colors"
                          title="Approve leave request"
                          style={{ color: 'rgb(52 211 153)' }}
                        >
                          <Icon name="CheckIcon" size={14} />
                        </button>
                        <button
                          onClick={() => void handleDecision(req.id, 'reject')}
                          className="p-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
                          title="Reject leave request"
                          style={{ color: 'rgb(248 113 113)' }}
                        >
                          <Icon name="XMarkIcon" size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="CalendarDaysIcon" size={36} className="mb-3 opacity-30" style={{ color: 'rgb(var(--text-secondary))' }} />
            <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>No leave requests found</p>
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>The selected department has no leave records for this year.</p>
          </div>
        )}
      </div>
    </div>
  );
}
