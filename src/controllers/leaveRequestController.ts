// Rebuild trigger: Import refactoring verified
import { prisma } from '@/lib/prisma';
import { getUser } from '@/models/userModel';

import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  getLeaveRequest,
  listLeaveRequests,
  listLeaveRequestsByIds,
  markLeaveRequestMovedToHistory,
  rejectLeaveRequest,

  setLeaveRequestProgress,
  type LeaveRequest,
  type LeaveRequestStatus,
  type LeaveType,
  type EmploymentType,
} from '@/models/leaveRequestModel';
import { insertSystemAuditLog } from '@/models/systemAuditLogModel';
import {
  sendLeaveSubmissionNotificationController,
  sendLeaveApprovalNotificationController,
  sendLeaveRejectionNotificationController,
} from '@/controllers/notificationController';
import {
  calculateLeaveValidation,
  assertLeaveBookingWindow,
  createLeaveApprovalStep,
  createLeaveCalendarEntry,
  deductLeaveBalance,
  getLeaveBalancePreview,
  hasLeaveOverlap,
  listLeaveApprovalSteps,
  listRequestsPendingForApprover,
  lockLeaveRequestDays,
  releaseLeaveRequestDays,
  resolveWorkflow,
  seedDefaultLeaveSetup,
  updateLeaveApprovalStep,
  type LeaveSlot,
} from '@/models/leaveManagementModel';
import { HRNotificationService } from '@/lib/notifications/hrNotificationService';
import { getManagerSelfApprovalPolicy, recordLeaveAttendanceImpact } from '@/models/performanceManagementModel';

type SubmitValidationParams = {
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  session: 'FULL' | 'AM' | 'PM';
  fromHalf?: LeaveSlot;
  toHalf?: LeaveSlot;
};

function resolveHalfDay(session: 'FULL' | 'AM' | 'PM', fromHalf?: LeaveSlot, toHalf?: LeaveSlot) {
  if (session === 'FULL' && !fromHalf && !toHalf) {
    return {
      halfDay: false,
      fromHalf: 'AM' as LeaveSlot,
      toHalf: 'PM' as LeaveSlot,
    };
  }

  if (fromHalf && toHalf) {
    return {
      halfDay: true,
      fromHalf,
      toHalf,
    };
  }

  if (session === 'AM') {
    return {
      halfDay: true,
      fromHalf: 'AM' as LeaveSlot,
      toHalf: 'AM' as LeaveSlot,
    };
  }

  if (session === 'PM') {
    return {
      halfDay: true,
      fromHalf: 'PM' as LeaveSlot,
      toHalf: 'PM' as LeaveSlot,
    };
  }

  return {
    halfDay: true,
    fromHalf: fromHalf || 'AM',
    toHalf: toHalf || 'PM',
  };
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function finalizeApprovedLeaveRequest(request: LeaveRequest, actor: string) {
  const requestYear = Number(request.startDate.substring(0, 4)) || new Date().getFullYear();

  const previewBeforeDeduction = await getLeaveBalancePreview(
    request.employeeId,
    request.leaveType,
    requestYear,
    request.units,
    request.startDate,
  );

  await deductLeaveBalance({
    employeeId: request.employeeId,
    leaveTypeCode: request.leaveType,
    year: requestYear,
    units: request.units,
    requestId: request.id,
    actor,
    requestStartDate: request.startDate,
  });

  await createLeaveCalendarEntry({
    requestId: request.id,
    employeeId: request.employeeId,
    employeeName: request.employeeName,
    leaveTypeCode: request.leaveType,
    startDate: request.startDate,
    endDate: request.endDate,
    units: request.units,
  });

  await markLeaveRequestMovedToHistory(request.id);

  try {
    const attendanceResult = await recordLeaveAttendanceImpact({
      employeeId: request.employeeId,
      employeeName: request.employeeName,
      department: request.dept,
      leaveRequestId: request.id,
      leaveTypeCode: request.leaveType,
      startDate: request.startDate,
      endDate: request.endDate,
      units: request.units,
      withoutPay: request.leaveType === 'UNPAID',
      exceedBalance: previewBeforeDeduction.after < 0,
      actor,
    });

    if (attendanceResult.penalty) {
      setTimeout(async () => {
        try {
          const { HRNotificationService } = await import('@/lib/notifications/hrNotificationService');
          const { listUsers } = await import('@/models/userModel');
          const users = await listUsers();
          const employee = users.find(u => u.id === request.employeeId);
          
          await HRNotificationService.notifyPenaltyAction({
            penaltyId: attendanceResult.penalty!.id,
            employeeId: request.employeeId,
            employeeName: request.employeeName,
            employeeEmail: employee?.email || `${request.employeeId}@ezeetechnosys.com.my`,
            penaltyType: attendanceResult.penalty!.penaltyTypeCode,
            incidentDate: attendanceResult.penalty!.penaltyDate,
            amount: String(attendanceResult.penalty!.cashAmount || '0'),
            description: attendanceResult.penalty!.reason,
            action: 'created',
            actorId: 'system',
            actorName: 'System Auto-Penalty'
          });
        } catch (err) {
          console.error("Error sending auto-penalty notification:", err);
        }
      }, 10);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown attendance impact error';
    console.error('Failed to record leave attendance impact:', {
      requestId: request.id,
      employeeId: request.employeeId,
      error: message,
    });

    try {
      await insertSystemAuditLog('leave-request', 'attendance-impact-failed', actor, {
        requestId: request.id,
        employeeId: request.employeeId,
        leaveType: request.leaveType,
        error: message,
      });
    } catch (auditError) {
      console.error('Failed to write attendance impact failure audit log:', auditError);
    }
  }
}

export async function validateLeaveRequestController(params: SubmitValidationParams) {
  await seedDefaultLeaveSetup();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const requestedStart = new Date(params.startDate);
  requestedStart.setHours(0, 0, 0, 0);

  if (requestedStart < today) {
    throw new Error(`Start date cannot be earlier than today (${toDateOnly(today)})`);
  }

  await assertLeaveBookingWindow(params.startDate);

  const halfDayState = resolveHalfDay(params.session, params.fromHalf, params.toHalf);
  const validation = await calculateLeaveValidation({
    startDate: params.startDate,
    endDate: params.endDate,
    halfDay: halfDayState.halfDay,
    fromHalf: halfDayState.fromHalf,
    toHalf: halfDayState.toHalf,
  });

  const overlap = await hasLeaveOverlap(params.employeeId, validation.slots);
  const requestYear = Number(params.startDate.substring(0, 4)) || new Date().getFullYear();
  const balancePreview = await getLeaveBalancePreview(
    params.employeeId,
    params.leaveType,
    requestYear,
    validation.units,
    params.startDate,
  );

  return {
    valid: !overlap && balancePreview.after >= balancePreview.minAllowed,
    overlap,
    units: validation.units,
    workingDates: validation.workingDates,
    warnings: validation.warnings,
    balancePreview,
    slots: validation.slots,
  };
}

async function notifyApproverOnSubmission(params: {
  approverId: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  units: number;
  requestId: string;
  reason: string;
  dept: string;
}) {
  const allUsers = await (await import('@/models/userModel')).listUsers();
  const employee = allUsers.find(u => u.id === params.employeeId);
  const employeeEmail = employee?.email || `${params.employeeId}@ezeetechnosys.com.my`;

  await HRNotificationService.notifyLeaveSubmission({
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    employeeEmail,
    leaveType: params.leaveType,
    startDate: params.startDate,
    endDate: params.endDate,
    units: params.units,
    requestId: params.requestId,
    reportingOfficerId: params.approverId,
    reason: params.reason,
    dept: params.dept
  });
}

export async function submitLeaveRequestController(params: {
  employeeId: string;
  employeeName: string;
  dept: string;
  leaveType: LeaveType;
  employmentType: EmploymentType;
  startDate: string;
  endDate: string;
  session: 'FULL' | 'AM' | 'PM';
  units: number;
  reason?: string;
  attachment?: string;
  reportingOfficer: string;
  isManagerSubmittingOwnRequest?: boolean;
  fromHalf?: LeaveSlot;
  toHalf?: LeaveSlot;
}): Promise<LeaveRequest> {
  await seedDefaultLeaveSetup();

  if (!params.reason || params.reason.trim().length < 10) {
    throw new Error('Reason must be at least 10 characters');
  }

  const validation = await validateLeaveRequestController({
    employeeId: params.employeeId,
    leaveType: params.leaveType,
    startDate: params.startDate,
    endDate: params.endDate,
    session: params.session,
    fromHalf: params.fromHalf,
    toHalf: params.toHalf,
  });

  if (validation.overlap) {
    throw new Error('Leave request overlaps with existing approved or pending leave');
  }

  if (validation.balancePreview.after < validation.balancePreview.minAllowed) {
    throw new Error('Insufficient leave balance');
  }

  const workflow = await resolveWorkflow(params.dept, params.leaveType);
  const workflowLevels = workflow.levelCount;
  const managerSelfPolicy = params.isManagerSubmittingOwnRequest ? await getManagerSelfApprovalPolicy() : null;
  const allowManagerSelfApproval = Boolean(managerSelfPolicy?.allowManagerSelfApproval);
  const firstApproverId =
    params.isManagerSubmittingOwnRequest && !allowManagerSelfApproval
      ? (managerSelfPolicy?.fallbackApproverId || workflow.hrApproverId || 'hr-001')
      : params.reportingOfficer;

  const userData = await prisma.users.findUnique({
    where: { id: params.employeeId },
    select: { status: true }
  });

  let request = await createLeaveRequest({
    ...params,
    status: 'pending',
    requestedBy: params.employeeId,
    units: validation.units,
    currentApprovalLevel: 1,
    workflowLevels,
    employeeStatus: userData?.status || 'active',
  });

  await createLeaveApprovalStep({
    requestId: request.id,
    levelNo: 1,
    approverId: firstApproverId,
  });

  if (workflow.levelCount === 2) {
    await createLeaveApprovalStep({
      requestId: request.id,
      levelNo: 2,
      approverId: workflow.hrApproverId || 'hr-001',
    });
  }

  await lockLeaveRequestDays(request.id, params.employeeId, validation.slots);

  // Manager self-approval is configurable. Default is no self-approval and routing to fallback approver.
  if (params.isManagerSubmittingOwnRequest && allowManagerSelfApproval) {
    await updateLeaveApprovalStep({
      requestId: request.id,
      levelNo: 1,
      action: 'approved',
      comment: 'Manager self-approval',
      actor: params.employeeId, // Use the employeeId as the actor for self-approval
    });

    // If multi-level, approve all levels
    if (workflow.levelCount > 1) {
       await updateLeaveApprovalStep({
         requestId: request.id,
         levelNo: 2,
         action: 'approved',
         comment: 'Auto-approved via Manager Self-Approval policy',
         actor: 'system',
       });
    }

    // Directly approve and finalize the request
    await approveLeaveRequest(request.id, params.employeeId, 'Manager self-approval');
    await finalizeApprovedLeaveRequest(request, params.employeeId);
  }

  if (!params.isManagerSubmittingOwnRequest || !allowManagerSelfApproval) {
    setTimeout(() => {
      notifyApproverOnSubmission({
        approverId: firstApproverId,
        employeeId: params.employeeId,
        employeeName: params.employeeName,
        leaveType: params.leaveType,
        startDate: params.startDate,
        endDate: params.endDate,
        units: validation.units,
        requestId: request.id,
        reason: params.reason || '-',
        dept: params.dept
      }).catch(err => console.error("Error sending submission email in background:", err));
    }, 50);
  }

  await insertSystemAuditLog(
    'leave-request',
    params.isManagerSubmittingOwnRequest && allowManagerSelfApproval ? 'auto-submit' : 'submit',
    params.employeeId,
    {
    requestId: request.id,
    leaveType: params.leaveType,
    startDate: params.startDate,
    endDate: params.endDate,
    units: validation.units,
    workflowLevels,
    managerSelfApprovalAllowed: allowManagerSelfApproval,
    firstApproverId,
    },
  );

  request = (await getLeaveRequest(request.id)) || request;

  return request;
}

export async function approveLeaveRequestController(
  requestId: string,
  approvedBy: string,
  comment?: string,
): Promise<LeaveRequest | null> {
  const request = await getLeaveRequest(requestId);
  if (!request) throw new Error('Leave request not found');

  if (request.status !== 'pending') {
    throw new Error(`Cannot approve request with status: ${request.status}`);
  }

  let steps = await listLeaveApprovalSteps(requestId);
  let pendingStep = steps.find(step => step.action === 'pending');

  const approver = await getUser(approvedBy);
  const isDirectApprover = approver?.role === 'admin' || approver?.role === 'hod' || approver?.role === 'director';

  if (!pendingStep) {
    // Self-healing: If request is pending but has no steps, create a level 1 step for the current actor if they are HOD/Admin
    if (isDirectApprover && steps.length === 0) {
      await createLeaveApprovalStep({
        requestId,
        levelNo: 1,
        approverId: approvedBy,
      });
      steps = await listLeaveApprovalSteps(requestId);
      pendingStep = steps.find(s => s.action === 'pending');
    }

    if (!pendingStep) {
      throw new Error('No pending approval step found for this request');
    }
  }

  if (pendingStep.approverId !== approvedBy && !isDirectApprover) {
    throw new Error('You are not assigned as the current approver for this request');
  }

  await updateLeaveApprovalStep({
    requestId,
    levelNo: pendingStep.levelNo,
    action: 'approved',
    comment,
    actor: approvedBy,
  });

  const updatedSteps = await listLeaveApprovalSteps(requestId);
  const nextPending = updatedSteps.find(step => step.action === 'pending');

  if (nextPending && !isDirectApprover) {
    await setLeaveRequestProgress(requestId, 'pending', nextPending.levelNo, updatedSteps.length);
    setTimeout(() => {
      notifyApproverOnSubmission({
        approverId: nextPending.approverId,
        employeeId: request.employeeId,
        employeeName: request.employeeName,
        leaveType: request.leaveType,
        startDate: request.startDate,
        endDate: request.endDate,
        units: request.units,
        requestId,
        reason: request.reason || '-',
        dept: request.dept
      }).catch(err => console.error("Error sending submission email in background:", err));
    }, 10);
  } else {
    // Finalize if no more steps OR if direct approver took action
    if (isDirectApprover && nextPending) {
       // Mark remaining steps as skipped/approved if we want to be clean
       for (const step of updatedSteps.filter(s => s.action === 'pending')) {
          await updateLeaveApprovalStep({
            requestId,
            levelNo: step.levelNo,
            action: 'approved',
            comment: `Direct approval by ${approver?.role}: ${comment || ''}`,
            actor: approvedBy
          });
       }
    }
    await approveLeaveRequest(requestId, approvedBy, comment);

    // Background the finalization of approved leave request (heavy DB/email tasks)
    setTimeout(async () => {
      try {
        await finalizeApprovedLeaveRequest(request, approvedBy);
      } catch (err) {
        console.error("Error finalising approved leave request in background:", err);
      }
    }, 10);
  }

  await insertSystemAuditLog('leave-request', 'approve', approvedBy, {
    requestId,
    employeeId: request.employeeId,
    leaveType: request.leaveType,
    levelApproved: pendingStep.levelNo,
    finalApproval: !nextPending,
  });

  if (!nextPending) {
    // Send final approval notification to employee (non-blocking in background)
    setTimeout(async () => {
      try {
        const [employee, actorProfile] = await Promise.all([
          getUser(request.employeeId),
          getUser(approvedBy)
        ]);
        const { listLeaveBalances } = await import('@/models/leaveManagementModel');
        const balance = (await listLeaveBalances(request.employeeId, new Date().getFullYear())).find(b => b.leaveTypeCode === request.leaveType)?.availableDays || 0;

        await HRNotificationService.notifyLeaveDecision({
          requestId,
          employeeId: request.employeeId,
          employeeName: request.employeeName,
          employeeEmail: employee?.email || `${request.employeeId}@ezeetechnosys.com.my`,
          leaveType: request.leaveType,
          startDate: request.startDate,
          endDate: request.endDate,
          units: request.units,
          status: 'approved',
          actorId: approvedBy,
          actorName: actorProfile?.name || approvedBy,
          reason: comment,
          dept: request.dept,
          balance
        });
      } catch (err) {
        console.error("Error sending approval email in background:", err);
      }
    }, 10);
  }

  return getLeaveRequest(requestId);
}

export async function rejectLeaveRequestController(
  requestId: string,
  rejectedBy: string,
  reason: string,
  comment?: string,
): Promise<LeaveRequest | null> {
  const request = await getLeaveRequest(requestId);
  if (!request) throw new Error('Leave request not found');

  if (request.status !== 'pending') {
    throw new Error(`Cannot reject request with status: ${request.status}`);
  }

  if (!reason || reason.trim().length < 3) {
    throw new Error('Rejection reason is required (minimum 3 characters)');
  }

  let steps = await listLeaveApprovalSteps(requestId);
  let pendingStep = steps.find(step => step.action === 'pending');

  const actor = await getUser(rejectedBy);
  const isDirectApprover = actor?.role === 'admin' || actor?.role === 'hod' || actor?.role === 'director';

  if (!pendingStep) {
    // Self-healing: If request is pending but has no steps, create a level 1 step for the current actor if they are HOD/Admin
    if (isDirectApprover && steps.length === 0) {
      await createLeaveApprovalStep({
        requestId,
        levelNo: 1,
        approverId: rejectedBy,
      });
      steps = await listLeaveApprovalSteps(requestId);
      pendingStep = steps.find(s => s.action === 'pending');
    }

    if (!pendingStep) {
      throw new Error('No pending approval step found for this request');
    }
  }

  if (pendingStep.approverId !== rejectedBy && !isDirectApprover) {
    throw new Error('You are not assigned as the current approver for this request');
  }

  await updateLeaveApprovalStep({
    requestId,
    levelNo: pendingStep.levelNo,
    action: 'rejected',
    comment: comment || reason,
    actor: rejectedBy,
  });

  if (isDirectApprover && steps.some(s => s.action === 'pending')) {
    // Mark remaining steps as rejected if HOD/Admin takes direct action
    for (const step of steps.filter(s => s.action === 'pending')) {
      await updateLeaveApprovalStep({
        requestId,
        levelNo: step.levelNo,
        action: 'rejected',
        comment: `Direct rejection by ${actor?.role}: ${comment || reason}`,
        actor: rejectedBy
      });
    }
  }

  await releaseLeaveRequestDays(requestId);
  await rejectLeaveRequest(requestId, rejectedBy, reason);

  await insertSystemAuditLog('leave-request', 'reject', rejectedBy, {
    requestId,
    employeeId: request.employeeId,
    reason,
  });

  // Send rejection notification to employee (non-blocking in background)
  setTimeout(async () => {
    try {
      const [employee, actorProfile] = await Promise.all([
        getUser(request.employeeId),
        getUser(rejectedBy)
      ]);

      await HRNotificationService.notifyLeaveDecision({
        requestId,
        employeeId: request.employeeId,
        employeeName: request.employeeName,
        employeeEmail: employee?.email || `${request.employeeId}@ezeetechnosys.com.my`,
        leaveType: request.leaveType,
        startDate: request.startDate,
        endDate: request.endDate,
        units: request.units,
        status: 'rejected',
        actorId: rejectedBy,
        actorName: actorProfile?.name || rejectedBy,
        reason: reason,
        dept: request.dept
      });
    } catch (err) {
      console.error("Error sending rejection email in background:", err);
    }
  }, 10);

  return getLeaveRequest(requestId);
}

export async function cancelLeaveRequestController(requestId: string, employeeId: string, reason: string): Promise<LeaveRequest | null> {
  const request = await getLeaveRequest(requestId);
  if (!request) {
    throw new Error('Leave request not found');
  }

  if (request.employeeId !== employeeId) {
    throw new Error('You can only cancel your own leave request');
  }

  if (request.status !== 'pending' && request.status !== 'inquiring') {
    throw new Error(`Cannot cancel request with status: ${request.status}`);
  }

  await releaseLeaveRequestDays(requestId);
  await cancelLeaveRequest(requestId, employeeId, reason || 'Cancelled by employee');

  const steps = await listLeaveApprovalSteps(requestId);
  for (const step of steps.filter(step => step.action === 'pending')) {
    await updateLeaveApprovalStep({
      requestId,
      levelNo: step.levelNo,
      action: 'rejected',
      comment: `Cancelled by employee: ${reason || 'No reason provided'}`,
      actor: step.approverId,
    });
  }

  await insertSystemAuditLog('leave-request', 'cancel', employeeId, {
    requestId,
    reason,
  });

  return getLeaveRequest(requestId);
}

export async function inquireLeaveRequestController(
  requestId: string,
  managerId: string,
  question: string,
): Promise<LeaveRequest | null> {
  const request = await getLeaveRequest(requestId);
  if (!request) throw new Error('Leave request not found');

  if (request.status !== 'pending') {
    throw new Error(`Cannot inquire on request with status: ${request.status}`);
  }

  if (!question || question.trim().length < 5) {
    throw new Error('Question must be at least 5 characters');
  }

  // Set status to 'inquiring' and store the manager question in final_decision_comment
  await prisma.leave_requests.update({
    where: { id: requestId },
    data: {
      status: 'inquiring',
      final_decision_comment: question.trim(),
      updated_at: new Date(),
    }
  });

  await insertSystemAuditLog('leave-request', 'inquire', managerId, {
    requestId,
    employeeId: request.employeeId,
    question: question.trim(),
  });

  // Notify employee
  try {
    const { createNotification } = await import('@/models/notificationModel');
    await createNotification({
      recipientId: request.employeeId,
      recipientEmail: `${request.employeeId}@ezeetechnosys.com.my`,
      type: 'leave-inquiry',
      title: 'Manager has a question about your leave request',
      message: `Your ${request.leaveType} leave request (${request.startDate}–${request.endDate}) is under inquiry. Manager question: "${question.trim()}"`,
      channel: 'in-app',
      provider: 'in-app',
      relatedId: requestId,
      read: false,
    });
  } catch (notifError) {
    console.error('Failed to send inquiry notification:', notifError);
  }

  return getLeaveRequest(requestId);
}

export async function respondToInquiryController(
  requestId: string,
  employeeId: string,
  response: string,
): Promise<LeaveRequest | null> {
  const request = await getLeaveRequest(requestId);
  if (!request) throw new Error('Leave request not found');
  if (request.employeeId !== employeeId) throw new Error('You can only respond to your own leave requests');
  if (request.status !== 'inquiring') throw new Error('This request is not under inquiry');

  if (!response || response.trim().length < 5) {
    throw new Error('Response must be at least 5 characters');
  }

  const combinedComment = `${request.finalDecisionComment || ''}\n\n[Employee reply]: ${response.trim()}`;
  await prisma.leave_requests.update({
    where: { id: requestId },
    data: {
      status: 'pending',
      final_decision_comment: combinedComment.trim(),
      updated_at: new Date(),
    }
  });

  await insertSystemAuditLog('leave-request', 'inquiry-response', employeeId, {
    requestId,
    response: response.trim(),
  });

  // Notify manager
  try {
    const steps = await listLeaveApprovalSteps(requestId);
    const pendingStep = steps.find(s => s.action === 'pending') || steps[0];
    if (pendingStep) {
      const { createNotification } = await import('@/models/notificationModel');
      await createNotification({
        recipientId: pendingStep.approverId,
        recipientEmail: `${pendingStep.approverId}@ezeetechnosys.com.my`,
        type: 'leave-inquiry-response',
        title: `${request.employeeName} replied to your leave inquiry`,
        message: `Reply: "${response.trim()}" — Leave: ${request.leaveType} (${request.startDate}–${request.endDate})`,
        channel: 'in-app',
        provider: 'in-app',
        relatedId: requestId,
        read: false,
      });
    }
  } catch (notifError) {
    console.error('Failed to send inquiry response notification:', notifError);
  }

  return getLeaveRequest(requestId);
}

export async function getHodApprovalQueueController(params: {
  hodId: string;
  status?: LeaveRequestStatus | 'all';
  leaveType?: LeaveType;
  employmentType?: EmploymentType;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  employeeNameSearch?: string;
  department?: string;
}): Promise<LeaveRequest[]> {
  // Self-healing: Migrate any legacy pending-hr to pending on the fly
  await prisma.leave_requests.updateMany({
    where: { status: 'pending-hr' },
    data: { status: 'pending' }
  });

  // If status is 'all' or a non-pending status, use the team history logic
  // to show all records in the department/scope.
  if (!params.status || params.status === 'all' || (params.status !== 'pending' && params.status !== 'inquiring')) {
    return getTeamLeaveHistoryController({
      department: params.department,
      status: params.status,
      leaveType: params.leaveType,
      employmentType: params.employmentType,
      dateRangeStart: params.dateRangeStart,
      dateRangeEnd: params.dateRangeEnd,
      employeeNameSearch: params.employeeNameSearch,
    });
  }

  const requestIds = await listRequestsPendingForApprover({
    approverId: params.hodId,
    status: params.status,
    leaveType: params.leaveType,
    employmentType: params.employmentType,
    dateRangeStart: params.dateRangeStart,
    dateRangeEnd: params.dateRangeEnd,
    employeeNameSearch: params.employeeNameSearch,
    department: params.department,
  });

  if (requestIds.length === 0) {
    return [];
  }

  const requests = await listLeaveRequestsByIds(requestIds);
  return requests;
}

export async function bulkDecisionLeaveRequestsController(params: {
  actor: string;
  action: 'approve' | 'reject';
  reason?: string;
  comment?: string;
  requestIds: string[];
}) {
  const results: Array<{ requestId: string; success: boolean; error?: string }> = [];

  for (const requestId of params.requestIds) {
    try {
      if (params.action === 'approve') {
        await approveLeaveRequestController(requestId, params.actor, params.comment);
      } else {
        await rejectLeaveRequestController(requestId, params.actor, params.reason || 'Rejected in bulk', params.comment);
      }
      results.push({ requestId, success: true });
    } catch (error) {
      results.push({
        requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

export async function getEmployeeLeaveHistoryController(params: {
  employeeId: string;
  year?: number;
  status?: LeaveRequestStatus;
}): Promise<LeaveRequest[]> {
  const year = params.year || new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const requests = await listLeaveRequests({
    employeeId: params.employeeId,
    status: params.status,
    dateRangeStart: yearStart,
    dateRangeEnd: yearEnd,
  });

  return requests;
}

export async function getTeamLeaveHistoryController(params: {
  department?: string;
  year?: number;
  status?: LeaveRequestStatus | 'all';
  leaveType?: LeaveType | string;
  employmentType?: EmploymentType;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  employeeNameSearch?: string;
}): Promise<LeaveRequest[]> {
  // Self-healing: Migrate any legacy pending-hr to pending on the fly
  await prisma.leave_requests.updateMany({
    where: { status: 'pending-hr' },
    data: { status: 'pending' }
  });

  const year = params.year || new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const requests = await listLeaveRequests({
    dept: params.department,
    status: params.status && params.status !== 'all' ? params.status : 'all',
    leaveType: params.leaveType,
    employmentType: params.employmentType,
    dateRangeStart: params.dateRangeStart || yearStart,
    dateRangeEnd: params.dateRangeEnd || yearEnd,
  });

  const keyword = String(params.employeeNameSearch || '').trim().toLowerCase();
  if (!keyword) {
    return requests;
  }

  return requests.filter(item => item.employeeName.toLowerCase().includes(keyword));
}

export async function getManagerOwnLeaveHistoryController(params: {
  managerId: string;
  year?: number;
  status?: LeaveRequestStatus;
}): Promise<LeaveRequest[]> {
  // Manager can view their own leave requests
  return getEmployeeLeaveHistoryController({
    employeeId: params.managerId,
    year: params.year,
    status: params.status,
  });
}
