import { safeJsonParse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';

export type AuditEventType =
  | 'feb-cleanse'
  | 'year-end-archive'
  | 'manual-override'
  | 'system-settings'
  | 'leave-request'
  | 'leave-year-end'
  | 'leave-year'
  | 'performance-score'
  | 'performance-config'
  | 'penalty-record'
  | 'employee-profile'
  | 'system-maintenance'
  | 'user-management';

export async function insertSystemAuditLog(
  eventType: AuditEventType,
  action: string,
  actor: string,
  payload: unknown,
) {
  try {
    await prisma.system_audit_logs.create({
      data: {
        event_type: eventType,
        action,
        actor: actor || 'system',
        payload_json: JSON.stringify(payload ?? {}),
        created_at: new Date(),
      }
    });
  } catch (error) {
    console.error(`insertSystemAuditLog failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Non-blocking
  }
}

export async function listSystemAuditLogs(limit = 50, eventType?: string) {
  const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(200, limit)) : 50;

  const data = await prisma.system_audit_logs.findMany({
    where: eventType && eventType.trim() ? { event_type: eventType.trim() } : undefined,
    orderBy: { log_id: 'desc' },
    take: safeLimit
  });

  return (data ?? []).map((row) => ({
    logId: Number(row.log_id),
    eventType: row.event_type,
    action: row.action,
    actor: row.actor,
    payload: safeJsonParse(row.payload_json, {}),
    createdAt: row.created_at ? row.created_at.toISOString() : undefined,
  }));
}

export async function deleteSystemAuditLog(logId: number) {
  await prisma.system_audit_logs.delete({
    where: { log_id: BigInt(logId) }
  });
}

export async function clearAllSystemAuditLogs() {
  await prisma.system_audit_logs.deleteMany({});
}
