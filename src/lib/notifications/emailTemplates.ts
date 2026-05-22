/**
 * HR System Email Templates
 */

export const COMPANY_NAME = 'EzeemOps';

export type LeaveDetails = {
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  units: number;
  reason: string;
  timestamp: string;
  dept?: string;
  actionBy?: string;
  remarks?: string;
  balance?: number;
  id?: string;
};

export type PerformanceDetails = {
  employeeName: string;
  period: string;
  overallScore: number;
  maxScore: number;
  grade?: string;
  recordedBy: string;
  timestamp: string;
  breakdown?: { label: string; score: number | string }[];
  remarks?: string;
};

export type PenaltyDetails = {
  employeeName: string;
  penaltyType: string;
  incidentDate: string;
  amount: string;
  recordedBy: string;
  timestamp: string;
  description: string;
};

export const emailTemplates = {
  // TRIGGER 1A: Employee submits leave application (To Employee)
  leaveSubmittedEmployee: (d: LeaveDetails) => ({
    subject: `Leave Application Received — ${d.leaveType} | ${d.startDate} to ${d.endDate}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <p>Dear ${d.employeeName},</p>
        <p>Your leave application has been successfully submitted and is pending approval.</p>
        <p><strong>Details:</strong><br/>
        • Leave type: ${d.leaveType}<br/>
        • From: ${d.startDate}<br/>
        • To: ${d.endDate}<br/>
        • Total days: ${d.units} day(s)<br/>
        • Reason: ${d.reason}<br/>
        • Applied on: ${d.timestamp}</p>
        <p>Your HOD and admin team have been notified. You will receive an update once a decision is made.</p>
        <p>If you need to cancel or amend this request, please log in to the system before it is reviewed.</p>
        <p>Regards,<br/>${COMPANY_NAME} HR System</p>
      </div>
    `
  }),

  // TRIGGER 1B: Employee submits leave application (To HOD/Admin)
  leaveSubmittedManager: (d: LeaveDetails, managerName: string) => ({
    subject: `[Action Required] Leave Request from ${d.employeeName} — ${d.startDate} to ${d.endDate}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <p>Dear ${managerName},</p>
        <p>A new leave application has been submitted and requires your review.</p>
        <p><strong>Employee:</strong> ${d.employeeName}<br/>
        <strong>Department:</strong> ${d.dept || '-'}<br/>
        <strong>Leave type:</strong> ${d.leaveType}<br/>
        <strong>From:</strong> ${d.startDate}<br/>
        <strong>To:</strong> ${d.endDate}<br/>
        <strong>Total days:</strong> ${d.units} day(s)<br/>
        <strong>Reason:</strong> ${d.reason}</p>
        
        <div style="margin: 25px 0;">
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/manager-dashboard/leave?requestId=${d.id}&action=approve" 
             style="background-color: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 10px; display: inline-block;">
             Approve Request
          </a>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/manager-dashboard/leave?requestId=${d.id}&action=reject" 
             style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
             Reject Request
          </a>
        </div>

        <p style="font-size: 13px; color: #64748b;">Note: You will be prompted to log in if you are not already authenticated.</p>
        <p>Regards,<br/>${COMPANY_NAME} HR System</p>
      </div>
    `
  }),

  // TRIGGER 2A: Leave Approved (To Employee)
  leaveApprovedEmployee: (d: LeaveDetails) => ({
    subject: `Leave Approved — ${d.leaveType} | ${d.startDate} to ${d.endDate}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <p>Dear ${d.employeeName},</p>
        <p>Your leave request has been approved.</p>
        <p><strong>Details:</strong><br/>
        • Leave type: ${d.leaveType}<br/>
        • Approved from: ${d.startDate}<br/>
        • Approved to: ${d.endDate}<br/>
        • Total days approved: ${d.units} day(s)<br/>
        • Approved by: ${d.actionBy}<br/>
        • Approved on: ${d.timestamp}<br/>
        • Remarks: ${d.remarks || '—'}</p>
        <p>Please ensure your responsibilities are properly handed over before your leave begins.</p>
        <p>Remaining leave balance: ${d.balance !== undefined ? d.balance : '—'} day(s)</p>
        <p>Regards,<br/>${COMPANY_NAME} HR System</p>
      </div>
    `
  }),

  // TRIGGER 2B: Leave Approved (To Other Party)
  leaveApprovedFYI: (d: LeaveDetails, recipientName: string) => ({
    subject: `FYI — Leave Approved for ${d.employeeName} by ${d.actionBy}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <p>Dear ${recipientName},</p>
        <p>This is an automated notification. ${d.actionBy} has approved a leave request.</p>
        <p><strong>Employee:</strong> ${d.employeeName}<br/>
        <strong>Department:</strong> ${d.dept || '-'}<br/>
        <strong>Leave type:</strong> ${d.leaveType}<br/>
        <strong>Period:</strong> ${d.startDate} – ${d.endDate} (${d.units} days)<br/>
        <strong>Approved on:</strong> ${d.timestamp}</p>
        <p>No action is required unless further review is needed.</p>
        <p>Regards,<br/>${COMPANY_NAME} HR System</p>
      </div>
    `
  }),

  // TRIGGER 3A: Leave Rejected (To Employee & Admin Copy)
  leaveRejected: (d: LeaveDetails, recipientName: string) => ({
    subject: `Leave Request Not Approved — ${d.leaveType} | ${d.startDate} to ${d.endDate}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <p>Dear ${recipientName},</p>
        <p>We regret to inform you that your leave request has not been approved.</p>
        <p><strong>Details:</strong><br/>
        • Leave type: ${d.leaveType}<br/>
        • Requested from: ${d.startDate}<br/>
        • Requested to: ${d.endDate}<br/>
        • Rejected by: ${d.actionBy}<br/>
        • Rejected on: ${d.timestamp}<br/>
        • Reason for rejection: ${d.remarks || 'No reason provided'}</p>
        <p>If you have questions or wish to re-apply with updated details, please contact your HOD or the HR department directly.</p>
        <p>Regards,<br/>${COMPANY_NAME} HR System</p>
      </div>
    `
  }),

  // TRIGGER 4A: Performance Score (To Employee)
  performanceUpdatedEmployee: (d: PerformanceDetails) => ({
    subject: `Your Performance Score Has Been Updated — ${d.period}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <p>Dear ${d.employeeName},</p>
        <p>Your performance score for ${d.period} has been recorded by the admin team.</p>
        <p><strong>Score summary:</strong><br/>
        • Review period: ${d.period}<br/>
        • Overall score: ${d.overallScore} / ${d.maxScore}<br/>
        • Grade / Rating: ${d.grade || '—'}<br/>
        • Recorded by: ${d.recordedBy}<br/>
        • Recorded on: ${d.timestamp}</p>
        <p><strong>Score breakdown:</strong><br/>
        ${(d.breakdown || []).map(b => `• ${b.label}: ${b.score}`).join('<br/>')}</p>
        <p>Remarks from admin: ${d.remarks || '—'}</p>
        <p>Please log in to view the full performance report. If you have any queries, speak to your HOD or HR.</p>
        <p>Regards,<br/>${COMPANY_NAME} HR System</p>
      </div>
    `
  }),

  // TRIGGER 4B: Performance Score (To HOD)
  performanceUpdatedHOD: (d: PerformanceDetails, hodName: string) => ({
    subject: `Performance Score Recorded for ${d.employeeName} — ${d.period}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <p>Dear ${hodName},</p>
        <p>This is an automated notification. Admin has recorded a performance score for one of your team members.</p>
        <p><strong>Employee:</strong> ${d.employeeName}<br/>
        <strong>Review period:</strong> ${d.period}<br/>
        <strong>Overall score:</strong> ${d.overallScore} / ${d.maxScore}<br/>
        <strong>Recorded on:</strong> ${d.timestamp}</p>
        <p>Please log in to review the full details.</p>
        <p>Regards,<br/>${COMPANY_NAME} HR System</p>
      </div>
    `
  }),

  // TRIGGER 5A: Penalty Notice (To Employee)
  penaltyIssuedEmployee: (d: PenaltyDetails) => ({
    subject: `Penalty Notice Issued — ${d.penaltyType} | ${d.incidentDate}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <p>Dear ${d.employeeName},</p>
        <p>A penalty has been recorded on your profile by the admin team. Please review the details below.</p>
        <p><strong>Penalty details:</strong><br/>
        • Penalty type: ${d.penaltyType}<br/>
        • Date of incident: ${d.incidentDate}<br/>
        • Penalty amount / deduction: ${d.amount}<br/>
        • Recorded by: ${d.recordedBy}<br/>
        • Recorded on: ${d.timestamp}<br/>
        • Description: ${d.description}</p>
        <p>If you believe this penalty has been issued in error, please raise a dispute with your HOD or HR department within working days.</p>
        <p>Regards,<br/>${COMPANY_NAME} HR System</p>
      </div>
    `
  }),

  // TRIGGER 5B: Penalty Notice (To HOD)
  penaltyIssuedHOD: (d: PenaltyDetails, hodName: string) => ({
    subject: `Penalty Recorded for ${d.employeeName} — ${d.penaltyType}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <p>Dear ${hodName},</p>
        <p>Admin has recorded a penalty for one of your team members. Please be aware of the following.</p>
        <p><strong>Employee:</strong> ${d.employeeName}<br/>
        <strong>Penalty type:</strong> ${d.penaltyType}<br/>
        <strong>Date of incident:</strong> ${d.incidentDate}<br/>
        <strong>Penalty amount / deduction:</strong> ${d.amount}<br/>
        <strong>Recorded on:</strong> ${d.timestamp}</p>
        <p>Please log in for full details or follow up with the employee if needed.</p>
        <p>Regards,<br/>${COMPANY_NAME} HR System</p>
      </div>
    `
  }),

  // TRIGGER 6: Individual Activity Score Added (To Employee)
  activityScoreAdded: (d: { employeeName: string; activityName: string; score: number; category: string; bucket: string; date: string; recordedBy: string; timestamp: string }) => ({
    subject: `New Activity Score Recorded — ${d.activityName}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <p>Dear ${d.employeeName},</p>
        <p>A new activity score has been recorded for your profile in the HR system.</p>
        <p><strong>Activity Details:</strong><br/>
        • Activity: ${d.activityName}<br/>
        • Points: <strong>${d.score}</strong><br/>
        • Category: ${d.category} (${d.bucket})<br/>
        • Date of Activity: ${d.date}<br/>
        • Recorded by: ${d.recordedBy}<br/>
        • Recorded on: ${d.timestamp}</p>
        <p>This score will be automatically synced into your performance summary. You can view your full breakdown in the Performance Dashboard.</p>
        <p>Regards,<br/>${COMPANY_NAME} HR System</p>
      </div>
    `
  }),

  // TRIGGER 7: Welcome New User (To Employee)
  welcomeNewUser: (d: { employeeName: string; email: string; role: string; dept: string; joinDate: string; status: string; timestamp: string }) => ({
    subject: `Welcome to ${COMPANY_NAME} HR System! — Your Account has been Created`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <p>Dear ${d.employeeName},</p>
        <p>Welcome to <strong>${COMPANY_NAME}</strong>! Your account for our HR Management System has been successfully created.</p>
        
        ${d.status === 'pending'
        ? `<p style="color: #e67e22; font-weight: bold;">Note: Your account is currently pending activation by your HOD or HR. You will be able to log in once your account is activated.</p>`
        : `<p>You can now log in to the portal to view your profile, apply for leave, and track your performance.</p>`
      }

        <p><strong>Account Details:</strong><br/>
        • Login Email: ${d.email}<br/>
        • Role: ${d.role}<br/>
        • Department: ${d.dept}<br/>
        • Account Status: <span style="text-transform: capitalize;">${d.status}</span><br/>
        • Join Date: ${d.joinDate}<br/>
        • Created on: ${d.timestamp}</p>

        <p><strong>Access the Portal:</strong><br/>
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4028'}/">${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4028'}/</a></p>
        
        ${d.status !== 'pending'
        ? `<p>If you were not provided with a temporary password, please use the <strong>"Forgot Password"</strong> link on the login page to set one.</p>`
        : ''
      }
        
        <p>Regards,<br/>${COMPANY_NAME} HR System</p>
      </div>
    `
  }),

  // TRIGGER 8: Account Activated (To Employee)
  accountActivated: (d: { employeeName: string; email: string; timestamp: string }) => ({
    subject: `Your ${COMPANY_NAME} Account has been Activated!`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <p>Dear ${d.employeeName},</p>
        <p>Great news! Your account for <strong>${COMPANY_NAME}</strong> has been reviewed and activated by the administration.</p>
        <p>You can now log in to the portal using your work email address to access your dashboard, apply for leave, and view your performance records.</p>
        
        <p><strong>Account Info:</strong><br/>
        • Login Email: ${d.email}<br/>
        • Status: <span style="color: #059669; font-weight: bold;">Active</span><br/>
        • Activated on: ${d.timestamp}</p>

        <p><strong>Get Started:</strong><br/>
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4028'}/" 
           style="background-color: #4f7fff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-top: 10px;">
           Sign In to Portal
        </a></p>

        <p>If you don't have your password yet, please use the "Forgot Password" link on the login screen.</p>
        <p>Regards,<br/>${COMPANY_NAME} HR System</p>
      </div>
    `
  }),

  // TRIGGER 9: Password Reset (To Employee)
  passwordReset: (d: { employeeName: string; resetLink: string; tempPassword?: string }) => ({
    subject: `Password Recovery — ${COMPANY_NAME} HR System`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; color: #333;">
        <h2 style="color: #1e293b; margin-top: 0; border-bottom: 2px solid #4f7fff; padding-bottom: 10px; display: inline-block;">Password Recovery</h2>
        <p>Hello ${d.employeeName},</p>
        <p>We received a request to recover your password for your <strong>${COMPANY_NAME}</strong> account.</p>
        
        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0;">
          ${d.tempPassword ? `
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b; font-weight: 500;">Your Temporary Password:</p>
          <p style="margin: 0; font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #0f172a; background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block;">${d.tempPassword}</p>
          <p style="margin: 15px 0 20px 0; font-size: 12px; color: #94a3b8; line-height: 1.4;">Use this password to sign in immediately.<br/>You can change it later in your profile settings.</p>
          ` : ''}
          
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4028'}/"
             style="display: inline-block; padding: 14px 40px; background-color: #4f7fff; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 12px rgba(79, 127, 255, 0.25);">
            Sign In to Portal
          </a>
        </div>

        <p style="color: #64748b; font-size: 13px; margin-top: 30px;">Alternatively, you can manually reset your password using the link below:</p>
        <p style="color: #94a3b8; font-size: 11px; word-break: break-all; background: #f1f5f9; padding: 8px; border-radius: 4px;">${d.resetLink}</p>
        
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">
          If you did not request this, you can safely ignore this email.<br/>
          &copy; ${new Date().getFullYear()} ${COMPANY_NAME} HR System
        </p>
      </div>
    `
  }),
};
