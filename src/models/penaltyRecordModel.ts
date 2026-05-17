import { prisma } from '@/lib/prisma';

export type PenaltyRecord = {
  id: string;
  employeeId?: string; // New field
  employeeName: string;
  dept: string;
  date: string;
  year: number;
  mistake: string;
  level: 'Warning' | 'Minor' | 'Major';
  category: 'Performance' | 'Attendance' | 'Policy' | 'Conduct' | 'Safety';
  deducted: boolean;
  deductAmount: number;
  resolved: boolean;
  notes: string;
};

export async function listPenaltyRecords(filters: { year?: number } = {}): Promise<PenaltyRecord[]> {
  const data = await prisma.penalties.findMany({
    where: typeof filters.year === 'number' ? {
      penalty_date: {
        gte: `${filters.year}-01-01`,
        lte: `${filters.year}-12-31`
      }
    } : undefined,
    orderBy: [
      { penalty_date: 'desc' },
      { created_at: 'desc' }
    ]
  });

  return (data ?? []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    dept: row.department,
    date: row.penalty_date,
    year: row.penalty_date ? new Date(row.penalty_date).getFullYear() : new Date().getFullYear(),
    mistake: row.reason,
    level: (row.severity === 'high' ? 'Major' : row.severity === 'medium' ? 'Minor' : 'Warning') as any,
    category: (row.penalty_category || 'Performance') as any,
    deducted: Boolean(Number(row.cash_amount || 0) > 0),
    deductAmount: Number(row.cash_amount || 0),
    resolved: false,
    notes: '',
  }));
}

export async function upsertPenaltyRecord(record: PenaltyRecord) {
  const penaltyTypeCode = record.level === 'Major' ? 'TIER_3' : record.level === 'Minor' ? 'TIER_2' : 'TIER_1';
  const employeeId = record.employeeId || 'unknown-user';

  await prisma.penalties.upsert({
    where: { id: record.id },
    update: {
      employee_id: employeeId,
      employee_name: record.employeeName,
      department: record.dept,
      penalty_type_code: penaltyTypeCode,
      penalty_date: record.date,
      reason: record.mistake,
      severity: record.level === 'Major' ? 'high' : record.level === 'Minor' ? 'medium' : 'low',
      penalty_category: record.category || 'standard',
      cash_amount: record.deductAmount,
      updated_at: new Date()
    },
    create: {
      id: record.id,
      employee_id: employeeId,
      employee_name: record.employeeName,
      department: record.dept,
      penalty_type_code: penaltyTypeCode,
      penalty_date: record.date,
      reason: record.mistake,
      severity: record.level === 'Major' ? 'high' : record.level === 'Minor' ? 'medium' : 'low',
      penalty_category: record.category || 'standard',
      cash_amount: record.deductAmount,
      created_at: new Date(),
      updated_at: new Date()
    }
  });
}

export async function deletePenaltyRecord(id: string) {
  await prisma.penalties.delete({
    where: { id }
  });
}
