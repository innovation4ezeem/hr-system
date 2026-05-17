import { listSystemAuditLogs } from '@/models/systemAuditLogModel';

export async function getSystemAuditLogsController(limit: number, eventType?: string) {
  return listSystemAuditLogs(limit, eventType);
}
export async function deleteSystemAuditLogController(logId: number) {
  const { deleteSystemAuditLog } = await import('@/models/systemAuditLogModel');
  return deleteSystemAuditLog(logId);
}

export async function clearAllSystemAuditLogsController() {
  const { clearAllSystemAuditLogs } = await import('@/models/systemAuditLogModel');
  return clearAllSystemAuditLogs();
}
