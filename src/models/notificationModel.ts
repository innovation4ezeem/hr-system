import { prisma } from '@/lib/prisma';

export type NotificationType =
  | 'leave-approved'
  | 'leave-rejected'
  | 'leave-submitted'
  | 'leave-inquiry'
  | 'leave-inquiry-response'
  | string; // allow future types
export type NotificationChannel = 'email' | 'in-app' | 'sms';
export type NotificationProvider = 'gmail' | 'outlook' | 'smtp' | 'system' | 'in-app';

export type Notification = {
  id: string;
  recipientId: string;
  recipientEmail: string;
  type: NotificationType;
  title: string;
  message: string;
  channel: NotificationChannel;
  provider: NotificationProvider;
  relatedId?: string; // e.g., leave request ID
  read: boolean;
  sentAt: string;
  createdAt: string;
};

export async function createNotification(
  notification: Omit<Notification, 'id' | 'createdAt' | 'sentAt'>,
): Promise<Notification> {
  const id = `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date();

  const data = await prisma.notifications.create({
    data: {
      id,
      recipient_id: notification.recipientId,
      recipient_email: notification.recipientEmail,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      channel: notification.channel as any,
      provider: notification.provider as any,
      related_id: notification.relatedId || null,
      read: notification.read,
      sent_at: now,
      created_at: now,
    }
  });

  return {
    ...notification,
    id,
    sentAt: now.toISOString(),
    createdAt: now.toISOString(),
  };
}

export async function getNotifications(
  recipientId: string,
  unreadOnly: boolean = false,
): Promise<Notification[]> {
  const data = await prisma.notifications.findMany({
    where: {
      recipient_id: recipientId,
      read: unreadOnly ? false : undefined
    },
    orderBy: { created_at: 'desc' }
  });

  return (data ?? []).map((row) => ({
    id: row.id,
    recipientId: row.recipient_id,
    recipientEmail: row.recipient_email,
    type: row.type,
    title: row.title,
    message: row.message,
    channel: row.channel as NotificationChannel,
    provider: row.provider as NotificationProvider,
    relatedId: row.related_id || undefined,
    read: row.read || false,
    sentAt: row.sent_at ? row.sent_at.toISOString() : '',
    createdAt: row.created_at ? row.created_at.toISOString() : '',
  }));
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await prisma.notifications.update({
    where: { id },
    data: { read: true }
  });
}

export async function clearNotificationsForRecipient(recipientId: string): Promise<void> {
  await prisma.notifications.deleteMany({
    where: { recipient_id: recipientId }
  });
}
