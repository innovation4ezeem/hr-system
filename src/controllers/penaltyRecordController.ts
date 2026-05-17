import {
  deletePenaltyRecord,
  listPenaltyRecords,
  type PenaltyRecord,
  upsertPenaltyRecord,
} from '@/models/penaltyRecordModel';
import { listUsers } from '@/models/userModel';
import { HRNotificationService } from '@/lib/notifications/hrNotificationService';

type PenaltyPayload = Partial<PenaltyRecord>;

function normalizeLevel(value: string): PenaltyRecord['level'] {
  return value === 'Minor' || value === 'Major' ? value : 'Warning';
}

function normalizeCategory(value: string): PenaltyRecord['category'] {
  if (value === 'Attendance' || value === 'Policy' || value === 'Conduct' || value === 'Safety') return value;
  return 'Performance';
}

function parseYear(value?: string | number | null) {
  const year = Number(value);
  if (!Number.isFinite(year)) return new Date().getFullYear();
  return Math.trunc(year);
}

function normalizeDate(value: string): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value;
}

export async function getPenaltyRecordsController(year?: number) {
  return listPenaltyRecords(typeof year === 'number' ? { year } : {});
}

export async function createPenaltyRecordController(payload: PenaltyPayload, actor?: { id: string, name: string }) {
  const employeeName = String(payload.employeeName || '').trim();
  const mistake = String(payload.mistake || '').trim();

  if (!employeeName || !mistake) {
    throw new Error('Employee and mistake are required');
  }

  const record: PenaltyRecord = {
    id: String(payload.id || `PEN-${Date.now()}`),
    employeeId: payload.employeeId,
    employeeName,
    dept: String(payload.dept || 'Operations').trim() || 'Operations',
    date: normalizeDate(String(payload.date || '')),
    year: parseYear(payload.year),
    mistake,
    level: normalizeLevel(String(payload.level || 'Warning')),
    category: normalizeCategory(String(payload.category || 'Performance')),
    deducted: Boolean(payload.deducted),
    deductAmount: Number(payload.deductAmount || 0),
    resolved: Boolean(payload.resolved),
    notes: String(payload.notes || ''),
  };

  await upsertPenaltyRecord(record);

  // Notify employee if ID is available
  if (record.employeeId) {
    const users = await listUsers();
    const user = users.find(u => u.id === record.employeeId);
    
    await HRNotificationService.notifyPenaltyAction({
      penaltyId: record.id,
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      employeeEmail: user?.email || '',
      penaltyType: record.category,
      incidentDate: record.date,
      amount: String(record.deductAmount || 0),
      action: 'created',
      actorId: actor?.id || 'admin-001',
      actorName: actor?.name || 'HR Admin',
      description: record.mistake,
    });
  }

  return record;
}

export async function updatePenaltyRecordController(id: string, payload: PenaltyPayload, actor?: { id: string, name: string }) {
  if (!id) throw new Error('Penalty id is required');
  const existing = (await listPenaltyRecords()).find(item => item.id === id);
  if (!existing) throw new Error('Penalty not found');

  const merged = { ...existing, ...payload, id };

  const record: PenaltyRecord = {
    id,
    employeeId: merged.employeeId,
    employeeName: String(merged.employeeName || '').trim(),
    dept: String(merged.dept || 'Operations').trim() || 'Operations',
    date: normalizeDate(String(merged.date || '')),
    year: parseYear(merged.year),
    mistake: String(merged.mistake || '').trim(),
    level: normalizeLevel(String(merged.level || 'Warning')),
    category: normalizeCategory(String(merged.category || 'Performance')),
    deducted: Boolean(merged.deducted),
    deductAmount: Number(merged.deductAmount || 0),
    resolved: Boolean(merged.resolved),
    notes: String(merged.notes || ''),
  };

  if (!record.employeeName || !record.mistake) {
    throw new Error('Employee and mistake are required');
  }

  await upsertPenaltyRecord(record);

  // Notify employee if status changed to resolved or updated
  if (record.employeeId) {
    const action = record.resolved && !existing.resolved ? 'resolved' : 'updated';
    const users = await listUsers();
    const user = users.find(u => u.id === record.employeeId);

    await HRNotificationService.notifyPenaltyAction({
      penaltyId: record.id,
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      employeeEmail: user?.email || '',
      penaltyType: record.category,
      incidentDate: record.date,
      amount: String(record.deductAmount || 0),
      action,
      actorId: actor?.id || 'admin-001',
      actorName: actor?.name || 'HR Admin',
      description: record.mistake,
    });
  }

  return record;
}

export async function deletePenaltyRecordController(id: string) {
  if (!id) throw new Error('Penalty id is required');
  await deletePenaltyRecord(id);
}
