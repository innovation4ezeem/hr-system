'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { buildClientAuthHeaders } from '@/lib/clientAuth';
import { useAppContext } from '@/context/AppContext';
import { toast } from 'sonner';

type RoleQuota = {
  role: string;
  annualLeaveRule: string;
  annualLeaveCap: number;
  medicalLeave: number;
  carryForwardCap: number;
  notes: string;
};

type LeaveRequest = {
  id: string;
  employeeId: string;
  employee: string;
  dept: string;
  type: 'AL' | 'MC' | 'WFH' | 'UNPAID' | 'REWARD' | 'CS';
  date: string;
  startDate: string;
  endDate: string;
  session: 'FULL' | 'AM' | 'PM';
  units: number;
  appliedAt: string;
  status: 'Applied' | 'Approved' | 'Rejected';
  attachment?: string;
  reason?: string;
};

type HistoryRow = {
  employee: string;
  year: number;
  alUsed: number;
  mcUsed: number;
  unpaidUsed: number;
  attendancePct: number;
};

type EmployeeLeaveProfile = {
  id: string;
  name: string;
  role: 'Intern' | 'Employee';
  serviceBand: '<2yr' | '>5yr' | 'Intern';
  dept: string;
  joinDate: string;
  reportTo: string;
  status: 'active' | 'inactive' | 'pending' | 'terminated';
  balances: {
    al: number;
    mc: number;
    reward: number;
    cs: number;
    wfh: number;
    unpaid: number;
    wfhUsed: number;
    maternity: number;
    paternity: number;
    replacement: number;
    additional: number;
    bereavement: number;
  };
  entitlements: {
    al: number;
    mc: number;
    reward: number;
    cs: number;
    wfh: number;
    unpaid: number;
    maternity: number;
    paternity: number;
    replacement: number;
    additional: number;
    bereavement: number;
  };
};

const initialRoleQuotas: RoleQuota[] = [];

const initialRequests: LeaveRequest[] = [];

const initialHistory: HistoryRow[] = [];

const initialProfiles: EmployeeLeaveProfile[] = [];

function inferServiceBand(role: string, joinDate: string | null | undefined) {
  const normalizedRole = String(role || '').toLowerCase();
  if (normalizedRole === 'intern') return 'Intern' as const;

  if (!joinDate) return '<2yr' as const;

  const start = new Date(joinDate);
  if (Number.isNaN(start.getTime())) return '<2yr' as const;

  const years = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (years <= 2) return '<2yr' as const;
  if (years > 5) return '>5yr' as const;
  return '<2yr' as const;
}

function mapDbRequestStatus(status: string): LeaveRequest['status'] {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved' || normalized === 'history-archived') return 'Approved';
  if (normalized === 'rejected' || normalized === 'cancelled') return 'Rejected';
  return 'Applied';
}

function buildHistoryRows(requests: LeaveRequest[]): HistoryRow[] {
  const rows = new Map<string, HistoryRow>();

  for (const request of requests) {
    if (request.status !== 'Approved') continue;

    const year = Number(request.date.substring(0, 4)) || new Date().getFullYear();
    const key = `${request.employee}|${year}`;
    const existing = rows.get(key) ?? {
      employee: request.employee,
      year,
      alUsed: 0,
      mcUsed: 0,
      unpaidUsed: 0,
      attendancePct: 100,
    };

    const units = Number(request.units || 0);
    if (request.type === 'AL') existing.alUsed += units;
    else if (request.type === 'MC') existing.mcUsed += units;
    else if (request.type === 'UNPAID') existing.unpaidUsed += units;

    rows.set(key, existing);
  }

  return Array.from(rows.values()).map((row) => ({
    ...row,
    attendancePct: Math.max(0, 100 - Math.round(row.unpaidUsed * 10)),
  }));
}

function buildProfileFromDb(user: {
  id: string;
  name: string;
  role: string;
  dept: string;
  status: string;
  joinDate: string | null;
}, balances: Array<{ leaveTypeCode: string; availableDays?: number; usedDays?: number; openingDays?: number }>, wfhMonthlyCap: number): EmployeeLeaveProfile {
  const balanceMap = new Map(balances.map((balance) => [balance.leaveTypeCode, balance]));
  const alBalance = balanceMap.get('AL');
  const mcBalance = balanceMap.get('MC');
  const rewardBalance = balanceMap.get('REWARD');
  const csBalance = balanceMap.get('CS');
  const unpaidBalance = balanceMap.get('UNPAID');
  const wfhBalance = balanceMap.get('WFH');

  return {
    id: user.id,
    name: user.name,
    role: user.role === 'intern' ? 'Intern' : 'Employee',
    serviceBand: inferServiceBand(user.role, user.joinDate),
    dept: user.dept,
    status: (user.status || 'active') as any,
    joinDate: user.joinDate || '',
    reportTo: 'Database-backed',
    balances: {
      al: Number(alBalance?.availableDays ?? 0),
      mc: Number(mcBalance?.availableDays ?? 0),
      reward: Number(rewardBalance?.availableDays ?? 0),
      cs: Number(csBalance?.availableDays ?? 0),
      unpaid: Number(unpaidBalance?.availableDays ?? 0),
      wfh: Number(wfhBalance?.availableDays ?? wfhMonthlyCap),
      wfhUsed: Number(wfhBalance?.usedDays ?? 0),
      maternity: Number(balanceMap.get('MATERNITY')?.availableDays ?? 0),
      paternity: Number(balanceMap.get('PATERNITY')?.availableDays ?? 0),
      replacement: Number(balanceMap.get('REPLACEMENT')?.availableDays ?? 0),
      additional: Number(balanceMap.get('ADDITIONAL')?.availableDays ?? 0),
      bereavement: Number(balanceMap.get('BEREAVEMENT')?.availableDays ?? 0),
    },
    entitlements: {
      al: Number(alBalance?.openingDays ?? 0),
      mc: Number(mcBalance?.openingDays ?? 0),
      reward: Number(rewardBalance?.openingDays ?? 0),
      cs: Number(csBalance?.openingDays ?? 0),
      unpaid: Number(unpaidBalance?.openingDays ?? 0),
      wfh: Number(wfhBalance?.openingDays ?? wfhMonthlyCap),
      maternity: Number(balanceMap.get('MATERNITY')?.openingDays ?? 0),
      paternity: Number(balanceMap.get('PATERNITY')?.openingDays ?? 0),
      replacement: Number(balanceMap.get('REPLACEMENT')?.openingDays ?? 0),
      additional: Number(balanceMap.get('ADDITIONAL')?.openingDays ?? 0),
      bereavement: Number(balanceMap.get('BEREAVEMENT')?.openingDays ?? 0),
    },
  };
}

export default function LeaveControlRoom() {
  const { userRole, userId, userName, userDepartment, silentMode } = useAppContext();
  const authHeaders = useMemo(() => buildClientAuthHeaders({
    role: userRole as any,
    userId,
    userName,
    department: userDepartment,
    silentMode
  }), [userRole, userId, userName, userDepartment, silentMode]);
  const [roleQuotas, setRoleQuotas] = useState<RoleQuota[]>(initialRoleQuotas);
  const [manualEmployee, setManualEmployee] = useState('');
  const [manualType, setManualType] = useState<string>('AL');
  const [manualDelta, setManualDelta] = useState(1);
  const [manualReason, setManualReason] = useState('');

  const [activeHeaderSection, setActiveHeaderSection] = useState('ledger');

  const [wfhMonthlyCap, setWfhMonthlyCap] = useState(4);
  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests);
  const [histories, setHistories] = useState<HistoryRow[]>(initialHistory);
  const [profiles, setProfiles] = useState<EmployeeLeaveProfile[]>(initialProfiles);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedOverrideIds, setSelectedOverrideIds] = useState<Set<string>>(new Set());
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  const [loadingState, setLoadingState] = useState(true);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEmployeeDropdownOpen(false);
      }
    };

    if (isEmployeeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEmployeeDropdownOpen]);

  // Filters
  const [filterYear, setFilterYear] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const reportYear = now.getFullYear();

  const sectionHeaderItems = [

    { id: 'ledger', label: 'View All Person' },
    { id: 'pending-queue', label: 'Pending Queue' },
    { id: 'leave-history', label: 'Leave History' },
    { id: 'quota', label: 'Quota Management' },
  ];

  const pendingQueue = useMemo(() => requests.filter(r => r.status === 'Applied'), [requests]);
  const approvedQueueCount = useMemo(() => requests.filter(r => r.status === 'Approved').length, [requests]);
  const rejectedQueueCount = useMemo(() => requests.filter(r => r.status === 'Rejected').length, [requests]);
  const uniqueDepartments = useMemo(() => {
    return new Set(profiles.map(profile => profile.dept).filter(Boolean)).size;
  }, [profiles]);

  const staleCount = useMemo(() => {
    return pendingQueue.filter(r => {
      const diffMs = now.getTime() - new Date(r.appliedAt).getTime();
      return diffMs > 48 * 60 * 60 * 1000;
    }).length;
  }, [pendingQueue]);

  const quarterAttendanceAchievements = useMemo(() => {
    return histories.filter(h => h.attendancePct === 100 && h.mcUsed === 0 && h.unpaidUsed === 0);
  }, [histories]);

  const selectedProfile = useMemo(
    () => profiles.find(p => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const matchesSearch = !globalSearch ||
        p.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
        p.id.toLowerCase().includes(globalSearch.toLowerCase()) ||
        p.dept.toLowerCase().includes(globalSearch.toLowerCase());

      const isInactive = p.status === 'inactive' || p.status === 'terminated';
      if (showInactive) {
        if (!isInactive) return false;
      } else {
        if (isInactive) return false;
      }

      return matchesSearch;
    });
  }, [profiles, globalSearch, showInactive]);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const profile = profiles.find(p => p.id === r.employeeId);
      const isInactive = profile ? (profile.status === 'inactive' || profile.status === 'terminated') : false;

      if (showInactive) {
        if (!isInactive) return false;
      } else {
        if (isInactive) return false;
      }

      const matchesSearch = !globalSearch ||
        r.employee.toLowerCase().includes(globalSearch.toLowerCase()) ||
        r.employeeId.toLowerCase().includes(globalSearch.toLowerCase()) ||
        r.dept.toLowerCase().includes(globalSearch.toLowerCase());

      const requestYear = new Date(r.date).getFullYear().toString();
      const matchesYear = filterYear === 'All' || requestYear === filterYear;

      const matchesStatus = filterStatus === 'All' ||
        (filterStatus === 'Pending' ? r.status === 'Applied' : r.status === filterStatus);

      const requestDate = new Date(r.date);
      const matchesFrom = !filterDateFrom || requestDate >= new Date(filterDateFrom);
      const matchesTo = !filterDateTo || requestDate <= new Date(filterDateTo);

      return matchesSearch && matchesYear && matchesStatus && matchesFrom && matchesTo;
    });
  }, [requests, globalSearch, filterYear, filterStatus, filterDateFrom, filterDateTo, showInactive, profiles]);

  const applyManualOverride = async () => {
    const targetIds = selectedOverrideIds.size > 0
      ? Array.from(selectedOverrideIds)
      : [profiles.find(p => p.name === manualEmployee)?.id].filter(Boolean) as string[];

    if (targetIds.length === 0) {
      toast.error('Select at least one employee');
      return;
    }

    const balanceKey =
      manualType === 'WFH' ? 'wfh' :
        manualType === 'MC' || manualType === 'SL' ? 'mc' :
          manualType === 'REWARD' ? 'reward' :
            manualType === 'CS' ? 'cs' :
              manualType === 'UNPAID' ? 'unpaid' :
                manualType === 'MATERNITY' ? 'maternity' :
                  manualType === 'PATERNITY' ? 'paternity' :
                    manualType === 'REPLACEMENT' ? 'replacement' :
                      manualType === 'ADDITIONAL' ? 'additional' :
                        manualType === 'BEREAVEMENT' ? 'bereavement' :
                          'al';

    try {
      const year = new Date().getFullYear();
      const batchPayload = targetIds.map(id => {
        const target = profiles.find(p => p.id === id);
        if (!target) return null;

        // Base calculation on ENTITLEMENT, not balance
        const newEntitlement = Math.max(0, Number(manualDelta.toFixed(2)));

        return {
          employeeId: id,
          leaveTypeCode: manualType,
          year,
          overrideDays: newEntitlement,
          overrideReason: manualReason || `Manual Admin Override (Set to ${newEntitlement} days)`,
          overriddenBy: userId || userRole,
        };
      }).filter(Boolean);

      if (batchPayload.length === 0) return;

      setSaveState('saving');
      const response = await fetch('/api/leave-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'batch-upsert-entitlement-overrides',
          payload: batchPayload,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to apply overrides');
      }

      toast.success(`Successfully applied override to ${batchPayload.length} employee(s)`);

      // Reset form
      setManualDelta(1);
      setManualReason('');
      setSelectedOverrideIds(new Set());
      setManualEmployee('');

      // Refresh state to show new balances
      // A full refresh is safer here to ensure all derived values are correct
      setLoadingState(true);
      setRefreshKey(prev => prev + 1);
      setSaveState('idle');
    } catch (error) {
      setSaveState('error');
      toast.error(error instanceof Error ? error.message : 'Manual override failed');
    }
  };

  const approveRequest = async (id: string) => {
    try {
      setSaveState('saving');
      const response = await fetch(`/api/leave-requests/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action: 'approve', actor: userId || userRole }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Approval failed');
      }

      setRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'Approved' } : r)));
      toast.success('Leave request approved');
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      toast.error(error instanceof Error ? error.message : 'Approval failed');
    }
  };

  const rejectRequest = async (id: string) => {
    const reason = window.prompt('Reason for rejection:', 'Does not meet requirements');
    if (reason === null) return;

    try {
      setSaveState('saving');
      const response = await fetch(`/api/leave-requests/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action: 'reject', actor: userId || userRole, reason }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Rejection failed');
      }

      setRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'Rejected' } : r)));
      toast.success('Leave request rejected');
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      toast.error(error instanceof Error ? error.message : 'Rejection failed');
    }
  };

  const updateBalance = (id: string, field: keyof EmployeeLeaveProfile['balances'], value: number) => {
    setProfiles(prev => prev.map(p => (p.id === id ? { ...p, balances: { ...p.balances, [field]: value } } : p)));
  };

  const saveProfileEdit = async (id: string) => {
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;

    try {
      const year = reportYear;
      const fieldMap: Record<string, string> = {
        al: 'AL',
        mc: 'MC',
        reward: 'REWARD',
        cs: 'CS',
        wfh: 'WFH',
        unpaid: 'UNPAID',
        maternity: 'MATERNITY',
        paternity: 'PATERNITY',
        replacement: 'REPLACEMENT',
        additional: 'ADDITIONAL',
        bereavement: 'BEREAVEMENT'
      };

      setSaveState('saving');

      const payload = Object.entries(fieldMap).map(([field, code]) => ({
        employeeId: id,
        leaveTypeCode: code,
        year,
        overrideDays: Number(profile.balances[field as keyof typeof profile.balances]),
        overrideReason: 'Manual Admin Adjustment',
        overriddenBy: userId || userRole,
      }));

      const response = await fetch('/api/leave-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'batch-upsert-entitlement-overrides',
          payload,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || response.statusText);
      }

      setEditingProfileId(null);
      setSaveState('saved');
      toast.success(`Manual leave balances saved for ${profile.name}`);
    } catch (error) {
      setSaveState('error');
      toast.error(error instanceof Error ? error.message : 'Failed to save manual adjustments');
    }
  };

  const jumpToSection = (id: string) => {
    setActiveHeaderSection(id);
    const el = document.getElementById(`leave-sec-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadState = async () => {
      setLoadingState(true);
      try {
        const year = reportYear;
        const [usersResponse, requestsResponse, balancesResponse, settingsRes, yearsRes] = await Promise.all([
          fetch('/api/users', { headers: authHeaders }),
          fetch(`/api/leave-requests?mode=team-history&year=${year}&status=all`, { headers: authHeaders }),
          fetch(`/api/leave-management?mode=batch-balances&year=${year}`, { headers: authHeaders }),
          fetch('/api/system-settings', { headers: authHeaders }),
          fetch('/api/archive-records?mode=years', { headers: authHeaders }),
        ]);

        if (!usersResponse.ok) throw new Error('Failed to load users');
        if (!requestsResponse.ok) throw new Error('Failed to load leave requests');
        if (!balancesResponse.ok) throw new Error('Failed to load leave balances');

        const usersPayload = await usersResponse.json();
        const requestsPayload = await requestsResponse.json();
        const balancesPayload = await balancesResponse.json();
        const settingsPayload = settingsRes.ok ? await settingsRes.json() : null;
        const yearsPayload = yearsRes.ok ? await yearsRes.json() : { years: [new Date().getFullYear()] };

        if (yearsPayload?.years) {
          setAvailableYears(yearsPayload.years);
        }

        if (settingsPayload?.settings?.leavePolicy?.wfhMonthlyCapDays !== undefined) {
          setWfhMonthlyCap(settingsPayload.settings.leavePolicy.wfhMonthlyCapDays);
        }

        const allBalancesMap = balancesPayload?.balances || {};

        const adminUserIds = new Set(
          (Array.isArray(usersPayload?.users) ? usersPayload.users : [])
            .filter((u: any) => u.role === 'admin')
            .map((u: any) => String(u.id))
        );

        const liveRequests = (Array.isArray(requestsPayload?.requests) ? requestsPayload.requests : [])
          .filter((request: any) => !adminUserIds.has(String(request.employee_id || request.employeeId || '')))
          .map((request: any): LeaveRequest => ({
            id: String(request.id || ''),
            employeeId: String(request.employeeId || request.employee_id || ''),
            employee: String(request.employeeName || request.employee_name || request.employee || ''),
            dept: String(request.dept || ''),
            type: String(request.leaveType || request.leave_type || 'AL') as LeaveRequest['type'],
            date: String(request.startDate || request.start_date || request.requestedAt || request.requested_at || ''),
            startDate: String(request.startDate || request.start_date || ''),
            endDate: String(request.endDate || request.end_date || ''),
            session: String(request.session || 'FULL') as LeaveRequest['session'],
            units: Number(request.units || 0),
            appliedAt: String(request.requestedAt || request.requested_at || request.appliedAt || request.applied_at || ''),
            status: mapDbRequestStatus(String(request.status || 'pending')),
            attachment: request.attachment ? String(request.attachment) : undefined,
            reason: request.reason ? String(request.reason) : undefined,
          }));

        const liveProfiles = (Array.isArray(usersPayload?.users) ? usersPayload.users : [])
          .filter((user: any) => Boolean(user?.id) && user.role !== 'admin')
          .map((user: any) => {
            const userBalances = allBalancesMap[user.id] || [];
            const al = userBalances.find((b: any) => b.leaveTypeCode === 'AL');
            const sl = userBalances.find((b: any) => b.leaveTypeCode === 'SL' || b.leaveTypeCode === 'MC');
            const wfh = userBalances.find((b: any) => b.leaveTypeCode === 'WFH');
            const reward = userBalances.find((b: any) => b.leaveTypeCode === 'REWARD');
            const cs = userBalances.find((b: any) => b.leaveTypeCode === 'CS');
            const unpaid = userBalances.find((b: any) => b.leaveTypeCode === 'UNPAID');

            return {
              id: String(user.id),
              name: String(user.name || 'Unknown'),
              dept: String(user.dept || 'Operations'),
              role: (user.role === 'intern' ? 'Intern' : 'Employee') as 'Intern' | 'Employee',
              status: (user.status || 'active') as any,
              joinDate: user.joinDate || user.join_date || new Date().toISOString(),
              serviceBand: inferServiceBand(user.role || 'employee', user.joinDate || user.join_date),
              reportTo: 'Database-backed',
              balances: {
                al: al?.availableDays || 0,
                mc: sl?.availableDays || 0,
                wfh: wfh?.availableDays || 0,
                reward: reward?.availableDays || 0,
                cs: cs?.availableDays || 0,
                unpaid: unpaid?.availableDays || 0,
                wfhUsed: wfh?.usedDays || 0,
                maternity: userBalances.find((b: any) => b.leaveTypeCode === 'MATERNITY')?.availableDays || 0,
                paternity: userBalances.find((b: any) => b.leaveTypeCode === 'PATERNITY')?.availableDays || 0,
                replacement: userBalances.find((b: any) => b.leaveTypeCode === 'REPLACEMENT')?.availableDays || 0,
                additional: userBalances.find((b: any) => b.leaveTypeCode === 'ADDITIONAL')?.availableDays || 0,
                bereavement: userBalances.find((b: any) => b.leaveTypeCode === 'BEREAVEMENT')?.availableDays || 0,
              },
              entitlements: {
                al: al?.openingDays || 0,
                mc: sl?.openingDays || 0,
                wfh: wfh?.openingDays || 0,
                reward: reward?.openingDays || 0,
                cs: cs?.openingDays || 0,
                unpaid: unpaid?.openingDays || 0,
                maternity: userBalances.find((b: any) => b.leaveTypeCode === 'MATERNITY')?.openingDays || 0,
                paternity: userBalances.find((b: any) => b.leaveTypeCode === 'PATERNITY')?.openingDays || 0,
                replacement: userBalances.find((b: any) => b.leaveTypeCode === 'REPLACEMENT')?.openingDays || 0,
                additional: userBalances.find((b: any) => b.leaveTypeCode === 'ADDITIONAL')?.openingDays || 0,
                bereavement: userBalances.find((b: any) => b.leaveTypeCode === 'BEREAVEMENT')?.openingDays || 0,
              },
            } as EmployeeLeaveProfile;
          });

        if (cancelled) return;

        setRequests(liveRequests);
        setProfiles(liveProfiles);

        if (liveProfiles.length > 0) {
          setSelectedProfileId((current) => (
            current && liveProfiles.some(profile => profile.id === current)
              ? current
              : liveProfiles[0].id
          ));
          setHistories(buildHistoryRows(liveRequests));
        }

        setSaveState('saved');
      } catch (error) {
        console.error('[LeaveControlRoom] Load error:', error);
        if (!cancelled) {
          toast.error('Load leave records failed');
        }
      } finally {
        if (!cancelled) {
          hydratedRef.current = true;
          setLoadingState(false);
        }
      }
    };

    void loadState();
    return () => {
      cancelled = true;
    };
  }, [authHeaders, reportYear, wfhMonthlyCap, refreshKey]);

  if (loadingState) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats & Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-lg p-4" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs" style={{ color: 'rgb(251 191 36)' }}>Total Pending Requests</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'rgb(251 191 36)' }}>
                {pendingQueue.length}
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                {staleCount} are stale ({'>'}48h)
              </p>
            </div>
            <Icon name="ClockIcon" size={20} style={{ color: 'rgb(251 191 36)' }} />
          </div>
        </div>

        <div className="rounded-lg p-4" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs" style={{ color: 'rgb(52 211 153)' }}>Perfect Attendance</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'rgb(52 211 153)' }}>
                {quarterAttendanceAchievements.length}
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                Employees flagged
              </p>
            </div>
            <Icon name="SparklesIcon" size={20} style={{ color: 'rgb(52 211 153)' }} />
          </div>
        </div>

        <div className="rounded-lg p-4" style={{ background: 'rgba(79,127,255,0.08)', border: '1px solid rgba(79,127,255,0.3)' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs" style={{ color: 'rgb(79 127 255)' }}>Profiles Tracked</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'rgb(79 127 255)' }}>
                {profiles.length}
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                Active employees
              </p>
            </div>
            <Icon name="UsersIcon" size={20} style={{ color: 'rgb(79 127 255)' }} />
          </div>
        </div>

        <div className="rounded-lg p-4" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs" style={{ color: 'rgb(251 191 36)' }}>System Status</p>
              <p className="text-lg font-bold mt-1 flex items-center gap-1" style={{ color: 'rgb(251 191 36)' }}>
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                {loadingState ? 'Loading...' : saveState === 'saving' ? 'Refreshing' : saveState === 'saved' ? 'Live' : 'Ready'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                Database sync {saveState === 'saving' ? 'in progress' : saveState === 'saved' ? 'ready' : 'enabled'}
              </p>
            </div>
            <Icon name={saveState === 'saved' ? 'CheckIcon' : 'ClockIcon'} size={20} style={{ color: 'rgb(251 191 36)' }} />
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Leave Management</h2>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowSyncConfirm(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"
              disabled={saveState === 'saving'}
            >
              {saveState === 'saving' ? (
                <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
              ) : (
                <Icon name="ArrowPathIcon" size={12} />
              )}
              {saveState === 'saving' ? 'Syncing...' : 'Sync All Balances'}
            </button>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-ghost flex items-center gap-2 text-xs"
            style={{ color: showFilters ? 'rgb(79 127 255)' : 'rgb(var(--text-secondary))' }}
          >
            <Icon name="FunnelIcon" size={14} />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'rgb(var(--text-muted))' }}>Year</label>
                <select className="input-base text-xs w-full" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                  <option value="All">All Years</option>
                  {availableYears.map(y => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'rgb(var(--text-muted))' }}>Status</label>
                <select className="input-base text-xs w-full" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="All">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'rgb(var(--text-muted))' }}>Date From</label>
                <input type="date" className="input-base text-xs w-full cursor-pointer" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} onClick={(e) => (e.currentTarget as any).showPicker?.()} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'rgb(var(--text-muted))' }}>Date To</label>
                <input type="date" className="input-base text-xs w-full cursor-pointer" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} onClick={(e) => (e.currentTarget as any).showPicker?.()} />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'rgb(var(--text-muted))' }}>Search</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input-base text-xs w-full"
                    placeholder="Emp"
                    value={globalSearch}
                    onChange={e => setGlobalSearch(e.target.value)}
                  />
                  <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer hover:bg-white/5 transition-all whitespace-nowrap"
                    style={{ borderColor: showInactive ? 'rgb(var(--text-primary))' : 'rgb(var(--border-subtle))' }}>
                    <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: showInactive ? 'rgb(var(--text-primary))' : 'rgb(var(--text-muted))' }}>Show Inactive</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto mt-4">
          <div className="inline-flex items-center gap-1 rounded-lg p-1 bg-opacity-50" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border-subtle))' }}>
            {sectionHeaderItems.map(item => (
              <button
                key={item.id}
                onClick={() => jumpToSection(item.id)}
                className="px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-all font-medium"
                style={{
                  background: activeHeaderSection === item.id ? 'rgba(79,127,255,0.16)' : 'transparent',
                  color: activeHeaderSection === item.id ? 'rgb(79 127 255)' : 'rgb(var(--text-secondary))',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section id="leave-sec-ledger" className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>View All Employee </h4>
        <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid rgb(var(--border-subtle))' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgb(var(--bg-elevated))' }}>
                {['Person', 'AL', 'MC', 'REWARD', 'REPLACE', 'WFH', 'CS', 'UNPAID', 'MATER', 'PATER', 'ADDIT', 'BEREAV', 'WFH Used', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs whitespace-nowrap" style={{ color: 'rgb(var(--text-muted))' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map(p => {
                const editing = editingProfileId === p.id;
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid rgb(var(--border))' }}>
                    <td className="px-3 py-2">
                      <p style={{ color: 'rgb(var(--text-primary))' }}>{decodeURIComponent(p.name)}</p>
                      <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{p.id} • {p.dept}</p>
                    </td>
                    {(['al', 'mc', 'reward', 'replacement', 'wfh', 'cs', 'unpaid', 'maternity', 'paternity', 'additional', 'bereavement', 'wfhUsed'] as Array<keyof EmployeeLeaveProfile['balances']>).map(field => (
                      <td key={`${p.id}-${field}`} className="px-3 py-2 text-center">
                        {editing ? (
                          <input
                            type="number"
                            value={p.balances[field]}
                            onChange={e => updateBalance(p.id, field, Number(e.target.value))}
                            className="input-base text-xs"
                            style={{ padding: '4px 8px', width: 60 }}
                          />
                        ) : (
                          <span style={{ color: 'rgb(var(--text-secondary))' }}>{p.balances[field]}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {editing ? (
                          <button
                            className="btn-primary flex items-center gap-2"
                            onClick={() => saveProfileEdit(p.id)}
                            disabled={saveState === 'saving'}
                          >
                            {saveState === 'saving' ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                                Saving...
                              </>
                            ) : 'Save'}
                          </button>
                        ) : (
                           <button 
                             className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" 
                             onClick={() => setEditingProfileId(p.id)}
                           >
                             Edit
                           </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section id="leave-sec-pending-queue" className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>Pending Queue & Visibility</h4>
        <p className="text-xs mb-3" style={{ color: 'rgb(var(--text-secondary))' }}>
          Request snapshot: {pendingQueue.length} pending, {approvedQueueCount} approved, {rejectedQueueCount} rejected.
        </p>

        <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid rgb(var(--border-subtle))' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgb(var(--bg-elevated))' }}>
                {['ID', 'Employee', 'Type', 'Date', 'Half-Day', 'Reason', 'Attachment', 'Pending', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRequests.filter(r => r.status === 'Applied').map(r => {
                const hoursPending = Math.floor((now.getTime() - new Date(r.appliedAt).getTime()) / (1000 * 60 * 60));
                const stale = hoursPending > 48;
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid rgb(var(--border))' }}>
                    <td className="px-3 py-2" style={{ color: 'rgb(var(--text-secondary))' }}>{r.id}</td>
                    <td className="px-3 py-2" style={{ color: 'rgb(var(--text-primary))' }}>{decodeURIComponent(r.employee)}</td>
                    <td className="px-3 py-2" style={{ color: 'rgb(var(--text-secondary))' }}>{r.type}</td>
                    <td className="px-3 py-2" style={{ color: 'rgb(var(--text-secondary))' }}>{r.date}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: r.session === 'FULL' ? 'rgba(79,127,255,0.15)' : 'linear-gradient(90deg, rgba(52,211,153,0.2) 50%, rgba(251,191,36,0.2) 50%)', color: 'rgb(var(--text-secondary))' }}>
                        {r.session} ({r.units})
                      </span>
                    </td>
                    <td className="px-3 py-2" style={{ color: 'rgb(var(--text-secondary))', maxWidth: '220px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {r.reason || <span className="text-xs italic" style={{ color: 'rgb(var(--text-muted))' }}>No reason provided</span>}
                    </td>
                    <td className="px-3 py-2">
                      {r.attachment ? (
                        <button 
                          className="px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold uppercase tracking-wider hover:bg-blue-500/20 transition-all" 
                          onClick={() => toast.success(`Opening ${r.attachment}`)}
                        >
                          View MC
                        </button>
                      ) : (
                        <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs" style={{ color: stale ? 'rgb(248 113 113)' : 'rgb(var(--text-secondary))' }}>
                        {hoursPending}h {stale ? '(>48h)' : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button 
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/10" 
                          onClick={() => approveRequest(r.id)}
                        >
                          Approve
                        </button>
                        <button 
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-600/10" 
                          onClick={() => rejectRequest(r.id)}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section id="leave-sec-leave-history" className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h4 className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
            Leave History & Records
          </h4>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search name, type or status..."
                className="input-base text-xs pl-8 w-48 md:w-64"
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
              />
            </div>
            {historySearchTerm && (
              <button
                onClick={() => setHistorySearchTerm('')}
                className="btn-ghost text-[10px] py-1 px-2 flex items-center gap-1"
              >
                <Icon name="XMarkIcon" size={12} />
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg overflow-hidden border border-border-subtle">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-white/[0.02]" style={{ borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                  <th className="px-4 py-2 font-semibold">Employee</th>
                  <th className="px-4 py-2 font-semibold">Type</th>
                  <th className="px-4 py-2 font-semibold">Date Range</th>
                  <th className="px-4 py-2 font-semibold">Units</th>
                  <th className="px-4 py-2 font-semibold">Reason</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredRequests
                  .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
                  .map(r => (
                    <tr key={r.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="px-4 py-2 font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                        {decodeURIComponent(r.employee)}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.type === 'AL' ? 'bg-blue-500/10 text-blue-400' :
                          r.type === 'MC' ? 'bg-red-500/10 text-red-400' :
                            'bg-amber-500/10 text-amber-400'
                          }`}>
                          {r.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(r.startDate).toLocaleDateString('en-GB')} - {new Date(r.endDate).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-2 font-medium">{r.units}</td>
                      <td className="px-4 py-2 text-muted-foreground" style={{ maxWidth: '220px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {r.reason || <span className="text-xs italic opacity-50">-</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`flex items-center gap-1 ${r.status === 'Approved' ? 'text-emerald-400' :
                          r.status === 'Rejected' ? 'text-red-400' :
                            'text-amber-400'
                          }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                {requests.filter(r => {
                  if (!historySearchTerm) return true;
                  const term = historySearchTerm.toLowerCase();
                  return (
                    r.employee.toLowerCase().includes(term) ||
                    r.type.toLowerCase().includes(term) ||
                    r.status.toLowerCase().includes(term)
                  );
                }).length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground italic">
                          <Icon name="DocumentMagnifyingGlassIcon" size={24} className="opacity-20" />
                          <p>No leave records found{historySearchTerm ? ` for "${historySearchTerm}"` : ''} in {reportYear}.</p>
                        </div>
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="leave-sec-quota" className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>Quota Management</h4>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div className="rounded-lg p-3" style={{ background: 'rgba(79,127,255,0.08)', border: '1px solid rgba(79,127,255,0.2)' }}>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-semibold" style={{ color: 'rgb(79 127 255)' }}>Manual Quota Override</p>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  className="btn-ghost text-[10px] py-1 px-2 border border-blue-500/30 hover:bg-blue-500/10"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowSyncConfirm(true);
                  }}
                  disabled={saveState === 'saving'}
                >
                  <Icon name="ArrowPathIcon" size={12} className="mr-1" />
                  Sync All Balances
                </button>
                <button 
                  type="button"
                  className="btn-ghost text-[10px] py-1 px-2 border border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={async (e) => {
                    e.preventDefault();
                    setShowResetConfirm(true);
                  }}
                  disabled={saveState === 'saving'}
                >
                  <Icon name="TrashIcon" size={12} className="mr-1" />
                  Reset All to Defaults
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div className="space-y-1 relative" ref={dropdownRef}>
                <label className="text-[10px] text-muted-foreground">Select Employee(s)</label>
                <div
                  className="input-base text-xs w-full flex items-center justify-between cursor-pointer py-2"
                  onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                >
                  <span className="truncate">
                    {selectedOverrideIds.size === 0 ? '-- Choose Employee(s) --' :
                      selectedOverrideIds.size === 1 ? profiles.find(p => selectedOverrideIds.has(p.id))?.name :
                        `${selectedOverrideIds.size} Employees Selected`}
                  </span>
                  <Icon name="ChevronDownIcon" size={14} className={`transition-transform ${isEmployeeDropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {isEmployeeDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#1a1c23] border border-white/10 rounded-lg shadow-xl p-2 animate-in fade-in zoom-in duration-100">
                    <div className="relative mb-2">
                      <Icon name="MagnifyingGlassIcon" size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search..."
                        className="w-full bg-white/5 border border-white/10 rounded px-7 py-1 text-[10px] outline-none focus:border-blue-500/50"
                        value={employeeSearchTerm}
                        onChange={e => setEmployeeSearchTerm(e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
                      <label className="flex items-center gap-2 py-1 px-2 hover:bg-white/5 rounded cursor-pointer transition-colors text-[10px] border-b border-white/5 mb-1" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-white/20 bg-transparent text-blue-500 focus:ring-0"
                          checked={selectedOverrideIds.size === profiles.length && profiles.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedOverrideIds(new Set(profiles.map(p => p.id)));
                            else setSelectedOverrideIds(new Set());
                          }}
                        />
                        <span className="font-semibold text-blue-400">Select All</span>
                      </label>
                      {profiles
                        .filter(p => !employeeSearchTerm || p.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) || p.dept.toLowerCase().includes(employeeSearchTerm.toLowerCase()))
                        .map(p => (
                          <label key={p.id} className="flex items-center gap-2 py-1 px-2 hover:bg-white/5 rounded cursor-pointer transition-colors" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded border-white/20 bg-transparent text-blue-500 focus:ring-0"
                              checked={selectedOverrideIds.has(p.id)}
                              onChange={(e) => {
                                const next = new Set(selectedOverrideIds);
                                if (e.target.checked) next.add(p.id);
                                else next.delete(p.id);
                                setSelectedOverrideIds(next);
                              }}
                            />
                            <span className="text-[10px] truncate">{p.name} <span className="text-muted-foreground opacity-50 ml-1">[{p.dept}]</span></span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Adjustment Type</label>
                <select className="input-base text-xs w-full" value={manualType} onChange={e => setManualType(e.target.value as any)}>
                  <option value="AL">Annual Leave (AL)</option>
                  <option value="MC">Medical Leave (MC)</option>
                  <option value="WFH">Work From Home (WFH)</option>
                  <option value="REWARD">Reward Leave</option>
                  <option value="REPLACEMENT">Replacement Leave</option>
                  <option value="CS">Compassionate Leave</option>
                  <option value="MATERNITY">Maternity Leave</option>
                  <option value="PATERNITY">Paternity Leave</option>
                  <option value="ADDITIONAL">Additional Leave</option>
                  <option value="BEREAVEMENT">Bereavement Leave</option>
                  <option value="UNPAID">Leave w/o Pay</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">New Total Days</label>
                <input className="input-base text-xs w-full" type="number" value={manualDelta} onChange={e => setManualDelta(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Reference Reason</label>
                <input className="input-base text-xs w-full" value={manualReason} onChange={e => setManualReason(e.target.value)} placeholder="Reason for change" />
              </div>
            </div>

            <button
              className="btn-primary mt-1 w-full flex items-center justify-center gap-2"
              onClick={() => {
                applyManualOverride();
                setIsEmployeeDropdownOpen(false);
              }}
              disabled={selectedOverrideIds.size === 0 || saveState === 'saving'}
            >
              {saveState === 'saving' && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
              {saveState === 'saving' 
                ? 'Applying...' 
                : selectedOverrideIds.size > 1 ? `Apply to ${selectedOverrideIds.size} Employees` : 'Apply Override'}
            </button>
          </div>
        </div>
      </section>
      <ConfirmModal
        open={showSyncConfirm}
        title="Sync All Employee Balances"
        message="Are you sure you want to re-calculate and sync leave balances for ALL active employees? Manual overrides for the current year will be preserved but system-calculated bases will be refreshed. This may take a few moments."
        confirmLabel="Start Sync"
        variant="warning"
        loading={saveState === 'saving'}
        onConfirm={async () => {
          try {
            setSaveState('saving');
            const res = await fetch('/api/leave-management', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({ action: 'resync-all-balances' })
            });
            if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              throw new Error(errBody.error || 'Sync failed');
            }
            toast.success('Successfully synced all employee leave balances');
            setRefreshKey(prev => prev + 1);
            setShowSyncConfirm(false);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to sync balances');
            setSaveState('error');
          } finally {
            setSaveState('idle');
          }
        }}
        onCancel={() => setShowSyncConfirm(false)}
      />

      <ConfirmModal
        open={showResetConfirm}
        title="CRITICAL: Reset All Balances"
        message="This will DELETE all manual quota overrides for the current year and reset everyone to default balances. This action is IRREVERSIBLE. Proceed?"
        confirmLabel="Reset Everything"
        variant="danger"
        loading={saveState === 'saving'}
        onConfirm={async () => {
          try {
            setSaveState('saving');
            // 1. Clear all overrides
            const clearRes = await fetch('/api/leave-management', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({ action: 'clear-all-overrides' })
            });
            if (!clearRes.ok) throw new Error('Failed to clear overrides');
            
            // 2. Trigger fresh sync
            const syncRes = await fetch('/api/leave-management', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({ action: 'resync-all-balances' })
            });
            if (!syncRes.ok) throw new Error('Failed to sync after reset');
            
            toast.success('System reset to default balances successfully');
            setRefreshKey(prev => prev + 1);
            setShowResetConfirm(false);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Reset failed');
            setSaveState('error');
          } finally {
            setSaveState('idle');
          }
        }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
