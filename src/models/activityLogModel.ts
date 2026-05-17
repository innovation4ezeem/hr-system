import { prisma } from '@/lib/prisma';

export type ActivityLog = {
  id?: string;
  actorId: string;
  actorName?: string;
  actionType: string;
  module: string;
  description?: string;
  payload?: any;
  createdAt?: string;
};

export async function insertActivityLog(log: ActivityLog) {
  const payload = {
    actorId: log.actorId,
    actorName: log.actorName ?? null,
    actionType: log.actionType,
    module: log.module,
    description: log.description ?? null,
    payload: log.payload ?? null,
    createdAt: new Date().toISOString(),
  };

  try {
    await prisma.system_audit_logs.create({
      data: {
        event_type: log.module,
        action: log.actionType,
        actor: log.actorName || log.actorId || 'system',
        payload_json: JSON.stringify(payload),
        created_at: new Date(),
      }
    });
  } catch (error) {
    console.error('Failed to insert activity log:', error);
  }
}
