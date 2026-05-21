import {
  clearNotificationsForRecipient,
  createNotification,
  getNotifications,
  markNotificationAsRead,
  type NotificationType,
  type NotificationChannel,
  type NotificationProvider,
} from '@/models/notificationModel';
import nodemailer from 'nodemailer';

type MailProvider = 'gmail' | 'outlook' | 'smtp';

function toNotificationProvider(provider: MailProvider): NotificationProvider {
  return provider;
}

function getMailTransport(provider: MailProvider) {
  const timeoutSettings = {
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 15000,
  };

  // 0. Prioritize generic SMTP if requested explicitly
  if (provider === 'smtp') {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT || 587);

    if (host && user && pass) {
      return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
        ...timeoutSettings
      });
    }
  }

  // 1. Prioritize Gmail if credentials exist (more reliable for Gmail than generic SMTP)
  if (provider === 'gmail' && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      ...timeoutSettings
    });
  }

  // 2. Prioritize Outlook if credentials exist
  if (provider === 'outlook' && process.env.OUTLOOK_USER && process.env.OUTLOOK_PASSWORD) {
    return nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.OUTLOOK_USER,
        pass: process.env.OUTLOOK_PASSWORD,
      },
      ...timeoutSettings
    });
  }

  // 3. Fallback to generic SMTP
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      ...timeoutSettings
    });
  }

  return null;
}

function getFallbackTransportProviders(provider: MailProvider): MailProvider[] {
  if (provider === 'gmail') return ['outlook', 'smtp'];
  if (provider === 'outlook') return ['gmail', 'smtp'];
  if (provider === 'smtp') return ['outlook', 'gmail'];
  return [];
}

export async function sendEmailNotification(
  recipientEmail: string,
  title: string,
  message: string,
  provider: MailProvider,
  html?: string,
): Promise<boolean> {
  if (!recipientEmail || !recipientEmail.includes('@')) {
    console.warn(`[sendEmailNotification] Invalid or missing recipient email: "${recipientEmail}"`);
    return false;
  }

  const attemptSend = async (mailProvider: MailProvider) => {
    const transport = getMailTransport(mailProvider);

    if (!transport) {
      return null;
    }

    return transport.sendMail({
      from: process.env.MAIL_FROM || `EzeemOps <${process.env.SMTP_USER || process.env.OUTLOOK_USER || process.env.GMAIL_USER || 'no-reply@ezeetechnosys.com.my'}>`,
      to: recipientEmail,
      subject: `[EzeemOps] ${title}`,
      text: message,
      html: html || `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e293b; margin-top: 0;">${title}</h2>
          <p style="color: #475569; line-height: 1.6;">${message}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94a3b8;">This is an automated message from EzeemOps Internal System. Please do not reply directly.</p>
        </div>
      `,
    });
  };

  const providersToTry: MailProvider[] = [provider, ...getFallbackTransportProviders(provider)];
  let lastError: unknown = null;

  for (const currentProvider of providersToTry) {
    try {
      const info = await attemptSend(currentProvider);
      if (!info) {
        continue;
      }

      console.log(`Email sent successfully via ${currentProvider}: ${info.messageId}`);
      return true;
    } catch (error) {
      lastError = error;
      const authFailed = error instanceof Error && (error.message.includes('Invalid login') || (error as { code?: string }).code === 'EAUTH');

      if (authFailed) {
        console.error(`Email auth failed for ${currentProvider}; trying fallback transport if available.`);
        continue;
      }

      console.error('Failed to send email:', error);
      break;
    }
  }

  if (!providersToTry.length || providersToTry.every(currentProvider => !getMailTransport(currentProvider))) {
    console.log(`\n--- [${provider.toUpperCase()} NOTIFICATION] ---`);
    console.log(`TO: ${recipientEmail}`);
    console.log(`SUBJECT: ${title}`);
    console.log(`BODY: ${message}`);
    console.log(`------------------------------------------\n`);
    return true;
  }

  if (lastError) {
    console.error('Failed to send email after trying available transports:', lastError);
  }

  return false;
}

export async function sendDualNotification(params: {
  recipientId: string;
  recipientEmail: string;
  type: string;
  title: string;
  emailMessage: string;
  inAppMessage: string;
  relatedId: string;
  provider: MailProvider;
  html?: string;
}) {
  // Check global silent mode from headers
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    const isSilent = h.get('x-silent-mode') === 'true';
    if (isSilent) {
      console.log(`[Silent Mode] Suppressing notification for ${params.recipientId} (${params.type})`);
      return;
    }
  } catch (err) {
    // Fallback if headers() is called outside of request context (e.g. background job)
  }

  if (params.recipientEmail && params.recipientEmail.includes('@')) {
    sendEmailNotification(
      params.recipientEmail,
      params.title,
      params.emailMessage,
      params.provider,
      params.html,
    ).catch(err => console.error('[sendDualNotification] Background email send failed:', err));
  } else {
    console.warn(`[sendDualNotification] Skipping email for ${params.recipientId} because email is missing or invalid: "${params.recipientEmail}"`);
  }

  await createNotification({
    recipientId: params.recipientId,
    recipientEmail: params.recipientEmail,
    type: params.type as NotificationType,
    title: params.title,
    message: params.emailMessage,
    channel: 'email' as NotificationChannel,
    provider: toNotificationProvider(params.provider),
    relatedId: params.relatedId,
    read: false,
  });

  await createNotification({
    recipientId: params.recipientId,
    recipientEmail: params.recipientEmail,
    type: params.type as NotificationType,
    title: params.title,
    message: params.inAppMessage,
    channel: 'in-app' as NotificationChannel,
    provider: 'system',
    relatedId: params.relatedId,
    read: false,
  });
}

async function createDualChannelNotifications(params: {
  recipientId: string;
  recipientEmail: string;
  type: NotificationType;
  title: string;
  emailMessage: string;
  inAppMessage: string;
  relatedId: string;
  provider: MailProvider;
}) {
  await createNotification({
    recipientId: params.recipientId,
    recipientEmail: params.recipientEmail,
    type: params.type,
    title: params.title,
    message: params.emailMessage,
    channel: 'email' as NotificationChannel,
    provider: toNotificationProvider(params.provider),
    relatedId: params.relatedId,
    read: false,
  });

  await createNotification({
    recipientId: params.recipientId,
    recipientEmail: params.recipientEmail,
    type: params.type,
    title: params.title,
    message: params.inAppMessage,
    channel: 'in-app' as NotificationChannel,
    provider: 'system',
    relatedId: params.relatedId,
    read: false,
  });
}

export async function sendVerificationEmailController(params: {
  recipientEmail: string;
  recipientName: string;
  verificationLink: string;
  preferredProvider?: MailProvider;
}): Promise<void> {
  const provider = (params.preferredProvider || 'smtp') as MailProvider;
  const title = 'Verify Your Account';
  const emailMessage = `Hello ${params.recipientName}, please verify your account by clicking this link: ${params.verificationLink}`;

  sendEmailNotification(
    params.recipientEmail,
    title,
    emailMessage,
    provider,
    `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h1 style="color: #1e293b; margin-top: 0;">Verify Your Account</h1>
      <p style="color: #475569; line-height: 1.6;">Hello ${params.recipientName},</p>
      <p style="color: #475569; line-height: 1.6;">Thank you for registering with EzeemOps. Please click the button below to verify your account and get started:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${params.verificationLink}" style="background: #4f7fff; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Verify Account</a>
      </div>
      <p style="color: #64748b; font-size: 14px;">If the button above doesn't work, copy and paste this link into your browser:</p>
      <p style="color: #94a3b8; font-size: 12px; word-break: break-all;">${params.verificationLink}</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #94a3b8;">If you did not create this account, you can safely ignore this email.</p>
    </div>
    `,
  ).catch(err => console.error('[sendVerificationEmail] Background email send failed:', err));
}

export async function sendPasswordResetEmailController(params: {
  recipientEmail: string;
  recipientName: string;
  resetLink: string;
  tempPassword?: string;
  preferredProvider?: MailProvider;
}): Promise<void> {
  const provider = (params.preferredProvider || 'smtp') as MailProvider;
  const { emailTemplates } = await import('@/lib/notifications/emailTemplates');
  const tpl = emailTemplates.passwordReset({
    employeeName: params.recipientName,
    resetLink: params.resetLink,
    tempPassword: params.tempPassword
  });

  sendEmailNotification(
    params.recipientEmail,
    tpl.subject,
    tpl.subject, // Text version
    provider,
    tpl.html
  ).catch(err => console.error('[sendPasswordResetEmail] Background email send failed:', err));
}

export async function sendLeaveSubmissionNotificationController(params: {
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  units: number;
  requestId: string;
  approvalUrl: string;
  preferredProvider?: MailProvider;
}): Promise<void> {
  const provider = (params.preferredProvider || 'smtp') as MailProvider;
  const title = 'Leave Request Pending Approval';
  const emailMessage = `${params.employeeName} submitted ${params.leaveType} leave (${params.startDate} to ${params.endDate}, ${params.units} day(s)). Review at: ${params.approvalUrl}`;
  const inAppMessage = `${params.employeeName} submitted a leave request awaiting your approval.`;

  sendEmailNotification(
    params.recipientEmail,
    title,
    emailMessage,
    provider,
    `<h2>Leave Approval Needed</h2><p>Hello ${params.recipientName},</p><p>${params.employeeName} submitted ${params.leaveType} leave (${params.startDate} to ${params.endDate}, ${params.units} day(s)).</p><p><a href="${params.approvalUrl}">Open Approval</a></p>`,
  ).catch(err => console.error('[sendLeaveSubmissionNotification] Background email send failed:', err));

  await createDualChannelNotifications({
    recipientId: params.recipientId,
    recipientEmail: params.recipientEmail,
    type: 'leave-submitted',
    title,
    emailMessage,
    inAppMessage,
    relatedId: params.requestId,
    provider,
  });
}

export async function sendLeaveApprovalNotificationController(params: {
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  approvedBy: string;
  requestId: string;
  preferredProvider?: MailProvider;
}): Promise<void> {
  const provider = (params.preferredProvider || 'smtp') as MailProvider;
  const title = 'Leave Request Approved';
  const emailMessage = `Your ${params.leaveType} leave request from ${params.startDate} to ${params.endDate} has been approved by ${params.approvedBy}.`;
  const inAppMessage = `Your ${params.leaveType} leave from ${params.startDate} has been approved.`;

  sendEmailNotification(params.recipientEmail, title, emailMessage, provider)
    .catch(err => console.error('[sendLeaveApprovalNotification] Background email send failed:', err));

  await createDualChannelNotifications({
    recipientId: params.recipientId,
    recipientEmail: params.recipientEmail,
    type: 'leave-approved',
    title,
    emailMessage,
    inAppMessage,
    relatedId: params.requestId,
    provider,
  });
}

export async function sendLeaveRejectionNotificationController(params: {
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  rejectionReason: string;
  rejectedBy: string;
  requestId: string;
  preferredProvider?: MailProvider;
}): Promise<void> {
  const provider = (params.preferredProvider || 'smtp') as MailProvider;
  const title = 'Leave Request Rejected';
  const emailMessage = `Your ${params.leaveType} leave request from ${params.startDate} to ${params.endDate} has been rejected by ${params.rejectedBy}. Reason: ${params.rejectionReason}`;
  const inAppMessage = `Your ${params.leaveType} leave from ${params.startDate} was rejected. Reason: ${params.rejectionReason}`;

  sendEmailNotification(params.recipientEmail, title, emailMessage, provider)
    .catch(err => console.error('[sendLeaveRejectionNotification] Background email send failed:', err));

  await createDualChannelNotifications({
    recipientId: params.recipientId,
    recipientEmail: params.recipientEmail,
    type: 'leave-rejected',
    title,
    emailMessage,
    inAppMessage,
    relatedId: params.requestId,
    provider,
  });
}

export async function getEmployeeNotificationsController(employeeId: string): Promise<any> {
  const allNotifications = await getNotifications(employeeId);
  const unreadCount = allNotifications.filter(n => !n.read).length;

  return {
    notifications: allNotifications,
    unreadCount,
  };
}

export async function markNotificationReadController(notificationId: string): Promise<void> {
  await markNotificationAsRead(notificationId);
}

export async function clearAllNotificationsController(employeeId: string): Promise<void> {
  await clearNotificationsForRecipient(employeeId);
}
