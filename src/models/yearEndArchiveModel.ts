import { safeJsonParse } from '@/lib/utils';
import { prisma } from '@/lib/prisma';

export type ArchiveModule = 'performance' | 'scoring-categories' | 'penalty-records' | 'leave-summaries';

export async function upsertHistoricalRecord(year: number, moduleName: ArchiveModule, payload: unknown) {
  await prisma.historical_records.upsert({
    where: { year_module: { year, module: moduleName } },
    update: {
      payload_json: JSON.stringify(payload ?? {}),
      created_at: new Date()
    },
    create: {
      year,
      module: moduleName,
      payload_json: JSON.stringify(payload ?? {}),
      created_at: new Date()
    }
  });
}

export async function insertArchiveRun(
  fromYear: number,
  toYear: number,
  triggeredBy: string,
  summary: unknown,
) {
  await prisma.archive_runs.create({
    data: {
      from_year: fromYear,
      to_year: toYear,
      triggered_by: triggeredBy,
      summary_json: JSON.stringify(summary ?? {}),
      created_at: new Date()
    }
  });
}

export async function listArchiveRuns(limit = 20) {
  const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(100, limit)) : 20;

  const data = await prisma.archive_runs.findMany({
    orderBy: { run_id: 'desc' },
    take: safeLimit
  });

  return (data ?? []).map((row) => ({
    runId: Number(row.run_id),
    fromYear: row.from_year,
    toYear: row.to_year,
    triggeredBy: row.triggered_by,
    summary: safeJsonParse(row.summary_json, {}),
    createdAt: row.created_at ? row.created_at.toISOString() : undefined,
  }));
}

export async function getHistoricalRecords(year: number, moduleName?: ArchiveModule) {
  const data = await prisma.historical_records.findMany({
    where: {
      year,
      module: moduleName || undefined
    },
    orderBy: { module: 'asc' }
  });

  return (data ?? []).map((row) => ({
    year: row.year,
    module: row.module as ArchiveModule,
    payload: safeJsonParse(row.payload_json, {}),
    createdAt: row.created_at ? row.created_at.toISOString() : undefined,
  }));
}

export async function listAvailableYears(): Promise<number[]> {
  const years = new Set<number>();
  
  // 1. From archive runs
  const runs = await prisma.archive_runs.findMany({
    select: { from_year: true, to_year: true }
  });
  (runs || []).forEach(r => {
    if (r.from_year) years.add(r.from_year);
    if (r.to_year) years.add(r.to_year);
  });

  // 2. From historical records
  const hist = await prisma.historical_records.findMany({
    select: { year: true }
  });
  (hist || []).forEach(h => {
    if (h.year) years.add(h.year);
  });

  // 3. From leave balances
  const bals = await prisma.leave_balances.findMany({
    select: { balance_year: true }
  });
  (bals || []).forEach(b => {
    if (b.balance_year && b.balance_year > 1900) years.add(b.balance_year);
  });

  // 4. Current year always included
  years.add(new Date().getFullYear());

  return Array.from(years).sort((a, b) => b - a);
}
