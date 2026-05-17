import { safeJsonParse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';

export type LeaveControlStateRecord = {
  id: string;
  payload: Record<string, unknown>;
};

export async function getLeaveControlState(id: string): Promise<LeaveControlStateRecord | null> {
  const data = await prisma.leave_control_state.findUnique({
    where: { id }
  });

  if (!data) return null;

  return {
    id: data.id,
    payload: safeJsonParse(data.payload_json, {}),
  };
}

export async function upsertLeaveControlState(record: LeaveControlStateRecord) {
  await prisma.leave_control_state.upsert({
    where: { id: record.id },
    update: {
      payload_json: JSON.stringify(record.payload),
      updated_at: new Date()
    },
    create: {
      id: record.id,
      payload_json: JSON.stringify(record.payload),
      updated_at: new Date()
    }
  });
}
