import { listUsers, getUser, type UserRecord } from '@/models/userModel';
import { 
  sendDualNotification,
  sendEmailNotification 
} from '@/controllers/notificationController';
import { insertActivityLog } from '@/models/activityLogModel';
import { emailTemplates, type LeaveDetails, type PerformanceDetails, type PenaltyDetails } from './emailTemplates';

/**
 * HR System Email Templates
 */
function safeDecode(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Enhanced Notification Service for HR Actions
 */
export class HRNotificationService {
  private static baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4028';

  /**
   * Leave Application: Notify Employee + Admin + HOD
   */
  static async notifyLeaveSubmission(params: {
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    units: number;
    reason: string;
    requestId: string;
    reportingOfficerId: string;
    dept: string;
  }) {
    try {
      const allUsers = await listUsers();
      const admins = allUsers.filter(u => u.role === 'admin' && u.status === 'active');
      const hod = allUsers.find(u => u.id === params.reportingOfficerId);
      const employeeName = safeDecode(params.employeeName);
      const timestamp = new Date().toLocaleString();

      const details: LeaveDetails = {
        employeeName,
        leaveType: params.leaveType,
        startDate: params.startDate,
        endDate: params.endDate,
        units: params.units,
        reason: params.reason,
        timestamp,
        dept: params.dept,
        id: params.requestId
      };

      // 1. Notify Employee (Template 1A)
      const empTpl = emailTemplates.leaveSubmittedEmployee(details);
      await sendDualNotification({
        recipientId: params.employeeId,
        recipientEmail: params.employeeEmail,
        type: 'leave-submitted',
        title: empTpl.subject,
        emailMessage: empTpl.subject,
        inAppMessage: `Your leave application (${params.leaveType}) has been submitted.`,
        relatedId: params.requestId,
        provider: 'smtp',
        html: empTpl.html
      });

      // 2. Notify HOD and Admins (Template 1B)
      const managers = [...admins];
      if (hod && !admins.find(a => a.id === hod.id)) {
        managers.push(hod);
      }

      for (const manager of managers) {
        const mgrTpl = emailTemplates.leaveSubmittedManager(details, manager.name, manager.role);
        await sendDualNotification({
          recipientId: manager.id,
          recipientEmail: manager.email,
          type: 'leave-pending-approval',
          title: mgrTpl.subject,
          emailMessage: mgrTpl.subject,
          inAppMessage: `New leave request from ${employeeName} requires your review.`,
          relatedId: params.requestId,
          provider: 'smtp',
          html: mgrTpl.html
        });
      }

      await insertActivityLog({
        actorId: params.employeeId,
        actorName: employeeName,
        actionType: 'LEAVE_SUBMIT',
        module: 'LEAVE',
        description: `Submitted ${params.leaveType} leave for ${employeeName}`,
        payload: params
      });
    } catch (error) {
      console.error('HRNotificationService.notifyLeaveSubmission failed:', error);
    }
  }

  /**
   * Leave Approval/Rejection: Notify Employee + Other Parties
   */
  static async notifyLeaveDecision(params: {
    requestId: string;
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    units: number;
    status: 'approved' | 'rejected';
    actorId: string;
    actorName: string;
    reason?: string;
    dept: string;
    balance?: number;
  }) {
    try {
      const employeeName = safeDecode(params.employeeName);
      const actorName = safeDecode(params.actorName);
      const timestamp = new Date().toLocaleString();

      const details: LeaveDetails = {
        employeeName,
        leaveType: params.leaveType,
        startDate: params.startDate,
        endDate: params.endDate,
        units: params.units,
        reason: '-', // Not needed for decision templates
        timestamp,
        actionBy: actorName,
        remarks: params.reason,
        dept: params.dept,
        balance: params.balance
      };

      if (params.status === 'approved') {
        // 1. Notify Employee (Template 2A)
        const empTpl = emailTemplates.leaveApprovedEmployee(details);
        await sendDualNotification({
          recipientId: params.employeeId,
          recipientEmail: params.employeeEmail,
          type: 'leave-approved',
          title: empTpl.subject,
          emailMessage: empTpl.subject,
          inAppMessage: `Your ${params.leaveType} leave has been approved.`,
          relatedId: params.requestId,
          provider: 'smtp',
          html: empTpl.html
        });

        // 2. Notify Admin/HOD (Template 2B)
        const allUsers = await listUsers();
        const admins = allUsers.filter(u => u.role === 'admin' && u.status === 'active');
        // Find HOD of this employee
        const employeeRecord = allUsers.find(u => u.id === params.employeeId);
        const hod = allUsers.find(u => u.id === employeeRecord?.reportsToId);

        // If HOD approved, notify Admin. If Admin approved, notify HOD.
        const recipients = [];
        const isActorAdmin = admins.find(a => a.id === params.actorId);
        if (isActorAdmin) {
          if (hod) recipients.push(hod);
        } else {
          recipients.push(...admins);
        }

        for (const recipient of recipients) {
          const fyiTpl = emailTemplates.leaveApprovedFYI(details, recipient.name);
          await sendDualNotification({
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            type: 'leave-fyi',
            title: fyiTpl.subject,
            emailMessage: fyiTpl.subject,
            inAppMessage: `${employeeName}'s ${params.leaveType} leave approved.`,
            relatedId: params.requestId,
            provider: 'smtp',
            html: fyiTpl.html
          });
        }
      } else {
        // Notify Employee & Admin Copy (Template 3A)
        const allUsers = await listUsers();
        const admins = allUsers.filter(u => u.role === 'admin' && u.status === 'active');
        
        const rejRecipients = [{ id: params.employeeId, email: params.employeeEmail, name: employeeName }];
        rejRecipients.push(...admins.map(a => ({ id: a.id, email: a.email, name: 'Admin' })));

        for (const recipient of rejRecipients) {
          const rejTpl = emailTemplates.leaveRejected(details, recipient.name);
          if (recipient.id === params.employeeId) {
            await sendDualNotification({
              recipientId: recipient.id,
              recipientEmail: recipient.email,
              type: 'leave-rejected',
              title: rejTpl.subject,
              emailMessage: rejTpl.subject,
              inAppMessage: `Your ${params.leaveType} leave was rejected.`,
              relatedId: params.requestId,
              provider: 'smtp',
              html: rejTpl.html
            });
          } else {
            await sendDualNotification({
              recipientId: recipient.id,
              recipientEmail: recipient.email,
              type: 'leave-rejected-fyi',
              title: rejTpl.subject,
              emailMessage: rejTpl.subject,
              inAppMessage: `${employeeName}'s ${params.leaveType} leave was rejected.`,
              relatedId: params.requestId,
              provider: 'smtp',
              html: rejTpl.html
            });
          }
        }
      }

      await insertActivityLog({
        actorId: params.actorId,
        actorName: params.actorName,
        actionType: params.status === 'approved' ? 'LEAVE_APPROVE' : 'LEAVE_REJECT',
        module: 'LEAVE',
        description: `${params.status === 'approved' ? 'Approved' : 'Rejected'} ${params.leaveType} leave for ${employeeName}`,
        payload: params
      });
    } catch (error) {
      console.error('HRNotificationService.notifyLeaveDecision failed:', error);
    }
  }

  /**
   * Performance Update: Notify Employee + HOD
   */
  static async notifyPerformanceUpdate(params: {
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    periodLabel: string;
    finalScore: number;
    maxScore: number;
    grade?: string;
    breakdown?: { label: string; score: number | string }[];
    remarks?: string;
    actorId: string;
    actorName: string;
  }) {
    try {
      const employeeName = safeDecode(params.employeeName);
      const actorName = safeDecode(params.actorName);
      const timestamp = new Date().toLocaleString();
      const details: PerformanceDetails = {
        employeeName,
        period: params.periodLabel,
        overallScore: params.finalScore,
        maxScore: params.maxScore,
        grade: params.grade,
        recordedBy: actorName,
        timestamp,
        breakdown: params.breakdown,
        remarks: params.remarks
      };

      // 1. Notify Employee (Template 4A)
      const empTpl = emailTemplates.performanceUpdatedEmployee(details);
      await sendDualNotification({
        recipientId: params.employeeId,
        recipientEmail: params.employeeEmail,
        type: 'performance-updated',
        title: empTpl.subject,
        emailMessage: empTpl.subject,
        inAppMessage: `Your performance score for ${params.periodLabel} has been recorded.`,
        relatedId: params.employeeId,
        provider: 'smtp',
        html: empTpl.html
      });

      // 2. Notify HOD (Template 4B)
      const employeeRecord = await getUser(params.employeeId);
      const hod = employeeRecord?.reportsToId ? await getUser(employeeRecord.reportsToId) : null;
      if (hod) {
        const hodTpl = emailTemplates.performanceUpdatedHOD(details, hod.name);
        await sendDualNotification({
          recipientId: hod.id,
          recipientEmail: hod.email,
          type: 'performance-fyi',
          title: hodTpl.subject,
          emailMessage: hodTpl.subject,
          inAppMessage: `Performance score updated for ${employeeName}.`,
          relatedId: params.employeeId,
          provider: 'smtp',
          html: hodTpl.html
        });
      }

      await insertActivityLog({
        actorId: params.actorId,
        actorName: params.actorName,
        actionType: 'PERFORMANCE_UPDATE',
        module: 'PERFORMANCE',
        description: `Updated performance score for ${employeeName} (${params.periodLabel}: ${params.finalScore})`,
        payload: params
      });
    } catch (error) {
      console.error('HRNotificationService.notifyPerformanceUpdate failed:', error);
    }
  }

  /**
   * Penalty: Notify Staff + HOD
   */
  static async notifyPenaltyAction(params: {
    penaltyId: string;
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    penaltyType: string;
    incidentDate: string;
    amount: string;
    description: string;
    action: 'created' | 'updated' | 'resolved';
    actorId: string;
    actorName: string;
  }) {
    try {
      const actorName = safeDecode(params.actorName);
      const employeeName = safeDecode(params.employeeName);

      const details: PenaltyDetails = {
        employeeName,
        penaltyType: params.penaltyType,
        incidentDate: params.incidentDate,
        amount: params.amount,
        recordedBy: actorName,
        timestamp: new Date().toLocaleString(),
        description: params.description
      };

      // 1. Notify Employee (Template 5A)
      const empTpl = emailTemplates.penaltyIssuedEmployee(details);
      await sendDualNotification({
        recipientId: params.employeeId,
        recipientEmail: params.employeeEmail,
        type: 'penalty-action',
        title: empTpl.subject,
        emailMessage: empTpl.subject,
        inAppMessage: `A penalty notice (${params.penaltyType}) has been issued for your profile.`,
        relatedId: params.penaltyId,
        provider: 'smtp',
        html: empTpl.html
      });

      // 2. Notify HOD (Template 5B)
      const employeeRecord = await getUser(params.employeeId);
      const hod = employeeRecord?.reportsToId ? await getUser(employeeRecord.reportsToId) : null;
      if (hod) {
        const hodTpl = emailTemplates.penaltyIssuedHOD(details, hod.name);
        await sendDualNotification({
          recipientId: hod.id,
          recipientEmail: hod.email,
          type: 'penalty-fyi',
          title: hodTpl.subject,
          emailMessage: hodTpl.subject,
          inAppMessage: `A penalty notice was issued for ${employeeName}.`,
          relatedId: params.penaltyId,
          provider: 'smtp',
          html: hodTpl.html
        });
      }

      await insertActivityLog({
        actorId: params.actorId,
        actorName,
        actionType: `PENALTY_${params.action.toUpperCase()}`,
        module: 'PENALTY',
        description: `${params.action} penalty (${params.penaltyType}) for ${employeeName}`,
        payload: params
      });
    } catch (error) {
      console.error('HRNotificationService.notifyPenaltyAction failed:', error);
    }
  }

  /**
   * Activity Score: Notify Employee
   */
  static async notifyActivityScore(params: {
    employeeId: string;
    employeeName: string;
    activityName: string;
    score: number;
    category: string;
    bucket: string;
    date: string;
    actorName: string;
  }) {
    try {
      if (params.activityName.startsWith('Worksheet Adjustment:')) {
        console.log(`[Notification] Suppressing notification for Worksheet Adjustment for ${params.employeeName}`);
        return;
      }

      const employeeRecord = await getUser(params.employeeId);
      if (!employeeRecord) return;

      const timestamp = new Date().toLocaleString();
      const actorName = safeDecode(params.actorName);
      const employeeName = safeDecode(params.employeeName);
      const activityName = safeDecode(params.activityName);

      const tpl = emailTemplates.activityScoreAdded({
        employeeName,
        activityName,
        score: params.score,
        category: params.category,
        bucket: params.bucket,
        date: params.date,
        recordedBy: actorName,
        timestamp
      });

      await sendDualNotification({
        recipientId: params.employeeId,
        recipientEmail: employeeRecord.email || '',
        type: 'performance-updated',
        title: tpl.subject,
        emailMessage: tpl.subject,
        inAppMessage: `New activity score recorded: ${params.activityName} (${params.score} pts)`,
        relatedId: params.employeeId,
        provider: 'smtp',
        html: tpl.html
      });

      await insertActivityLog({
        actorId: 'system', // or from params if we pass actorId
        actorName,
        actionType: 'ACTIVITY_SCORE_ADD',
        module: 'PERFORMANCE',
        description: `Recorded activity score for ${employeeName}: ${activityName}`,
        payload: params
      });
    } catch (error) {
      console.error('HRNotificationService.notifyActivityScore failed:', error);
    }
  }

  /**
   * Manual Balance Update: Notify Employee
   */
  static async notifyLeaveBalanceUpdate(params: {
    employeeId: string;
    employeeName: string;
    leaveType: string;
    newBalance: number;
    year: number;
    actorName: string;
  }) {
    try {
      const employee = await getUser(params.employeeId);
      if (!employee) return;

      const timestamp = new Date().toLocaleString();
      const employeeName = safeDecode(params.employeeName);
      const actorName = safeDecode(params.actorName);

      await sendDualNotification({
        recipientId: params.employeeId,
        recipientEmail: employee.email || `${params.employeeId}@ezeetechnosys.com.my`,
        type: 'balance-updated',
        title: 'Leave Balance Updated',
        emailMessage: `Your ${params.leaveType} leave balance for ${params.year} has been manually adjusted to ${params.newBalance} days by ${actorName}.`,
        inAppMessage: `Your ${params.leaveType} balance for ${params.year} was updated to ${params.newBalance} days.`,
        relatedId: params.employeeId,
        provider: 'smtp',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #4f7fff;">Leave Balance Adjusted</h2>
            <p>Hello ${employeeName},</p>
            <p>An administrator has manually updated your leave entitlement for the year <b>${params.year}</b>.</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 5px 0;"><b>Leave Type:</b> ${params.leaveType}</p>
              <p style="margin: 5px 0;"><b>New Balance:</b> ${params.newBalance} Day(s)</p>
              <p style="margin: 5px 0;"><b>Updated By:</b> ${actorName}</p>
              <p style="margin: 5px 0;"><b>Date:</b> ${timestamp}</p>
            </div>
            <p style="font-size: 13px; color: #64748b;">Please check your Employee Portal for the latest records.</p>
          </div>
        `
      });

      await insertActivityLog({
        actorId: 'system',
        actorName,
        actionType: 'LEAVE_BALANCE_OVERRIDE',
        module: 'LEAVE',
        description: `Manually updated ${params.leaveType} balance for ${employeeName} to ${params.newBalance}`,
        payload: params
      });
    } catch (error) {
      console.error('HRNotificationService.notifyLeaveBalanceUpdate failed:', error);
    }
  }

  /**
   * New User Created: Notify Employee
   */
  static async notifyUserWelcome(params: {
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    role: string;
    dept: string;
    joinDate: string;
    status: string;
    tempPassword?: string;
  }) {
    try {
      const employeeName = safeDecode(params.employeeName);
      const timestamp = new Date().toLocaleString();

      const tpl = emailTemplates.welcomeNewUser({
        employeeName,
        email: params.employeeEmail,
        role: params.role,
        dept: params.dept,
        joinDate: params.joinDate,
        status: params.status,
        timestamp,
        tempPassword: params.tempPassword
      });

      await sendDualNotification({
        recipientId: params.employeeId,
        recipientEmail: params.employeeEmail,
        type: 'user-welcome',
        title: tpl.subject,
        emailMessage: tpl.subject,
        inAppMessage: params.status === 'pending' 
          ? `Welcome, ${employeeName}! Your account has been created and is awaiting HOD activation.`
          : `Welcome, ${employeeName}! Your account has been created.`,
        relatedId: params.employeeId,
        provider: 'smtp',
        html: tpl.html
      });

    } catch (error) {
      console.error('HRNotificationService.notifyUserWelcome failed:', error);
    }
  }

  /**
   * Account Activated: Notify Employee
   */
  static async notifyAccountActivation(params: {
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    tempPassword?: string;
  }) {
    try {
      const employeeName = safeDecode(params.employeeName);
      const timestamp = new Date().toLocaleString();

      const tpl = emailTemplates.accountActivated({
        employeeName,
        email: params.employeeEmail,
        timestamp,
        tempPassword: params.tempPassword
      });

      await sendDualNotification({
        recipientId: params.employeeId,
        recipientEmail: params.employeeEmail,
        type: 'user-activation',
        title: tpl.subject,
        emailMessage: tpl.subject,
        inAppMessage: `Congratulations, ${employeeName}! Your account has been activated.`,
        relatedId: params.employeeId,
        provider: 'smtp',
        html: tpl.html
      });

    } catch (error) {
      console.error('HRNotificationService.notifyAccountActivation failed:', error);
    }
  }
}
