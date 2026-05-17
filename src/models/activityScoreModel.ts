import { prisma } from '@/lib/prisma';

export type ActivityScoreRecord = {
  id: string;
  activityName: string;
  date: string;
  year: number;
  month: string;
  category: string;
  scoreBucket: string;
  score: number;
  sourceFolder: string;
  description: string;
  assignedToName: string;
  assignedToId: string;
  attachmentName: string;
  attachmentUrl: string;
  updatedBy?: string;
  updatedAt?: string;
  performanceWeights?: any;
};

export async function listActivityScores(
  filters: {
    year?: number;
    employeeId?: string;
    employeeName?: string;
    startDate?: string;
    endDate?: string;
    periodType?: 'monthly' | 'quarterly' | 'yearly';
    periodNo?: number;
  } = {},
): Promise<ActivityScoreRecord[]> {
  const year = filters.year || new Date().getFullYear();

  let startDate = filters.startDate;
  let endDate = filters.endDate;

  if (filters.periodType && filters.periodNo) {
    if (filters.periodType === 'monthly') {
      const month = filters.periodNo;
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (filters.periodType === 'quarterly') {
      const q = filters.periodNo;
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = q * 3;
      startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(year, endMonth, 0).getDate();
      endDate = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  const data = await prisma.activity_score_entries.findMany({
    where: {
      year: typeof filters.year === 'number' ? filters.year : undefined,
      assigned_to_id: filters.employeeId || undefined,
      assigned_to_name: filters.employeeName ? { contains: filters.employeeName.trim() } : undefined,
      date: (startDate || endDate) ? {
        gte: startDate || undefined,
        lte: endDate || undefined
      } : undefined
    },
    orderBy: [
      { year: 'desc' },
      { date: 'desc' },
      { created_at: 'desc' }
    ]
  });

  return (data ?? []).map((row) => ({
    id: row.id,
    activityName: row.activity_name,
    date: row.date,
    year: row.year,
    month: row.month,
    category: row.category,
    scoreBucket: row.score_bucket,
    score: Number(row.score || 0),
    sourceFolder: row.source_folder,
    description: row.description || '',
    assignedToName: row.assigned_to_name,
    assignedToId: row.assigned_to_id,
    attachmentName: row.attachment_name || '',
    attachmentUrl: row.attachment_url || '',
    updatedAt: row.updated_at ? row.updated_at.toISOString() : undefined,
    updatedBy: row.updated_by || undefined,
    performanceWeights: row.performance_weights,
  }));
}

export async function upsertActivityScore(record: ActivityScoreRecord) {
  await prisma.activity_score_entries.upsert({
    where: { id: record.id },
    update: {
      activity_name: record.activityName,
      date: record.date,
      year: record.year,
      month: record.month,
      category: record.category,
      score_bucket: record.scoreBucket,
      score: record.score,
      source_folder: record.sourceFolder,
      description: record.description,
      assigned_to_name: record.assignedToName,
      assigned_to_id: record.assignedToId,
      attachment_name: record.attachmentName,
      attachment_url: record.attachmentUrl,
      updated_by: record.updatedBy,
      updated_at: new Date(),
      performance_weights: record.performanceWeights,
    },
    create: {
      id: record.id,
      activity_name: record.activityName,
      date: record.date,
      year: record.year,
      month: record.month,
      category: record.category,
      score_bucket: record.scoreBucket,
      score: record.score,
      source_folder: record.sourceFolder,
      description: record.description,
      assigned_to_name: record.assignedToName,
      assigned_to_id: record.assignedToId,
      attachment_name: record.attachmentName,
      attachment_url: record.attachmentUrl,
      updated_by: record.updatedBy,
      created_at: new Date(),
      updated_at: new Date(),
      performance_weights: record.performanceWeights,
    }
  });
}

export async function deleteActivityScore(id: string) {
  await prisma.activity_score_entries.delete({
    where: { id }
  });
}
