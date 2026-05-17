import { safeJsonParse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';

export type PerformanceSheetRecord = {
  year: number;
  columns: string[];
  sections: Array<{ title: string; rows: Array<{ label: string }> }>;
  cellsByEmployee: Record<string, Record<string, number>>;
};

export async function getPerformanceSheetByYear(year: number): Promise<PerformanceSheetRecord | null> {
  const data = await prisma.performance_sheets.findUnique({
    where: { year }
  });

  if (!data) return null;

  return {
    year: data.year,
    columns: safeJsonParse(data.columns_json, []),
    sections: safeJsonParse(data.sections_json, []),
    cellsByEmployee: safeJsonParse(data.cells_json, {}),
  };
}

export async function upsertPerformanceSheet(record: PerformanceSheetRecord): Promise<void> {
  await prisma.performance_sheets.upsert({
    where: { year: record.year },
    update: {
      columns_json: JSON.stringify(record.columns),
      sections_json: JSON.stringify(record.sections),
      cells_json: JSON.stringify(record.cellsByEmployee),
      updated_at: new Date()
    },
    create: {
      year: record.year,
      columns_json: JSON.stringify(record.columns),
      sections_json: JSON.stringify(record.sections),
      cells_json: JSON.stringify(record.cellsByEmployee),
      updated_at: new Date()
    }
  });
}

export async function listPerformanceYears(): Promise<number[]> {
  const data = await prisma.performance_sheets.findMany({
    select: { year: true },
    orderBy: { year: 'desc' }
  });

  return Array.from(new Set((data ?? []).map(r => r.year)));
}
