import { prisma } from '@/lib/prisma';

export type LeaveRequestStatus =
  | 'pending'
  | 'inquiring'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'history-archived';
export type LeaveType =
  | 'AL'
  | 'MC'
  | 'CASUAL'
  | 'MATERNITY'
  | 'PATERNITY'
  | 'BEREAVEMENT'
  | 'UNPAID'
  | 'WFH'
  | 'REWARD'
  | 'CS';
export type EmploymentType = 'Permanent' | 'Intern' | 'Probation';
export type SessionType = 'FULL' | 'AM' | 'PM';

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  dept: string;
  leaveType: LeaveType;
  employmentType: EmploymentType;
  startDate: string;
  endDate: string;
  session: SessionType;
  units: number;
  reason?: string;
  attachment?: string;
  status: LeaveRequestStatus;
  requestedBy?: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  reportingOfficer?: string;
  currentApprovalLevel?: number;
  workflowLevels?: number;
  finalDecisionComment?: string;
  cancelReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  employeeStatus: 'active' | 'inactive' | 'pending' | 'terminated';
  movedToHistoryAt?: string;
  isCarryForward?: boolean;
};

function safeIsoString(val: any): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val.toISOString();
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch (e) {}
  return String(val);
}

function mapRow(row: any): LeaveRequest {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    dept: row.dept,
    leaveType: row.leave_type as LeaveType,
    employmentType: row.employment_type as EmploymentType,
    startDate: row.start_date,
    endDate: row.end_date,
    session: row.session as SessionType,
    units: Number(row.units || 0),
    reason: row.reason || undefined,
    attachment: row.attachment || undefined,
    status: row.status as LeaveRequestStatus,
    requestedBy: row.requested_by || undefined,
    requestedAt: safeIsoString(row.requested_at) || '',
    approvedBy: row.approved_by || undefined,
    approvedAt: safeIsoString(row.approved_at),
    rejectedBy: row.rejected_by || undefined,
    rejectedAt: safeIsoString(row.rejected_at),
    rejectionReason: row.rejection_reason || undefined,
    reportingOfficer: row.reporting_officer || undefined,
    currentApprovalLevel: row.current_approval_level !== null ? Number(row.current_approval_level) : undefined,
    workflowLevels: row.workflow_levels !== null ? Number(row.workflow_levels) : undefined,
    finalDecisionComment: row.final_decision_comment || undefined,
    cancelReason: row.cancel_reason || undefined,
    cancelledBy: row.cancelled_by || undefined,
    cancelledAt: safeIsoString(row.cancelled_at),
    employeeStatus: (row.users?.status || row.employee_status || 'active') as any,
    movedToHistoryAt: safeIsoString(row.moved_to_history_at),
    isCarryForward: row.isCarryForward !== undefined ? Boolean(row.isCarryForward) : undefined,
  };
}

export async function createLeaveRequest(
  request: Omit<LeaveRequest, 'id' | 'requestedAt'>,
): Promise<LeaveRequest> {
  const id = `LR-${Date.now()}`;
  const now = new Date();

  const data = await prisma.leave_requests.create({
    data: {
      id,
      employee_id: request.employeeId,
      employee_name: request.employeeName,
      dept: request.dept,
      leave_type: request.leaveType,
      employment_type: request.employmentType,
      start_date: request.startDate,
      end_date: request.endDate,
      session: request.session,
      units: request.units,
      reason: request.reason || null,
      attachment: request.attachment || null,
      status: request.status as any,
      requested_by: request.requestedBy || null,
      requested_at: now,
      reporting_officer: request.reportingOfficer || null,
      current_approval_level: request.currentApprovalLevel || 1,
      workflow_levels: request.workflowLevels || 1,
      final_decision_comment: request.finalDecisionComment || null,
      cancel_reason: request.cancelReason || null,
      cancelled_by: request.cancelledBy || null,
      cancelled_at: request.cancelledAt ? new Date(request.cancelledAt) : null,
      moved_to_history_at: request.movedToHistoryAt ? new Date(request.movedToHistoryAt) : null,
      created_at: now,
      updated_at: now,
    }
  });

  return mapRow(data);
}

export async function getLeaveRequest(id: string): Promise<LeaveRequest | null> {
  const data = await prisma.leave_requests.findUnique({
    where: { id },
    include: { users: { select: { status: true } } }
  });

  if (!data) return null;
  return mapRow(data);
}

export async function listLeaveRequests(filters: {
  status?: LeaveRequestStatus | 'all';
  employeeId?: string;
  dept?: string;
  leaveType?: LeaveType | string;
  employmentType?: EmploymentType;
  reportingOfficer?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}): Promise<LeaveRequest[]> {
  const data = await prisma.leave_requests.findMany({
    where: {
      status: (filters.status && filters.status !== 'all') ? (filters.status as any) : undefined,
      employee_id: filters.employeeId || undefined,
      dept: filters.dept || undefined,
      leave_type: filters.leaveType || undefined,
      employment_type: filters.employmentType || undefined,
      reporting_officer: filters.reportingOfficer || undefined,
      AND: filters.dateRangeStart && filters.dateRangeEnd ? [
        { start_date: { gte: filters.dateRangeStart } },
        { end_date: { lte: filters.dateRangeEnd } }
      ] : undefined,
    },
    include: { users: { select: { status: true, role: true } } },
    orderBy: { requested_at: 'desc' }
  });

  return (data ?? []).map(mapRow);
}

export async function listLeaveRequestsByIds(ids: string[]): Promise<LeaveRequest[]> {
  if (ids.length === 0) return [];

  const data = await prisma.leave_requests.findMany({
    where: { id: { in: ids } },
    include: { users: { select: { status: true } } },
    orderBy: { requested_at: 'desc' }
  });

  return (data ?? []).map(mapRow);
}

export async function approveLeaveRequest(id: string, approvedBy: string, comment?: string): Promise<void> {
  const now = new Date();
  await prisma.leave_requests.update({
    where: { id },
    data: {
      status: 'approved',
      approved_by: approvedBy,
      approved_at: now,
      final_decision_comment: comment || null,
      updated_at: now,
    }
  });
}

export async function rejectLeaveRequest(id: string, rejectedBy: string, reason: string): Promise<void> {
  const now = new Date();
  await prisma.leave_requests.update({
    where: { id },
    data: {
      status: 'rejected',
      rejected_by: rejectedBy,
      rejected_at: now,
      rejection_reason: reason,
      final_decision_comment: reason,
      updated_at: now,
    }
  });
}

export async function setLeaveRequestProgress(
  id: string,
  status: LeaveRequestStatus,
  currentApprovalLevel: number,
  workflowLevels: number,
) {
  await prisma.leave_requests.update({
    where: { id },
    data: {
      status: status as any,
      current_approval_level: currentApprovalLevel,
      workflow_levels: workflowLevels,
      updated_at: new Date(),
    }
  });
}

export async function cancelLeaveRequest(id: string, cancelledBy: string, reason: string): Promise<void> {
  const now = new Date();
  await prisma.leave_requests.update({
    where: { id },
    data: {
      status: 'cancelled',
      cancel_reason: reason,
      cancelled_by: cancelledBy,
      cancelled_at: now,
      updated_at: now,
    }
  });
}

export async function markLeaveRequestMovedToHistory(id: string): Promise<void> {
  const now = new Date();
  const existing = await prisma.leave_requests.findUnique({
    where: { id },
    select: { moved_to_history_at: true }
  });

  const movedAt = existing?.moved_to_history_at || now;

  await prisma.leave_requests.update({
    where: { id },
    data: {
      moved_to_history_at: movedAt,
      updated_at: now,
    }
  });
}

export async function enrichLeaveRequestsWithCarryForward(requests: LeaveRequest[]): Promise<LeaveRequest[]> {
  if (requests.length === 0) return [];

  const { isArchivedYear } = await import('@/lib/archivePolicy');

  // Group requests by employeeId and year
  const employeeIds = Array.from(new Set(requests.map(r => r.employeeId)));
  const years = Array.from(new Set(requests.map(r => {
    const dateStr = r.startDate;
    return new Date(dateStr).getFullYear();
  })));

  const isCarryForwardMap = new Map<string, boolean>();

  for (const year of years) {
    // 1. Fetch carry forward balances for these employees and this year
    const carryForwardBalances = new Map<string, number>();
    const balances = await prisma.leave_balances.findMany({
      where: {
        employee_id: { in: employeeIds },
        balance_year: year,
        leave_type_code: 'AL'
      },
      select: {
        employee_id: true,
        carry_forward_days: true
      }
    });
    for (const b of balances) {
      carryForwardBalances.set(b.employee_id, Number(b.carry_forward_days || 0));
    }

    // 2. Fetch all AL requests in Jan/Feb for these employees in this year.
    let yearALRequests: any[] = [];
    if (isArchivedYear(year)) {
      const { getHistoricalRecords } = await import('@/models/yearEndArchiveModel');
      const archiveData = await getHistoricalRecords(year, 'leave-history');
      const archivedRequests = (archiveData[0]?.payload as any[]) || [];
      yearALRequests = archivedRequests.filter(r => 
        (r.employeeId || r.employee_id) && employeeIds.includes(r.employeeId || r.employee_id) &&
        (r.leaveType || r.leave_type) === 'AL' &&
        (r.status === 'approved' || r.status === 'pending' || r.status === 'history-archived')
      ).map(r => ({
        id: r.id,
        employeeId: r.employeeId || r.employee_id,
        startDate: r.startDate || r.start_date,
        units: Number(r.units || 0)
      }));
    } else {
      const dbRequests = await prisma.leave_requests.findMany({
        where: {
          employee_id: { in: employeeIds },
          leave_type: 'AL',
          start_date: {
            gte: `${year}-01-01`,
            lte: `${year}-02-28`
          },
          status: {
            in: ['approved', 'pending', 'history-archived'] as any
          }
        },
        select: {
          id: true,
          employee_id: true,
          start_date: true,
          units: true
        }
      });
      yearALRequests = dbRequests.map(r => ({
        id: r.id,
        employeeId: r.employee_id,
        startDate: r.start_date,
        units: Number(r.units || 0)
      }));
    }

    // Group by employee
    const empALRequests = new Map<string, any[]>();
    for (const r of yearALRequests) {
      if (!empALRequests.has(r.employeeId)) {
        empALRequests.set(r.employeeId, []);
      }
      empALRequests.get(r.employeeId)!.push(r);
    }

    // Sort chronologically and determine carry forward
    for (const empId of employeeIds) {
      const list = empALRequests.get(empId) || [];
      list.sort((a, b) => a.startDate.localeCompare(b.startDate));

      const limit = carryForwardBalances.get(empId) || 0;
      let runningSum = 0;

      for (const r of list) {
        const units = r.units;
        if (runningSum < limit) {
          isCarryForwardMap.set(r.id, true);
        } else {
          isCarryForwardMap.set(r.id, false);
        }
        runningSum += units;
      }
    }
  }

  return requests.map(r => {
    if (r.leaveType !== 'AL') return r;
    return {
      ...r,
      isCarryForward: isCarryForwardMap.get(r.id) || false
    };
  });
}

