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
