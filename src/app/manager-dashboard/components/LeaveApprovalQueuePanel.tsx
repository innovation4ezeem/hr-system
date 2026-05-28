'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { buildClientAuthHeaders, readClientIdentity } from '@/lib/clientAuth';
import Icon from '@/components/ui/AppIcon';
import { useAppContext } from '@/context/AppContext';

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
  attachment?: string;
  finalDecisionComment?: string;
  employeeStatus?: string;
};

const LEAVE_TYPES = ['All'];
const EMPLOYMENT_TYPES = ['All', 'Permanent', 'Intern', 'Probation'];
const DATE_RANGES = ['Today', 'This Week', 'This Month', 'This Year', 'Custom'];

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'rgba(79,127,255,0.12)', text: 'rgb(79 127 255)', label: 'Pending' },
  approved: { bg: 'rgba(52,211,153,0.12)', text: 'rgb(52 211 153)', label: 'Approved' },
  rejected: { bg: 'rgba(248,113,113,0.12)', text: 'rgb(248 113 113)', label: 'Rejected' },
  cancelled: { bg: 'rgba(148,163,184,0.12)', text: 'rgb(148 163 184)', label: 'Cancelled' },
};

function StatusBadge({ status }: { status: string }) {
  const st = STATUS_STYLE[status] || { bg: 'rgba(148,163,184,0.12)', text: 'rgb(148 163 184)', label: status };
  return (
    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: st.bg, color: st.text }}>
      {st.label}
    </span>
  );
}

type ModalMode = 'reject' | null;

export default function LeaveApprovalQueuePanel() {
  const { userRole } = useAppContext();
  
  if (userRole !== 'admin' && userRole !== 'hod' && userRole !== 'director') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Icon name="ShieldExclamationIcon" size={48} className="text-red-500/50 mb-4" />
        <h3 className="text-lg font-semibold text-white">Access Restricted</h3>
        <p className="text-sm text-slate-400 max-w-xs mx-auto mt-2">
          This panel is for managers only. If you are a standard employee, please use the Employee Portal to manage your leave.
        </p>
      </div>
    );
  }

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<string[]>(['All']);
  const [requestStatuses, setRequestStatuses] = useState<string[]>(['All', 'pending', 'approved', 'rejected', 'cancelled']);
  const [loading, setLoading] = useState(true);

  const identity = useMemo(() => readClientIdentity('hod'), []);
  const currentManagerId = identity.userId;
  const authHeaders = useMemo(
    () => buildClientAuthHeaders(identity),
    [identity.department, identity.role, identity.userId],
  );

  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedLeaveType, setSelectedLeaveType] = useState('All');
  const [selectedEmploymentType, setSelectedEmploymentType] = useState('All');
  const [dateRange, setDateRange] = useState('This Month');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');

  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [modalText, setModalText] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadInitialData = async () => {
    try {
      // 1. Load Leave Types
      const res = await fetch('/api/leave-management?mode=leave-types', { headers: authHeaders });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data.leaveTypes)) {
            setLeaveTypes(['All', ...data.leaveTypes.map((t: any) => t.code)]);
          }
        }
      }

      // 2. Load Statuses from DB
      const sRes = await fetch('/api/leave-management?mode=statuses', { headers: authHeaders });
      if (sRes.ok) {
        const contentType = sRes.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const sData = await sRes.json();
          if (Array.isArray(sData.statuses)) {
            setRequestStatuses(['All', ...sData.statuses]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const today = new Date();
      let start = new Date(today);
      let end = new Date(today);

      if (dateRange === 'Today') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else if (dateRange === 'This Week') {
        const day = today.getDay();
        start.setDate(today.getDate() - day);
        end.setDate(today.getDate() + (6 - day));
      } else if (dateRange === 'This Month') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      } else if (dateRange === 'This Year') {
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
      } else if (dateRange === 'Custom') {
        start = customDateStart ? new Date(customDateStart) : new Date(0);
        end = customDateEnd ? new Date(customDateEnd) : new Date();
      }

      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const url = new URL(basePath + '/api/leave-requests', window.location.origin);
      url.searchParams.append('mode', 'queue');
      url.searchParams.append('hodId', 'ALL');
      if (statusFilter && statusFilter !== 'All') url.searchParams.append('status', statusFilter);
      url.searchParams.append('dateRangeStart', start.toISOString().split('T')[0]);
      url.searchParams.append('dateRangeEnd', end.toISOString().split('T')[0]);
      if (selectedLeaveType && selectedLeaveType !== 'All') url.searchParams.append('leaveType', selectedLeaveType);
      if (selectedEmploymentType && selectedEmploymentType !== 'All') url.searchParams.append('employmentType', selectedEmploymentType);
      if (employeeSearchQuery) url.searchParams.append('employeeNameSearch', employeeSearchQuery);

      const res = await fetch(url, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Server returned ${res.status}`);
      }
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to load queue:', err);
      toast.error(`Queue Error: ${err instanceof Error ? err.message : 'Failed to load requests'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInitialData();
  }, [authHeaders]);

  useEffect(() => {
    void loadRequests();
  }, [statusFilter, selectedLeaveType, selectedEmploymentType, dateRange, customDateStart, customDateEnd, employeeSearchQuery, authHeaders]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Handle direct actions from email links
  useEffect(() => {
    if (loading || requests.length === 0) return;

    const targetId = searchParams.get('requestId');
    const action = searchParams.get('action');

    if (targetId && action) {
      const targetReq = requests.find(r => r.id === targetId);
      
      const cleanUrl = () => {
        const params = new URLSearchParams(window.location.search);
        params.delete('requestId');
        params.delete('action');
        const newSearch = params.toString();
        router.replace(newSearch ? `${pathname}?${newSearch}` : pathname);
      };

      if (targetReq) {
        if (targetReq.status === 'pending') {
          if (action === 'approve') {
            handleApprove(targetReq);
            cleanUrl();
          } else if (action === 'reject') {
            setSelectedRequest(targetReq);
            setModalMode('reject');
            cleanUrl();
          }
        } else {
          toast.success(`Request is already processed (Status: ${targetReq.status})`);
          cleanUrl();
        }
      } else {
        if (statusFilter !== 'All') {
          // If request not found in pending, try showing all to see if it was already processed
          setStatusFilter('All');
        } else {
          // Not found even in All
          toast.error(`Request ${targetId} not found in the list.`);
          cleanUrl();
        }
      }
    }
  }, [loading, requests.length, searchParams, statusFilter, pathname, router]);

  const handleApprove = async (req: LeaveRequest) => {
    setProcessingId(req.id);
    try {
      const res = await fetch(`/api/leave-requests/${req.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action: 'approve', actor: identity.userId, comment: '' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Approval failed');
      }
      toast.success(`✅ Approved for ${req.employeeName}`);
      setRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval failed');
    } finally {
      setProcessingId(null);
    }
  };

  const handleModalSubmit = async () => {
    if (!selectedRequest) return;
    if (!modalText.trim()) { toast.error('Please enter a message'); return; }

    setProcessingId(selectedRequest.id);
    try {
      if (modalMode === 'reject') {
        const res = await fetch(`/api/leave-requests/${selectedRequest.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ action: 'reject', actor: identity.userId, reason: modalText, comment: '' }),
        });
        if (!res.ok) throw new Error('Rejection failed');
        toast.success(`❌ Rejected for ${selectedRequest.employeeName}`);
        setRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
      }

      setModalMode(null);
      setSelectedRequest(null);
      setModalText('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (statusFilter && statusFilter !== 'All' && req.status !== statusFilter) return false;
      if (selectedLeaveType && selectedLeaveType !== 'All' && req.leaveType !== selectedLeaveType) return false;
      if (selectedEmploymentType && selectedEmploymentType !== 'All' && req.employmentType !== selectedEmploymentType) return false;
      if (employeeSearchQuery && !req.employeeName.toLowerCase().includes(employeeSearchQuery.toLowerCase())) return false;

      const isInactive = req.employeeStatus === 'inactive' || req.employeeStatus === 'terminated';
      if (showInactive) {
        return isInactive;
      } else {
        return !isInactive;
      }
    });
  }, [requests, showInactive, selectedLeaveType, selectedEmploymentType, employeeSearchQuery, statusFilter]);

  const isActionable = (req: LeaveRequest) => req.status === 'pending';

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-black uppercase tracking-widest mb-2 block" style={{ color: 'rgb(var(--text-secondary))' }}>Status</label>
            <select className="input-base text-sm w-full capitalize" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              {requestStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest mb-2 block" style={{ color: 'rgb(var(--text-secondary))' }}>Leave Type</label>
            <select className="input-base text-sm w-full" value={selectedLeaveType} onChange={e => setSelectedLeaveType(e.target.value)}>
              {leaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest mb-2 block" style={{ color: 'rgb(var(--text-secondary))' }}>Employment Type</label>
            <select className="input-base text-sm w-full" value={selectedEmploymentType} onChange={e => setSelectedEmploymentType(e.target.value)}>
              {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest mb-2 block" style={{ color: 'rgb(var(--text-secondary))' }}>Search Employee</label>
            <div className="relative">
              <input
                className="input-base text-sm w-full pl-9"
                placeholder="Name..."
                value={employeeSearchQuery}
                onChange={e => setEmployeeSearchQuery(e.target.value)}
              />
              <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 mt-5 pt-4 border-t" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
          <div className="flex items-center gap-3">
            <label className="text-xs font-black uppercase tracking-widest" style={{ color: 'rgb(var(--text-secondary))' }}>Period</label>
            <div className="flex bg-indigo-500/10 p-1 rounded-lg border border-indigo-500/20">
              {DATE_RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`text-[11px] px-3 py-1.5 rounded-md font-bold transition-all ${dateRange === r ? 'bg-indigo-600 text-white shadow-lg' : 'text-[rgb(var(--text-secondary))] hover:text-indigo-600'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {dateRange === 'Custom' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
              <input type="date" className="input-base text-xs py-1.5 h-8" value={customDateStart} onChange={e => setCustomDateStart(e.target.value)} />
              <span className="text-gray-600">to</span>
              <input type="date" className="input-base text-xs py-1.5 h-8" value={customDateEnd} onChange={e => setCustomDateEnd(e.target.value)} />
            </div>
          )}

          <div className="ml-auto flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={showInactive}
                  onChange={e => setShowInactive(e.target.checked)}
                />
                <div className="w-8 h-4 bg-gray-700 rounded-full peer-checked:bg-red-600 transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
              </div>
              <span className="text-xs font-medium text-gray-400 group-hover:text-gray-200">Show Inactive Employees</span>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden shadow-2xl" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4" />
              <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>Loading requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-gray-800/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700/50">
                <Icon name="InboxIcon" size={32} className="text-gray-600" />
              </div>
              <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>No leave requests found matching filters</p>
              <button onClick={() => { setStatusFilter('All'); setSelectedLeaveType('All'); setShowInactive(false); }} className="mt-4 text-xs text-blue-400 hover:underline">Clear all filters</button>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-black/20">
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Dates</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Days</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Doc</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(req => (
                  <tr key={req.id} style={{ borderBottom: '1px solid rgb(var(--border))' }}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm" style={{ color: 'rgb(var(--text-primary))' }}>
                        {decodeURIComponent(req.employeeName)}
                        {(req.employeeStatus === 'inactive' || req.employeeStatus === 'terminated') && (
                          <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{req.dept} · {req.employmentType}</div>
                      {req.reason && <div className="text-xs mt-0.5 max-w-[200px] truncate" style={{ color: 'rgb(var(--text-muted))' }} title={req.reason}>"{req.reason}"</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(79,127,255,0.12)', color: 'rgb(79 127 255)' }}>
                        {req.leaveType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                      <div>{req.startDate}</div>
                      <div className="opacity-50 text-[10px] uppercase">{req.session}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                      {req.units}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {req.attachment ? (
                        <button className="text-blue-400 hover:text-blue-300 p-1.5 rounded-lg bg-blue-400/10 border border-blue-400/20" title="View Attachment">
                          <Icon name="PaperClipIcon" size={14} />
                        </button>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {isActionable(req) ? (
                          <>
                            <button
                              onClick={() => handleApprove(req)}
                              disabled={!!processingId}
                              className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-all flex items-center justify-center"
                              title="Approve"
                            >
                              {processingId === req.id ? <div className="w-3 h-3 border-2 border-current border-t-transparent animate-spin rounded-full" /> : <Icon name="CheckIcon" size={16} />}
                            </button>
                            <button
                              onClick={() => { setSelectedRequest(req); setModalMode('reject'); }}
                              disabled={!!processingId}
                              className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-all flex items-center justify-center"
                              title="Reject"
                            >
                              <Icon name="XMarkIcon" size={16} />
                            </button>
                          </>
                        ) : (
                          <div className="text-[10px] uppercase font-bold text-gray-600 tracking-wider">Processed</div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalMode && selectedRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#1a1c2e] rounded-2xl border border-gray-800 shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {modalMode === 'reject' && <><div className="w-2 h-6 bg-rose-500 rounded-full" /> Reject Request</>}
              </h3>
              <button onClick={() => { setModalMode(null); setSelectedRequest(null); }} className="text-gray-500 hover:text-white transition-colors">
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>

            <div className="mb-6 p-4 rounded-xl bg-black/20 border border-gray-800/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
                  {selectedRequest.employeeName.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{selectedRequest.employeeName}</p>
                  <p className="text-xs text-gray-500">{selectedRequest.leaveType} · {selectedRequest.units} Days</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 italic">" {selectedRequest.reason || 'No reason provided'} "</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Message to Employee</label>
                <textarea
                  className="input-base text-sm w-full h-32 resize-none"
                  placeholder={modalMode === 'reject' ? "Please explain why this request is being rejected..." : "Enter message..."}
                  value={modalText}
                  onChange={e => setModalText(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setModalMode(null); setSelectedRequest(null); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-800 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModalSubmit}
                  disabled={!!processingId || !modalText.trim()}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all ${modalMode === 'reject' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/20'}`}
                >
                  {processingId ? <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full mx-auto" /> : modalMode === 'reject' ? 'Confirm Rejection' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
