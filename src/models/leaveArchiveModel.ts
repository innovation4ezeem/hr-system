import { prisma } from '@/lib/prisma';
import { insertSystemAuditLog } from '@/models/systemAuditLogModel';

export type LeaveArchiveRecord = {
  id: string;
  year: number;
  employeeId: string;
  employeeName: string;
  totalAllocation: number;
  utilized: number;
  balance: number;
  carryForward: number;
  proratedAllocation?: number;
  archiveDate: string;
};

export type LeaveYearConfig = {
  year: number;
  startDate: string;
  endDate: string;
  openForBooking: string;
  archived: boolean;
  details?: {
    totalEmployees: number;
    totalAllocated: number;
    totalUtilized: number;
    totalBalance: number;
  };
};

export async function archiveLeaveYear(year: number): Promise<LeaveArchiveRecord[]> {
  // Aggregate leave data for the year from leave_requests
  const leaveRows = await prisma.leave_requests.findMany({
    where: {
      start_date: {
        gte: `${year}-01-01`,
        lte: `${year}-12-31`
      }
    },
    select: { employee_id: true, units: true }
  });

  // Build summary per employee
  const summaryMap = new Map<string, { utilized: number }>();
  for (const row of leaveRows ?? []) {
    const existing = summaryMap.get(row.employee_id) ?? { utilized: 0 };
    existing.utilized += Number(row.units || 0);
    summaryMap.set(row.employee_id, existing);
  }

  const now = new Date();
  const archiveRecords: LeaveArchiveRecord[] = Array.from(summaryMap.entries()).map(([empId, agg]) => ({
    id: `LA-${year}-${empId}-${Date.now()}`,
    year,
    employeeId: empId,
    employeeName: '',
    totalAllocation: 21,
    utilized: agg.utilized,
    balance: 21 - agg.utilized,
    carryForward: 0,
    archiveDate: now.toISOString(),
  }));

  if (archiveRecords.length > 0) {
    await prisma.leave_archive.createMany({
      data: archiveRecords.map((r) => ({
        id: r.id,
        year: r.year,
        employee_id: r.employeeId,
        employee_name: r.employeeName,
        total_allocation: r.totalAllocation,
        utilized: r.utilized,
        balance: r.balance,
        carry_forward: r.carryForward,
        prorated_allocation: r.proratedAllocation || null,
        archive_date: new Date(r.archiveDate),
        created_at: now,
      }))
    });
  }

  await updateLeaveYearConfig(year, { archived: true });

  await insertSystemAuditLog('leave-year', 'archive', 'system', {
    year,
    recordsArchived: archiveRecords.length,
  });

  return archiveRecords;
}

export async function getLeaveArchives(year?: number): Promise<LeaveArchiveRecord[]> {
  const data = await prisma.leave_archive.findMany({
    where: year ? { year } : undefined,
    orderBy: [
      { year: 'desc' },
      { employee_name: 'asc' }
    ]
  });

  return (data ?? []).map((row) => ({
    id: row.id,
    year: row.year,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    totalAllocation: Number(row.total_allocation || 0),
    utilized: Number(row.utilized || 0),
    balance: Number(row.balance || 0),
    carryForward: Number(row.carry_forward || 0),
    proratedAllocation: row.prorated_allocation ? Number(row.prorated_allocation) : undefined,
    archiveDate: row.archive_date.toISOString(),
  }));
}

export async function createOrUpdateLeaveYearConfig(config: LeaveYearConfig): Promise<void> {
  await prisma.leave_year_config.upsert({
    where: { year: config.year },
    update: {
      start_date: config.startDate,
      end_date: config.endDate,
      open_for_booking: config.openForBooking,
      archived: config.archived,
      updated_at: new Date()
    },
    create: {
      year: config.year,
      start_date: config.startDate,
      end_date: config.endDate,
      open_for_booking: config.openForBooking,
      archived: config.archived,
      updated_at: new Date()
    }
  });
}

export async function getLeaveYearConfigs(): Promise<LeaveYearConfig[]> {
  const data = await prisma.leave_year_config.findMany({
    orderBy: { year: 'desc' }
  });

  return (data ?? []).map((row) => ({
    year: row.year,
    startDate: row.start_date,
    endDate: row.end_date,
    openForBooking: row.open_for_booking,
    archived: row.archived || false,
  }));
}

export async function updateLeaveYearConfig(year: number, updates: Partial<{ archived: boolean }>): Promise<void> {
  const configs = await getLeaveYearConfigs();
  const config = configs.find((c) => c.year === year);

  if (config) {
    await createOrUpdateLeaveYearConfig({ ...config, ...updates });
  }
}

export async function calculateProratedAllocation(joinDate: string, year: number): Promise<number> {
  const join = new Date(joinDate);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const standardAllocation = 21;

  if (join > yearEnd) return 0;
  if (join <= yearStart) return standardAllocation;

  const daysInYear = 365;
  const dayWorked = Math.floor((yearEnd.getTime() - join.getTime()) / (1000 * 60 * 60 * 24));

  return Math.round((dayWorked / daysInYear) * standardAllocation * 100) / 100;
}

export async function enableNextYearBooking(year: number): Promise<void> {
  const nextYear = year + 1;
  const startDate = `${nextYear}-01-01`;
  const endDate = `${nextYear}-12-31`;
  const openDate = new Date().toISOString().split('T')[0];

  await createOrUpdateLeaveYearConfig({
    year: nextYear,
    startDate,
    endDate,
    openForBooking: openDate,
    archived: false,
  });

  await insertSystemAuditLog('leave-year', 'enable-booking', 'system', {
    year: nextYear,
    openDate,
  });
}
