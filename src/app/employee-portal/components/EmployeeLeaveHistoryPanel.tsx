'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { buildClientAuthHeaders } from '@/lib/clientAuth';
import { useAppContext } from '@/context/AppContext';
import Icon from '@/components/ui/AppIcon';


type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  dept: string;
  leaveType: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  session: string;
  units: number;
  reason?: string;
  status: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  cancelReason?: string;
  finalDecisionComment?: string;
};

const REQUEST_STATUSES = ['All', 'pending', 'inquiring', 'approved', 'rejected', 'cancelled'];

interface EmployeeLeaveHistoryPanelProps {
  employeeId?: string;
  onAction?: () => void;
}

export default function EmployeeLeaveHistoryPanel({ employeeId, onAction }: EmployeeLeaveHistoryPanelProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusRequestId = searchParams.get('focusRequest');
  const yearParam = searchParams.get('year');
  const fromSubmit = searchParams.get('fromSubmit') === '1';
  const initialYear = yearParam ? Number(yearParam) : new Date().getFullYear();

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
  const { userId, userRole, userName, userDepartment } = useAppContext();
  const currentEmployeeId = employeeId || userId;
  const authHeaders = React.useMemo(() => {
    return buildClientAuthHeaders({
      role: userRole as any,
      userId: userId,
      userName: userName,
      department: userDepartment
    });
  }, [userId, userRole, userName, userDepartment]);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const focusedRequestRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const res = await fetch(`/api/leave-requests?mode=available-years&employeeId=${currentEmployeeId}`, { headers: authHeaders });
        const data = await res.json();
        if (data.years && data.years.length > 0) {
          setAvailableYears(data.years);
        }
      } catch (err) {
        console.error('Failed to fetch years:', err);
      }
    };
    fetchYears();
  }, [currentEmployeeId, authHeaders]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const statusParam = selectedStatus === 'All' ? '' : selectedStatus;
      const response = await fetch(
        `/api/leave-requests?mode=history&employeeId=${currentEmployeeId}&year=${selectedYear}&status=${statusParam}`,
        {
          headers: authHeaders,
        },
      );

      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to load leave history:', error);
      toast.error(`History Error: ${error instanceof Error ? error.message : 'Failed to load records'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [selectedYear, selectedStatus]);

  useEffect(() => {
    if (!yearParam) return;
    const nextYear = Number(yearParam);
    if (!Number.isNaN(nextYear) && nextYear !== selectedYear) {
      setSelectedYear(nextYear);
    }
  }, [yearParam, selectedYear]);

  useEffect(() => {
    if (!focusRequestId || loading) return;
    if (focusedRequestRef.current === focusRequestId) return;

    const hasTargetRequest = requests.some(req => req.id === focusRequestId);
    if (!hasTargetRequest) return;

    setSelectedStatus('All');
    setExpandedRequestId(focusRequestId);

    requestAnimationFrame(() => {
      document.getElementById(`leave-request-${focusRequestId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    if (fromSubmit) {
      toast.success('Latest leave request located below.');
    }

    focusedRequestRef.current = focusRequestId;

    // Remove focus params after first successful jump so refresh does not retrigger highlight.
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('focusRequest');
    nextParams.delete('fromSubmit');
    nextParams.delete('year');

    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [focusRequestId, requests, loading, fromSubmit, pathname, router, searchParams]);

  const handleCancelRequest = async (requestId: string) => {
    const reason = window.prompt('Cancellation reason (minimum 3 characters):', 'Cancelled by employee');
    if (reason === null) {
      return;
    }

    if (reason.trim().length < 3) {
      toast.error('Cancellation reason must be at least 3 characters.');
      return;
    }

    try {
      setCancellingId(requestId);
      const response = await fetch(`/api/leave-requests/${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          action: 'cancel',
          actor: currentEmployeeId,
          reason,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to cancel leave request');
      }

      toast.success('Leave request cancelled.');
      onAction?.();
      await loadRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel leave request');
    } finally {
      setCancellingId(null);
    }
  };

  const handleReplyToInquiry = async (requestId: string) => {
    const text = (replyText[requestId] || '').trim();
    if (text.length < 5) { toast.error('Reply must be at least 5 characters.'); return; }
    setSubmittingReply(true);
    try {
      const res = await fetch(`/api/leave-requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action: 'respond-to-inquiry', actor: currentEmployeeId, reason: text }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed');
      toast.success('Reply sent — your request is back under review.');
      onAction?.();
      setReplyText(prev => ({ ...prev, [requestId]: '' }));
      setReplyingId(null);
      await loadRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':    return { bg: 'rgba(251,191,36,0.12)', text: 'rgb(251 191 36)' };
      case 'inquiring':  return { bg: 'rgba(167,139,250,0.15)', text: 'rgb(167 139 250)' };
      case 'approved':   return { bg: 'rgba(52,211,153,0.12)', text: 'rgb(52 211 153)' };
      case 'rejected':   return { bg: 'rgba(248,113,113,0.12)', text: 'rgb(248 113 113)' };
      case 'cancelled':  return { bg: 'rgba(156,163,175,0.2)', text: 'rgb(156 163 175)' };
      default:           return { bg: 'rgba(156,163,175,0.12)', text: 'rgb(156 163 175)' };
    }
  };

  const filteredRequests = requests.filter(r => {
    const matchesStatus = selectedStatus === 'All' || r.status === selectedStatus;
    const matchesStartDate = !filterStartDate || r.startDate >= filterStartDate;
    const matchesEndDate = !filterEndDate || r.endDate <= filterEndDate;
    return matchesStatus && matchesStartDate && matchesEndDate;
  });
  const groupedByMonth = filteredRequests.reduce((acc, req) => {
    const monthKey = req.startDate.substring(0, 7);
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(req);
    return acc;
  }, {} as Record<string, LeaveRequest[]>);

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold mb-2 block">Year</label>
            <select className="input-base text-sm w-full" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold mb-2 block">Status</label>
            <select className="input-base text-sm w-full" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
              {REQUEST_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5 mt-2">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 block">From Date</label>
              <input
                type="date"
                className="input-base text-xs w-full cursor-pointer"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                onClick={(e) => (e.currentTarget as any).showPicker?.()}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 block">To Date</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="input-base text-xs w-full cursor-pointer"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  onClick={(e) => (e.currentTarget as any).showPicker?.()}
                />
                {(filterStartDate || filterEndDate) && (
                  <button 
                    onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                    title="Clear date filter"
                  >
                    <Icon name="XMarkIcon" size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(79,127,255,0.12)', border: '1px solid rgba(79,127,255,0.3)' }}>
          <p className="text-xs">Total Days</p>
          <p className="text-lg font-bold" style={{ color: 'rgb(79 127 255)' }}>{filteredRequests.reduce((sum, r) => sum + r.units, 0)}</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}>
          <p className="text-xs">Approved</p>
          <p className="text-lg font-bold" style={{ color: 'rgb(52 211 153)' }}>{filteredRequests.filter(r => r.status === 'approved').length}</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)' }}>
          <p className="text-xs">Pending</p>
          <p className="text-lg font-bold" style={{ color: 'rgb(248 113 113)' }}>{filteredRequests.filter(r => r.status === 'pending').length}</p>
        </div>
      </div>

      {loading ? <div className="text-center text-sm">Loading...</div> : filteredRequests.length === 0 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <p className="text-sm">No requests found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.keys(groupedByMonth).sort().reverse().map(month => (
            <div key={month}>
              <h3 className="text-sm font-semibold mb-3">{new Date(`${month}-01`).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</h3>
              <div className="space-y-2">
                {groupedByMonth[month].map(req => (
                  <div
                    key={req.id}
                    id={`leave-request-${req.id}`}
                    className="rounded-lg p-4 cursor-pointer transition-colors"
                    style={{
                      background: req.id === focusRequestId ? 'rgba(79,127,255,0.08)' : 'rgb(var(--bg-elevated))',
                      border: req.id === focusRequestId ? '1px solid rgba(79,127,255,0.5)' : '1px solid rgb(var(--border-subtle))',
                    }}
                    onClick={() => setExpandedRequestId(expandedRequestId === req.id ? null : req.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: getStatusColor(req.status).bg, color: getStatusColor(req.status).text }}>{req.status}</span>
                          <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(79, 127, 255, 0.12)', color: 'rgb(79 127 255)' }}>{req.leaveType}</span>
                          <span className="text-xs font-mono">{req.units} days</span>
                        </div>
                        <p className="text-xs mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>{req.startDate} to {req.endDate}</p>
                      </div>
                      <div className="text-xs">{new Date(req.requestedAt).toLocaleDateString()}</div>
                    </div>
                    {expandedRequestId === req.id && (
                      <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgb(var(--border))' }}>
                        {req.reason && <div className="mb-3"><p className="text-xs font-semibold mb-1">Reason</p><p className="text-xs">{req.reason}</p></div>}
                        {req.status === 'approved' && req.approvedBy && <div className="mb-3"><p className="text-xs font-semibold mb-1">Approved By</p><p className="text-xs">{req.approvedBy}</p><p className="text-xs">{req.approvedAt ? new Date(req.approvedAt).toLocaleString() : 'N/A'}</p></div>}
                        {req.status === 'rejected' && req.rejectionReason && <div className="mb-3"><p className="text-xs font-semibold mb-1">Rejection Reason</p><p className="text-xs">{req.rejectionReason}</p>{req.rejectedBy && <p className="text-xs">Rejected by {req.rejectedBy}</p>}</div>}
                        {req.status === 'cancelled' && req.cancelReason && <div className="mb-3"><p className="text-xs font-semibold mb-1">Cancellation Reason</p><p className="text-xs">{req.cancelReason}</p></div>}

                        {/* Inquiry: show manager's question and reply form */}
                        {req.status === 'inquiring' && (
                          <div className="mb-3 rounded-lg p-3" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.3)' }}>
                            <p className="text-xs font-semibold mb-1" style={{ color: 'rgb(124 58 237)' }}>🔎 Manager Inquiry</p>
                            {req.finalDecisionComment && <p className="text-xs mb-2" style={{ color: 'rgb(var(--text-secondary))' }}>{req.finalDecisionComment}</p>}
                            {replyingId === req.id ? (
                              <div onClick={e => e.stopPropagation()}>
                                <textarea
                                  className="input-base text-xs w-full mb-2"
                                  rows={3}
                                  placeholder="Type your reply to the manager..."
                                  value={replyText[req.id] || ''}
                                  onChange={e => setReplyText(prev => ({ ...prev, [req.id]: e.target.value }))}
                                />
                                <div className="flex gap-2">
                                  <button className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all duration-200" disabled={submittingReply} onClick={() => handleReplyToInquiry(req.id)}>
                                    {submittingReply ? 'Sending...' : 'Send Reply'}
                                  </button>
                                  <button className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs font-medium transition-all duration-200" onClick={() => setReplyingId(null)}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button className="text-xs underline" style={{ color: 'rgb(124 58 237)' }} onClick={e => { e.stopPropagation(); setReplyingId(req.id); }}>Reply to Manager</button>
                            )}
                          </div>
                        )}

                        {(req.status === 'pending' || req.status === 'inquiring') && (
                          <div className="mt-3">
                            <button
                              type="button"
                              className="px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/10 flex items-center justify-center gap-2"
                              disabled={cancellingId === req.id}
                              onClick={e => {
                                e.stopPropagation();
                                void handleCancelRequest(req.id);
                              }}
                            >
                              {cancellingId === req.id ? (
                                <span className="flex items-center gap-1.5">
                                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                  </svg>
                                  Cancelling...
                                </span>
                              ) : 'Cancel Request'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
