'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { buildClientAuthHeaders, getDefaultReportingOfficer, readClientIdentity } from '@/lib/clientAuth';
import { useAppContext } from '@/context/AppContext';
import Icon from '@/components/ui/AppIcon';


type LeaveTypeCode =
  | 'AL' | 'MC' | 'CASUAL' | 'MATERNITY' | 'PATERNITY'
  | 'BEREAVEMENT' | 'UNPAID' | 'WFH' | 'REWARD' | 'CS' | 'REPLACEMENT' | 'ADDITIONAL';

type LeaveTypeOption = {
  code: LeaveTypeCode;
  name: string;
  availableDays: number;
  allowNegativeBalance: boolean;
};

type LeaveValidationPayload = {
  valid: boolean;
  overlap: boolean;
  units: number;
  warnings: string[];
  workingDates: string[];
  balancePreview: {
    before: number;
    after: number;
    minAllowed: number;
    leaveTypeCode: string;
  };
};

interface ApplyLeaveForm {
  typeCode: LeaveTypeCode;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  fromHalf: 'AM' | 'PM';
  toHalf: 'AM' | 'PM';
  reason: string;
  attachmentFile: File | null;
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getBalanceBannerStyle(after: number, minAllowed: number, before: number) {
  if (after < minAllowed) return { bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.35)', text: 'rgb(248 113 113)', icon: '🔴' };
  const ratio = before > 0 ? after / before : 1;
  if (ratio < 0.3) return { bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.35)', text: 'rgb(251 191 36)', icon: '⚠️' };
  return { bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.35)', text: 'rgb(52 211 153)', icon: '✅' };
}

const DEFAULT_LEAVE_TYPES: LeaveTypeOption[] = [
  { code: 'AL', name: 'Annual Leave', availableDays: 0, allowNegativeBalance: false },
  { code: 'MC', name: 'Medical Leave', availableDays: 0, allowNegativeBalance: false },
  { code: 'WFH', name: 'WFH', availableDays: 0, allowNegativeBalance: false },
  { code: 'UNPAID', name: 'Unpaid Leave', availableDays: 0, allowNegativeBalance: false },
  { code: 'REWARD', name: 'Reward Leave', availableDays: 0, allowNegativeBalance: false },
  { code: 'CS', name: 'Compassionate Leave', availableDays: 0, allowNegativeBalance: false },
  { code: 'REPLACEMENT', name: 'Replacement Leave', availableDays: 0, allowNegativeBalance: false },
  { code: 'ADDITIONAL', name: 'Additional Leave', availableDays: 0, allowNegativeBalance: false },
  { code: 'MATERNITY', name: 'Maternity Leave', availableDays: 0, allowNegativeBalance: false },
  { code: 'PATERNITY', name: 'Paternity Leave', availableDays: 0, allowNegativeBalance: false },
];

export default function ApplyLeaveRequestForm() {
  const router = useRouter();
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>(DEFAULT_LEAVE_TYPES);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<LeaveValidationPayload | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showWorkingDays, setShowWorkingDays] = useState(false);

  const [form, setForm] = useState<ApplyLeaveForm>({
    typeCode: 'AL',
    startDate: getTodayDateString(),
    endDate: '',
    halfDay: false,
    fromHalf: 'AM',
    toHalf: 'PM',
    reason: '',
    attachmentFile: null,
  });
  const { userId, userName, userDepartment, userRole } = useAppContext();
  const employeeId = userId;
  const employeeName = userName;
  const departmentId = userDepartment;
  const reportingOfficer = getDefaultReportingOfficer(departmentId);

  const [submitting, setSubmitting] = useState(false);

  // Draft persistence
  useEffect(() => {
    const saved = localStorage.getItem(`leave_draft_${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setForm(prev => ({ ...prev, ...parsed }));
      } catch (e) {}
    }
  }, [userId]);

  useEffect(() => {
    if (form.reason || form.endDate) {
      localStorage.setItem(`leave_draft_${userId}`, JSON.stringify({
        typeCode: form.typeCode,
        startDate: form.startDate,
        endDate: form.endDate,
        halfDay: form.halfDay,
        fromHalf: form.fromHalf,
        toHalf: form.toHalf,
        reason: form.reason
      }));
    }
  }, [form, userId]);

  // Clear draft on success helper
  const clearDraft = () => localStorage.removeItem(`leave_draft_${userId}`);

  const finalEndDate = form.endDate || form.startDate;
  const isSingleDay = finalEndDate === form.startDate;

  useEffect(() => {
    if (form.halfDay && isSingleDay && form.toHalf !== form.fromHalf) {
      setForm(prev => ({ ...prev, toHalf: prev.fromHalf }));
    }
  }, [form.halfDay, isSingleDay, form.fromHalf, form.toHalf]);

  const authHeaders = useMemo(() => {
    return buildClientAuthHeaders({
      role: userRole as any,
      userId: userId,
      userName: userName,
      department: userDepartment
    });
  }, [userId, userName, userDepartment, userRole]);

  const requestYear = Number((form.startDate || getTodayDateString()).slice(0, 4));

  const selectedLeaveType = useMemo(
    () => leaveTypes.find(item => item.code === form.typeCode),
    [leaveTypes, form.typeCode],
  );

  // Load eligible leave types
  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    const loadEligibleLeaveTypes = async () => {
      try {
        setLoadingTypes(true);
        const response = await fetch(
          `/api/leave-management?mode=eligible-types&employeeId=${encodeURIComponent(employeeId)}&year=${requestYear}`,
          { headers: authHeaders },
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Failed to load leave types');
        if (cancelled) return;
        const fetchedTypes = (payload?.leaveTypes || []) as LeaveTypeOption[];
        
        // Find if user has Carry Forward balance in AL to inject a pseudo-type
        let finalTypes = fetchedTypes.map(t => {
           if (t.code === 'REWARD') return { ...t, name: 'Reward Leave' };
           return t;
        });

        const alType = fetchedTypes.find(t => t.code === 'AL');
        if (alType && alType.availableDays > 0) {
           // We'll check if there's actual carry forward from balances API
           // But for now, we'll just allow AL and assume system handles deduction order
        }

        // Filter out Reward, Replacement, Additional if balance is 0
        const filteredTypes = finalTypes.filter(t => {
          if (['REWARD', 'REPLACEMENT', 'ADDITIONAL'].includes(t.code)) {
            return t.availableDays > 0;
          }
          return true;
        });

        setLeaveTypes(filteredTypes);
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Failed to load leave types');
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    };
    void loadEligibleLeaveTypes();
    return () => { cancelled = true; };
  }, [authHeaders, employeeId, requestYear]);

  // Live validation on every form change
  useEffect(() => {
    let cancelled = false;
    const runValidation = async () => {
      if (!form.typeCode || !form.startDate) { setValidation(null); return; }
      const finalEndDate = form.endDate || form.startDate;
      try {
        setValidating(true);
        // Determine session: for half-day single-day, use AM or PM; multi-day always FULL
        const singleDay = (form.endDate || form.startDate) === form.startDate;
        const session = form.halfDay && singleDay ? form.fromHalf : 'FULL';

        const response = await fetch('/api/leave-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            action: 'validate',
            employeeId,
            leaveType: form.typeCode,
            startDate: form.startDate,
            endDate: finalEndDate,
            session,
            fromHalf: form.halfDay ? form.fromHalf : undefined,
            toHalf: form.halfDay ? form.toHalf : undefined,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Validation failed');
        if (!cancelled) {
          setValidation(payload.validation as LeaveValidationPayload);
          setValidationError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setValidation(null);
          setValidationError(err instanceof Error ? err.message : 'Validation failed');
        }
      } finally {
        if (!cancelled) setValidating(false);
      }
    };
    void runValidation();
    return () => { cancelled = true; };
  }, [authHeaders, employeeId, form.endDate, form.fromHalf, form.halfDay, form.startDate, form.toHalf, form.typeCode]);

  const minStartDate = getTodayDateString();

  const canSubmit =
    !submitting && !loadingTypes && !validating &&
    Boolean(form.typeCode) && Boolean(form.startDate) &&
    form.reason.trim().length >= 10 &&
    Boolean(validation?.valid) && !validation?.overlap;

  const uploadAttachment = async () => {
    if (!form.attachmentFile) return undefined;
    const body = new FormData();
    body.append('file', form.attachmentFile);
    const response = await fetch('/api/leave-attachments', { method: 'POST', body });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Failed to upload attachment');
    return payload?.attachment?.path as string | undefined;
  };

  const handleApply = async () => {
    if (!form.startDate) { toast.error('Please select leave dates.'); return; }
    if (form.reason.trim().length < 3) { toast.error('Reason must be at least 3 characters.'); return; }
    if (!validation?.valid) { toast.error('Please fix leave validation errors before submitting.'); return; }
    if (validation?.overlap) { toast.error('Your selected dates overlap with an existing request.'); return; }

    const finalEndDate = form.endDate || form.startDate;
    const singleDay = finalEndDate === form.startDate;
    const session = form.halfDay && singleDay ? form.fromHalf : 'FULL';

    setSubmitting(true);
    try {
      const attachmentPath = await uploadAttachment();
      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'submit',
          employeeId,
          employeeName,
          dept: departmentId,
          leaveType: form.typeCode,
          employmentType: 'Permanent',
          startDate: form.startDate,
          endDate: finalEndDate,
          session,
          units: validation.units,
          reason: form.reason,
          attachment: attachmentPath,
          reportingOfficer,
          isManagerSubmittingOwnRequest: userRole?.toLowerCase() === 'hod' || userRole?.toLowerCase() === 'admin',
          fromHalf: form.halfDay ? form.fromHalf : undefined,
          toHalf: form.halfDay ? form.toHalf : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        const errorMsg = payload?.error || 'Failed to submit request';
        if (response.status === 500 && (errorMsg.toLowerCase().includes('pool timeout') || errorMsg.toLowerCase().includes('prisma') || errorMsg.toLowerCase().includes('connection'))) {
          toast.error('System connection timeout. Refreshing page to recover...');
          setTimeout(() => window.location.reload(), 1500);
          return;
        }
        throw new Error(errorMsg);
      }
      
      clearDraft();
      toast.success('Leave application submitted — awaiting manager approval');
      const reqId = payload?.request?.id as string | undefined;
      const yr = form.startDate ? Number(form.startDate.substring(0, 4)) : new Date().getFullYear();
      window.location.href = '/employee-portal/leave';
    } catch (error) {
      console.error('Submission error:', error);
      let message = 'Failed to submit request';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'object' && error !== null) {
        message = JSON.stringify(error);
      }
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Balance preview banner values
  const bp = validation?.balancePreview;
  const bannerStyle = bp ? getBalanceBannerStyle(bp.after, bp.minAllowed, bp.before) : null;

  return (
    <div className="rounded-xl p-5" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>New Leave Application</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Leave Type */}
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>
            Leave Type <span style={{ color: 'rgb(248 113 113)' }}>*</span>
          </label>
          <select
            value={form.typeCode}
            onChange={e => setForm(prev => ({ ...prev, typeCode: e.target.value as LeaveTypeCode }))}
            className="input-base text-sm cursor-pointer"
            disabled={leaveTypes.length === 0}
          >
            {leaveTypes.map(type => (
              <option key={`lt-${type.code}`} value={type.code}>
                {type.name} {loadingTypes ? '— (loading balance...)' : `— ${type.availableDays}d remaining`}
              </option>
            ))}
            {/* If Annual Leave has carry forward, the system already handles it, 
                but we can show it explicitly if requested. 
                However, most users just select 'Annual Leave'. */}
          </select>
          {leaveTypes.length === 0 && !loadingTypes && (
            <p className="text-xs mt-1" style={{ color: 'rgb(248 113 113)' }}>No eligible leave types available.</p>
          )}
        </div>

        {/* Start Date */}
        <div className="flex flex-col">
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>
            Start Date <span style={{ color: 'rgb(248 113 113)' }}>*</span>
          </label>
          <input
            type="date"
            value={form.startDate}
            onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
            min={minStartDate}
            className="input-base text-sm w-full cursor-pointer"
            onClick={(e) => (e.currentTarget as any).showPicker?.()}
            style={{ minHeight: '42px' }}
          />
        </div>

        {/* End Date */}
        <div className="flex flex-col">
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>
            End Date <span style={{ color: 'rgb(248 113 113)' }}>*</span>
          </label>
          <input
            type="date"
            value={form.endDate || form.startDate}
            onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
            min={form.startDate || minStartDate}
            className="input-base text-sm w-full cursor-pointer"
            onClick={(e) => (e.currentTarget as any).showPicker?.()}
            style={{ minHeight: '42px' }}
          />
        </div>

        {/* Half Day */}
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>Half Day?</label>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
              <input
                type="checkbox"
                checked={form.halfDay}
                onChange={e => setForm(prev => ({ ...prev, halfDay: e.target.checked }))}
              />
              Enable half-day
            </label>
            {form.halfDay && (
              isSingleDay ? (
                <select
                  className="input-base text-xs font-semibold px-2 py-1 cursor-pointer"
                  value={form.fromHalf}
                  onChange={e => {
                    const val = e.target.value as 'AM' | 'PM';
                    setForm(prev => ({ ...prev, fromHalf: val, toHalf: val }));
                  }}
                  style={{ minHeight: '34px', background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border-subtle))', color: 'rgb(var(--text-primary))' }}
                >
                  <option value="AM">Morning (AM)</option>
                  <option value="PM">Afternoon (PM)</option>
                </select>
              ) : (
                <div className="flex gap-3 items-center flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px]" style={{ color: 'rgb(var(--text-secondary))' }}>First Day:</span>
                    <select
                      className="input-base text-xs font-medium cursor-pointer"
                      value={form.fromHalf}
                      onChange={e => setForm(prev => ({ ...prev, fromHalf: e.target.value as 'AM' | 'PM' }))}
                      style={{ minHeight: '34px', background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border-subtle))', color: 'rgb(var(--text-primary))' }}
                    >
                      <option value="AM">Morning (AM)</option>
                      <option value="PM">Afternoon (PM)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px]" style={{ color: 'rgb(var(--text-secondary))' }}>Last Day:</span>
                    <select
                      className="input-base text-xs font-medium cursor-pointer"
                      value={form.toHalf}
                      onChange={e => setForm(prev => ({ ...prev, toHalf: e.target.value as 'AM' | 'PM' }))}
                      style={{ minHeight: '34px', background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border-subtle))', color: 'rgb(var(--text-primary))' }}
                    >
                      <option value="AM">Morning (AM)</option>
                      <option value="PM">Afternoon (PM)</option>
                    </select>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* ─── Kakitangan-style prominent balance preview ─── */}
      {validating ? (
        <div className="rounded-xl p-4 mb-4 animate-pulse" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border-subtle))' }}>
          <div className="w-48 h-4 rounded" style={{ background: 'rgb(var(--bg-surface))' }} />
        </div>
      ) : bp && bannerStyle && (
        <div className="rounded-xl p-4 mb-4" style={{ background: bannerStyle.bg, border: `1px solid ${bannerStyle.border}` }}>
          <div className="flex items-start gap-3">
            <span className="text-lg">{bannerStyle.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: bannerStyle.text }}>
                After this request, your <strong>{selectedLeaveType?.name || form.typeCode}</strong> balance will be{' '}
                <strong>{bp.after} days</strong>
                {bp.after < bp.minAllowed ? ' — exceeds minimum allowed!' : bp.after < 3 ? ' — running low' : ''}
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                Current: {bp.before} days → Using: {validation?.units} day(s) → Remaining: {bp.after} days
              </p>
              {/* Working days breakdown toggle */}
              {validation?.workingDates && validation.workingDates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowWorkingDays(prev => !prev)}
                  className="text-xs mt-2 underline"
                  style={{ color: 'rgb(var(--text-muted))' }}
                >
                  {showWorkingDays ? 'Hide' : 'Show'} {validation.workingDates.length} working day(s)
                </button>
              )}
              {showWorkingDays && validation?.workingDates && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {validation.workingDates.map(d => (
                    <span key={d} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgb(var(--bg-surface))', color: 'rgb(var(--text-secondary))' }}>{d}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legacy stats cards — compact row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg p-3" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border-subtle))' }}>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Deducted Days</p>
          <p className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{validation?.units ?? 0}</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border-subtle))' }}>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Balance Before</p>
          <p className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
            {bp?.before ?? selectedLeaveType?.availableDays ?? 0}
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border-subtle))' }}>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Balance After</p>
          <p className="text-lg font-semibold" style={{ color: (bp?.after ?? 0) < (bp?.minAllowed ?? 0) ? 'rgb(248 113 113)' : 'rgb(var(--text-primary))' }}>
            {bp?.after ?? 0}
          </p>
        </div>
      </div>

      {/* Validation Error Banner */}
      {validationError && (
        <div className="rounded-lg p-3 mb-3 flex items-start gap-2" style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.3)' }}>
          <span className="mt-0.5">⚠️</span>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'rgb(248 113 113)' }}>Validation Error</p>
            <p className="text-xs" style={{ color: 'rgb(248 113 113)' }}>{validationError}</p>
          </div>
        </div>
      )}

      {/* Overlap error */}
      {validation?.overlap && (
        <div className="rounded-lg p-3 mb-3 flex items-center gap-2" style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.3)' }}>
          <span>🔴</span>
          <p className="text-xs font-medium" style={{ color: 'rgb(248 113 113)' }}>
            Overlapping leave request detected for the selected date range. Please choose different dates.
          </p>
        </div>
      )}

      {/* Zero Days warning */}
      {validation && validation.units === 0 && !validationError && (
        <div className="rounded-lg p-3 mb-3 flex items-start gap-2" style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.3)' }}>
          <span className="mt-0.5">⚠️</span>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'rgb(251 191 36)' }}>No working days selected</p>
            <p className="text-xs" style={{ color: 'rgb(251 191 36)' }}>The selected date range contains only weekends or holidays. No leave days will be deducted.</p>
          </div>
        </div>
      )}

      {/* Warnings */}
      {validation?.warnings?.length ? (
        <div className="mb-3 space-y-1">
          {validation.warnings.map(warning => (
            <p key={warning} className="text-xs" style={{ color: 'rgb(251 191 36)' }}>⚠️ {warning}</p>
          ))}
        </div>
      ) : null}

      {/* Reason */}
      <div className="mb-4">
        <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>
          Reason <span style={{ color: 'rgb(248 113 113)' }}>*</span>
        </label>
        <textarea
          value={form.reason}
          onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))}
          rows={3}
          placeholder="Describe the reason for your leave request..."
          className="input-base text-sm resize-none"
        />
        <p className="text-xs mt-1" style={{ color: form.reason.trim().length >= 10 ? 'rgb(52 211 153)' : 'rgb(var(--text-muted))' }}>
          Minimum 10 characters ({form.reason.trim().length}/10)
        </p>
      </div>

      {/* Attachment */}
      <div className="mb-5">
        <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>
          Attachment (optional)
        </label>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={e => {
            const file = e.target.files?.[0] || null;
            if (file && file.size > 5 * 1024 * 1024) {
              toast.error('Attachment must be 5MB or less.');
              e.currentTarget.value = '';
              return;
            }
            setForm(prev => ({ ...prev, attachmentFile: file }));
          }}
          className="input-base text-sm"
        />
        <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>Supported: PDF, JPG, PNG (max 5MB)</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          id="leave-submit-btn"
          onClick={handleApply}
          disabled={!canSubmit}
          className={`flex items-center gap-2 min-w-[160px] justify-center px-6 py-2.5 rounded-lg font-bold transition-all duration-200 ${
            canSubmit 
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20' 
              : 'bg-slate-700/50 text-slate-400 cursor-not-allowed border border-white/5'
          }`}
        >
          {submitting || validating ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {submitting ? 'Submitting...' : 'Checking dates...'}
            </>
          ) : (
            <>
              {!canSubmit && !validating && !submitting && <Icon name="ExclamationCircleIcon" size={16} />}
              {canSubmit ? 'Submit Application' : 'Form Incomplete'}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => router.push('/employee-portal/leave')}
          disabled={submitting}
          className="btn-ghost"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}