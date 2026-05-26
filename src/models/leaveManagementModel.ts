import { prisma } from '@/lib/prisma';
import { getCache, setCache, clearCachePattern } from '@/lib/cache';
import { calculateAnnualLeaveEntitlement, calculateLeaveEntitlementSnapshot, getLeavePolicyConfig } from '@/models/performanceManagementModel';
import { leave_approvals_action, leave_request_days_slot } from '@prisma/client';


export type GenderScope = 'ALL' | 'MALE' | 'FEMALE' | 'OTHER';
export type LeaveApprovalAction = 'pending' | 'approved' | 'rejected';
export type LeaveSlot = 'AM' | 'PM';

export type LeaveTypeConfig = {
  code: string;
  name: string;
  daysPerYear: number;
  baseDays: number;
  additionalDays: number;
  isProRated: boolean;
  carryForwardExpiryMonth: number;
  allowNegativeBalance: boolean;
  maxNegativeDays: number;
  carryForwardEnabled: boolean;
  carryForwardCap: number;
  genderScope: GenderScope;
  approvalLevels: 1 | 2;
  requiresAttachment: boolean;
  allowHalfDay: boolean;
  autoPenaltyOnWithoutPay: boolean;
  autoPenaltyOnExceedBalance: boolean;
  penaltyTypeCode?: string;
  active: boolean;
  deletedAt?: string | null;
};

export type LeaveBalanceRecord = {
  id: string;
  employeeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  year: number;
  openingDays: number;
  carryForwardDays: number;
  adjustedDays: number;
  usedDays: number;
  minAllowedDays: number;
  availableDays: number;
  allowNegativeBalance: boolean;
  maxNegativeDays: number;
};

export type LeaveWorkflowConfig = {
  id: string;
  departmentId?: string;
  leaveTypeCode?: string;
  levelCount: 1 | 2;
  hrApproverId?: string;
  active: boolean;
};

export type LeaveHolidayRecord = {
  id: string;
  holidayDate: string;
  name: string;
  region: string;
  optional: boolean;
};

export type LeaveDaySlot = {
  leaveDate: string;
  slot: LeaveSlot;
  units: number;
};

export type LeaveValidationResult = {
  units: number;
  workingDates: string[];
  warnings: string[];
  slots: LeaveDaySlot[];
};

export type LeaveBalancePreview = {
  before: number;
  after: number;
  minAllowed: number;
  leaveTypeCode: string;
};

export type LeaveEntitlementOverrideRecord = {
  id?: string;
  employeeId: string;
  leaveTypeCode: string;
  year: number;
  overrideDays: number;
  overrideReason?: string;
  overriddenBy?: string;
};

function toDateOnly(value: Date | string): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value || '').split('T')[0];
}

function normalizeDate(value: string | Date | null | undefined): Date {
  if (!value) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (value instanceof Date) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const str = String(value || '').split('T')[0];
  const parts = str.split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1; 
    const day = Number(parts[2]);
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return new Date(year, month, day, 0, 0, 0, 0);
    }
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function getCarryForwardExpiryDate(year: number, month: number, day: number): Date {
  const safeMonth = Math.min(12, Math.max(1, month));
  const safeDay = Math.min(31, Math.max(1, day));
  return new Date(year, safeMonth - 1, safeDay, 23, 59, 59, 999);
}

// ─── Leave Types ──────────────────────────────────────────────────────────────

function mapLeaveTypeRow(row: any): LeaveTypeConfig {
  return {
    code: row.code,
    name: row.name,
    daysPerYear: Number(row.days_per_year ?? 0),
    baseDays: Number(row.days_per_year ?? 0), 
    additionalDays: 0,
    isProRated: true, 
    carryForwardExpiryMonth: 2,
    allowNegativeBalance: Boolean(row.allow_negative_balance),
    maxNegativeDays: Number(row.max_negative_days || 0),
    carryForwardEnabled: Boolean(row.carry_forward_enabled),
    carryForwardCap: Number(row.carry_forward_cap || 0),
    genderScope: (row.gender_scope as GenderScope) || 'ALL',
    approvalLevels: Number(row.approval_levels) === 2 ? 2 : 1,
    requiresAttachment: Boolean(row.requires_attachment),
    allowHalfDay: Boolean(row.allow_half_day),
    autoPenaltyOnWithoutPay: Boolean(row.auto_penalty_on_without_pay),
    autoPenaltyOnExceedBalance: Boolean(row.auto_penalty_on_exceed_balance),
    penaltyTypeCode: row.penalty_type_code || undefined,
    active: Boolean(row.active),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

export async function listLeaveTypes(activeOnly = true): Promise<LeaveTypeConfig[]> {
  const data = await prisma.leave_types.findMany({
    where: {
      active: activeOnly ? true : undefined,
    },
    orderBy: { name: 'asc' },
  });

  return (data ?? []).map(mapLeaveTypeRow);
}

export async function getLeaveTypeByCode(code: string): Promise<LeaveTypeConfig | null> {
  const data = await prisma.leave_types.findUnique({
    where: { code },
  });

  if (!data) return null;
  return mapLeaveTypeRow(data);
}

export async function upsertLeaveType(config: Omit<LeaveTypeConfig, 'deletedAt'>) {
  await prisma.leave_types.upsert({
    where: { code: config.code },
    update: {
      name: config.name,
      days_per_year: config.daysPerYear,
      allow_negative_balance: config.allowNegativeBalance,
      max_negative_days: config.maxNegativeDays,
      carry_forward_enabled: config.carryForwardEnabled,
      carry_forward_cap: config.carryForwardCap,
      gender_scope: config.genderScope,
      approval_levels: config.approvalLevels,
      requires_attachment: config.requiresAttachment,
      allow_half_day: config.allowHalfDay,
      auto_penalty_on_without_pay: config.autoPenaltyOnWithoutPay,
      auto_penalty_on_exceed_balance: config.autoPenaltyOnExceedBalance,
      penalty_type_code: config.penaltyTypeCode || null,
      active: config.active,
      updated_at: new Date(),
    },
    create: {
      code: config.code,
      name: config.name,
      days_per_year: config.daysPerYear,
      allow_negative_balance: config.allowNegativeBalance,
      max_negative_days: config.maxNegativeDays,
      carry_forward_enabled: config.carryForwardEnabled,
      carry_forward_cap: config.carryForwardCap,
      gender_scope: config.genderScope,
      approval_levels: config.approvalLevels,
      requires_attachment: config.requiresAttachment,
      allow_half_day: config.allowHalfDay,
      auto_penalty_on_without_pay: config.autoPenaltyOnWithoutPay,
      auto_penalty_on_exceed_balance: config.autoPenaltyOnExceedBalance,
      penalty_type_code: config.penaltyTypeCode || null,
      active: config.active,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
}

export async function softDeleteLeaveType(code: string) {
  await prisma.leave_types.update({
    where: { code },
    data: { 
      active: false,
      updated_at: new Date()
    },
  });
}

export async function seedDefaultLeaveSetup() {
  const defaults: Array<Omit<LeaveTypeConfig, 'deletedAt'>> = [
    { code: 'AL', name: 'Annual Leave', daysPerYear: 8, baseDays: 8, additionalDays: 0, isProRated: true, carryForwardExpiryMonth: 2, allowNegativeBalance: false, maxNegativeDays: 0, carryForwardEnabled: true, carryForwardCap: 5, genderScope: 'ALL', approvalLevels: 1, requiresAttachment: false, allowHalfDay: true, autoPenaltyOnWithoutPay: false, autoPenaltyOnExceedBalance: false, active: true },
    { code: 'MC', name: 'Medical Leave', daysPerYear: 14, baseDays: 14, additionalDays: 0, isProRated: false, carryForwardExpiryMonth: 2, allowNegativeBalance: false, maxNegativeDays: 0, carryForwardEnabled: false, carryForwardCap: 0, genderScope: 'ALL', approvalLevels: 1, requiresAttachment: true, allowHalfDay: false, autoPenaltyOnWithoutPay: false, autoPenaltyOnExceedBalance: false, active: true },
    { code: 'CS', name: 'Compassionate Leave', daysPerYear: 3, baseDays: 3, additionalDays: 0, isProRated: false, carryForwardExpiryMonth: 2, allowNegativeBalance: false, maxNegativeDays: 0, carryForwardEnabled: false, carryForwardCap: 0, genderScope: 'ALL', approvalLevels: 1, requiresAttachment: true, allowHalfDay: false, autoPenaltyOnWithoutPay: false, autoPenaltyOnExceedBalance: false, active: true },
    { code: 'MATERNITY', name: 'Maternity Leave', daysPerYear: 90, baseDays: 90, additionalDays: 0, isProRated: false, carryForwardExpiryMonth: 2, allowNegativeBalance: false, maxNegativeDays: 0, carryForwardEnabled: false, carryForwardCap: 0, genderScope: 'FEMALE', approvalLevels: 1, requiresAttachment: true, allowHalfDay: false, autoPenaltyOnWithoutPay: false, autoPenaltyOnExceedBalance: false, active: true },
    { code: 'PATERNITY', name: 'Paternity Leave', daysPerYear: 3, baseDays: 3, additionalDays: 0, isProRated: false, carryForwardExpiryMonth: 2, allowNegativeBalance: false, maxNegativeDays: 0, carryForwardEnabled: false, carryForwardCap: 0, genderScope: 'MALE', approvalLevels: 1, requiresAttachment: true, allowHalfDay: false, autoPenaltyOnWithoutPay: false, autoPenaltyOnExceedBalance: false, active: true },
    { code: 'REPLACEMENT', name: 'Replacement Leave', daysPerYear: 12, baseDays: 12, additionalDays: 0, isProRated: false, carryForwardExpiryMonth: 2, allowNegativeBalance: false, maxNegativeDays: 0, carryForwardEnabled: true, carryForwardCap: 12, genderScope: 'ALL', approvalLevels: 1, requiresAttachment: false, allowHalfDay: true, autoPenaltyOnWithoutPay: false, autoPenaltyOnExceedBalance: false, active: true },
    { code: 'WFH', name: 'Work From Home', daysPerYear: 4, baseDays: 4, additionalDays: 0, isProRated: false, carryForwardExpiryMonth: 2, allowNegativeBalance: false, maxNegativeDays: 0, carryForwardEnabled: false, carryForwardCap: 0, genderScope: 'ALL', approvalLevels: 1, requiresAttachment: false, allowHalfDay: true, autoPenaltyOnWithoutPay: false, autoPenaltyOnExceedBalance: false, active: true },
    { code: 'REWARD', name: 'Reward Leave', daysPerYear: 0, baseDays: 0, additionalDays: 0, isProRated: false, carryForwardExpiryMonth: 2, allowNegativeBalance: false, maxNegativeDays: 0, carryForwardEnabled: true, carryForwardCap: 5, genderScope: 'ALL', approvalLevels: 1, requiresAttachment: false, allowHalfDay: true, autoPenaltyOnWithoutPay: false, autoPenaltyOnExceedBalance: false, active: true },
    { code: 'UNPAID', name: 'Leave w/o Pay', daysPerYear: 10, baseDays: 10, additionalDays: 0, isProRated: false, carryForwardExpiryMonth: 2, allowNegativeBalance: true, maxNegativeDays: 999, carryForwardEnabled: false, carryForwardCap: 0, genderScope: 'ALL', approvalLevels: 1, requiresAttachment: false, allowHalfDay: true, autoPenaltyOnWithoutPay: false, autoPenaltyOnExceedBalance: false, active: true },
    { code: 'ADDITIONAL', name: 'Additional Leave', daysPerYear: 4, baseDays: 4, additionalDays: 0, isProRated: false, carryForwardExpiryMonth: 2, allowNegativeBalance: false, maxNegativeDays: 0, carryForwardEnabled: false, carryForwardCap: 0, genderScope: 'ALL', approvalLevels: 1, requiresAttachment: false, allowHalfDay: true, autoPenaltyOnWithoutPay: false, autoPenaltyOnExceedBalance: false, active: true },
  ];

  // Enhanced Seeding: Always ensure the coded defaults are reflected in the database
  for (const leaveType of defaults) {
    await upsertLeaveType(leaveType);
  }

  const existingWf = await prisma.leave_workflow_configs.findFirst({
    where: {
      department_id: null,
      leave_type_code: null,
      deleted_at: null,
    },
  });

  if (!existingWf) {
    await upsertWorkflowConfig({ id: `WF-${Date.now()}`, levelCount: 1, hrApproverId: 'hr-001', active: true });
  } else if (existingWf.level_count !== 1) {
    await prisma.leave_workflow_configs.update({
      where: { id: existingWf.id },
      data: { level_count: 1 }
    });
  }
}

export async function resyncAllEmployeeBalances(targetYear?: number) {
  const currentYear = targetYear || new Date().getFullYear();
  console.log(`[resyncAllEmployeeBalances] Year: ${currentYear}. Starting optimized sync...`);
  
  // 1. Initial setup
  await seedDefaultLeaveSetup();

  // 2. Global Pre-fetches (Optimization)
  const [leaveTypes, settings, { listUsers }, { syncEmployeeServiceYears }] = await Promise.all([
    listLeaveTypes(true),
    import('./systemSettingsModel').then(m => m.getSystemSettings()),
    import('./userModel'),
    import('./performanceManagementModel')
  ]);

  // Sync service years for ALL users in one go
  await syncEmployeeServiceYears();

  const allUsers = await listUsers();
  const eligibleUsers = allUsers.filter(u => u.role !== 'admin' && u.status === 'active');
  console.log(`[resyncAllEmployeeBalances] Processing ${eligibleUsers.length} users with pre-cached data.`);

  // 3. Chunked sync to prevent DB saturation (5 users at a time)
  const chunkSize = 5;
  for (let i = 0; i < eligibleUsers.length; i += chunkSize) {
    const chunk = eligibleUsers.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (user) => {
      try {
        await ensureBalancesForEmployee(user.id, currentYear, {
          leaveTypes,
          settings,
          skipServiceSync: true // We already synced above
        });
      } catch (err) {
        console.error(`[resyncAllEmployeeBalances] Error syncing ${user.name} (${user.id}):`, err);
      }
    }));
    console.log(`[resyncAllEmployeeBalances] Finished chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(eligibleUsers.length/chunkSize)}`);
  }

  console.log(`[resyncAllEmployeeBalances] Finished all ${eligibleUsers.length} users.`);
}

export async function assertLeaveBookingWindow(startDate: string) {
  const leavePolicy = await getLeavePolicyConfig();
  const requestStart = normalizeDate(startDate);
  const current = new Date();
  current.setHours(0, 0, 0, 0);

  const currentYear = current.getFullYear();
  const targetYear = requestStart.getFullYear();

  if (targetYear <= currentYear) return;

  const allowAfter = new Date(currentYear, leavePolicy.allowNextYearBookingAfterMonth - 1, leavePolicy.allowNextYearBookingAfterDay, 23, 59, 59, 999);

  if (current <= allowAfter) {
    throw new Error('Next year booking is only allowed after 31 Dec.');
  }

  if (!leavePolicy.requireExportPreviousYearBeforeNextYearBooking) return;

  const data = await prisma.archive_runs.findFirst({
    where: {
      from_year: targetYear - 1,
      to_year: targetYear,
    },
  });

  if (!data) {
    throw new Error('Previous year data export is required before next year booking.');
  }
}

// ─── Workflow Configs ─────────────────────────────────────────────────────────

export async function upsertWorkflowConfig(config: LeaveWorkflowConfig) {
  await prisma.leave_workflow_configs.upsert({
    where: { id: config.id },
    update: {
      department_id: config.departmentId || null,
      leave_type_code: config.leaveTypeCode || null,
      level_count: config.levelCount,
      hr_approver_id: config.hrApproverId || null,
      active: config.active,
      updated_at: new Date(),
    },
    create: {
      id: config.id,
      department_id: config.departmentId || null,
      leave_type_code: config.leaveTypeCode || null,
      level_count: config.levelCount,
      hr_approver_id: config.hrApproverId || null,
      active: config.active,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
}

export async function listWorkflowConfigs(): Promise<LeaveWorkflowConfig[]> {
  const data = await prisma.leave_workflow_configs.findMany({
    where: { deleted_at: null },
    orderBy: { created_at: 'desc' },
  });

  return (data ?? []).map((row) => ({
    id: row.id,
    departmentId: row.department_id || undefined,
    leaveTypeCode: row.leave_type_code || undefined,
    levelCount: Number(row.level_count) === 2 ? 2 : 1,
    hrApproverId: row.hr_approver_id || undefined,
    active: Boolean(row.active),
  }));
}

export async function softDeleteWorkflowConfig(id: string) {
  await prisma.leave_workflow_configs.update({
    where: { id },
    data: { 
      active: false,
      deleted_at: new Date(),
      updated_at: new Date()
    },
  });
}

export async function resolveWorkflow(dept: string, leaveTypeCode: string): Promise<{ levelCount: 1 | 2; hrApproverId?: string }> {
  const data = await prisma.leave_workflow_configs.findMany({
    where: {
      active: true,
      deleted_at: null,
      OR: [
        { department_id: dept, leave_type_code: leaveTypeCode },
        { department_id: dept, leave_type_code: null },
        { department_id: null, leave_type_code: leaveTypeCode },
        { department_id: null, leave_type_code: null },
      ],
    },
  });

  if (!data || data.length === 0) return { levelCount: 1 };

  const ranked = [...data].sort((a, b) => {
    const score = (r: (typeof data)[0]) => {
      if (r.department_id === dept && r.leave_type_code === leaveTypeCode) return 0;
      if (r.department_id === dept && !r.leave_type_code) return 1;
      if (!r.department_id && r.leave_type_code === leaveTypeCode) return 2;
      return 3;
    };
    return score(a) - score(b);
  });

  const best = ranked[0];
  return {
    levelCount: Number(best.level_count) === 2 ? 2 : 1,
    hrApproverId: best.hr_approver_id || undefined,
  };
}

// ─── Holidays ─────────────────────────────────────────────────────────────────

export async function listHolidays(year?: number, region = 'DEFAULT'): Promise<LeaveHolidayRecord[]> {
  const cacheKey = `holidays_${year ?? 'all'}_${region}`;
  const cached = await getCache<LeaveHolidayRecord[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const data = await prisma.leave_holidays.findMany({
    where: {
      deleted_at: null,
      region,
      holiday_date: year ? {
        startsWith: `${year}-`
      } : undefined,
    },
    orderBy: { holiday_date: 'asc' },
  });

  const result = (data ?? []).map((row) => ({
    id: row.id,
    holidayDate: toDateOnly(row.holiday_date),
    name: row.name,
    region: row.region || 'DEFAULT',
    optional: Boolean(row.optional),
  }));

  await setCache(cacheKey, result, 300); // Cache for 5 minutes (300s)
  return result;
}

export async function upsertHoliday(holiday: LeaveHolidayRecord) {
  await prisma.leave_holidays.upsert({
    where: { id: holiday.id },
    update: {
      holiday_date: holiday.holidayDate,
      name: holiday.name,
      region: holiday.region,
      optional: holiday.optional,
      updated_at: new Date(),
    },
    create: {
      id: holiday.id,
      holiday_date: holiday.holidayDate,
      name: holiday.name,
      region: holiday.region,
      optional: holiday.optional,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  // Clear holiday caches to ensure updates are reflected instantly
  await clearCachePattern('holidays_');
}

export async function softDeleteHoliday(id: string) {
  await prisma.leave_holidays.update({
    where: { id },
    data: { 
      deleted_at: new Date(),
      updated_at: new Date()
    },
  });

  // Clear holiday caches to ensure updates are reflected instantly
  await clearCachePattern('holidays_');
}

// ─── Leave Balances ───────────────────────────────────────────────────────────

export async function ensureBalancesForEmployee(employeeId: string, year: number, options?: { 
  leaveTypes?: any[], 
  settings?: any,
  skipServiceSync?: boolean 
}) {
  const leaveTypes = options?.leaveTypes || await listLeaveTypes(true);
  const { calculateLeaveEntitlementSnapshot } = await import('./performanceManagementModel');
  const snapshot = await calculateLeaveEntitlementSnapshot(employeeId, year, { skipSync: options?.skipServiceSync });
  const annualEntitlement = snapshot.annualLeaveDays;
  const sickEntitlement = snapshot.sickLeaveDays;
  const wfhEntitlement = snapshot.wfhDaysPerMonth;
  const rewardDefaultEntitlement = snapshot.rewardDays;

  const [overrides, settings, prevBalances, approvedStats] = await Promise.all([
    loadLeaveEntitlementOverrides(employeeId, year),
    options?.settings ? Promise.resolve(options.settings) : import('./systemSettingsModel').then(m => m.getSystemSettings()),
    prisma.leave_balances.findMany({
      where: {
        employee_id: employeeId,
        balance_year: year - 1,
        leave_type_code: { in: ['AL', 'REWARD'] }
      }
    }),
    prisma.leave_requests.groupBy({
      by: ['leave_type'],
      where: {
        employee_id: employeeId,
        status: { in: ['approved', 'history-archived'] },
        start_date: { gte: `${year}-01-01`, lte: `${year}-12-31` }
      },
      _sum: { units: true }
    })
  ]);

  const approvedMap = new Map(approvedStats.map(s => [s.leave_type, Number(s._sum?.units || 0)]));

  let computedAlCarryForward = 0;
  if (prevBalances && prevBalances.length > 0) {
    let totalRemaining = 0;
    for (const pb of prevBalances) {
      const avail = Number(pb.opening_days || 0) + Number(pb.carry_forward_days || 0) + Number(pb.adjusted_days || 0);
      const rem = Math.max(0, avail - Number(pb.used_days || 0));
      totalRemaining += rem;
    }
    const cap = Number(settings.leavePolicy.carryForwardCapDays || 5);
    computedAlCarryForward = Math.min(cap, totalRemaining);
  }

  const existingBalances = await prisma.leave_balances.findMany({
    where: {
      employee_id: employeeId,
      balance_year: year
    }
  });

  const existingMap = new Map((existingBalances || []).map(b => [b.leave_type_code, b]));
  
  const params: any[] = [];
  
  for (const leaveType of leaveTypes) {
    const overrideDays = overrides.get(leaveType.code);
    
    // Default fallback: Always prefer the calculated snapshot if available, otherwise use leave type default
    let baseEntitlement = leaveType.daysPerYear;
    if (leaveType.code === 'AL') baseEntitlement = annualEntitlement;
    else if (leaveType.code === 'MC') baseEntitlement = sickEntitlement;
    else if (leaveType.code === 'WFH') baseEntitlement = wfhEntitlement;
    else if (leaveType.code === 'REWARD') baseEntitlement = rewardDefaultEntitlement;
    else if (leaveType.code === 'UNPAID') baseEntitlement = (snapshot as any).unpaidLeaveDays ?? 10;

    let openingDays = overrideDays ?? baseEntitlement;

    let carryForwardDays = 0;
    if (leaveType.code === 'AL') {
      const carryOverride = overrides.get('AL_CARRY');
      carryForwardDays = carryOverride !== undefined ? carryOverride : computedAlCarryForward;
    }

    const minAllowedDays = leaveType.allowNegativeBalance ? -leaveType.maxNegativeDays : 0;
    const existing = existingMap.get(leaveType.code);
    const usedDays = approvedMap.get(leaveType.code) || 0;
    const adjustedDays = existing ? Number(existing.adjusted_days || 0) : 0;

    const id = existing?.id || `LB-${employeeId}-${leaveType.code}-${year}`;

    params.push(
      id,
      employeeId,
      leaveType.code,
      year,
      openingDays,
      carryForwardDays,
      adjustedDays,
      usedDays,
      minAllowedDays
    );
  }

  if (params.length > 0) {
    const placeholders = leaveTypes.map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`).join(', ');
    await prisma.$executeRawUnsafe(`
      INSERT INTO leave_balances
        (id, employee_id, leave_type_code, balance_year, opening_days, carry_forward_days, adjusted_days, used_days, min_allowed_days, created_at, updated_at)
      VALUES 
        ${placeholders}
      ON DUPLICATE KEY UPDATE
        opening_days = VALUES(opening_days),
        carry_forward_days = VALUES(carry_forward_days),
        min_allowed_days = VALUES(min_allowed_days),
        used_days = VALUES(used_days),
        updated_at = NOW()
    `, ...params);
  }
}


export async function listAllTeamBalances(year: number): Promise<Record<string, LeaveBalanceRecord[]>> {
  const data = await prisma.leave_balances.findMany({
    where: {
      balance_year: year,
      leave_types: { active: true }
    },
    include: {
      leave_types: true
    },
    orderBy: { leave_type_code: 'asc' }
  });

  const adminUsers = await prisma.users.findMany({
    where: { role: 'admin' },
    select: { id: true }
  });
  const adminIds = new Set(adminUsers.map(u => u.id));

  // WFH usage
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthStart = `${year}-${String((year === currentYear ? currentMonth : 11) + 1).padStart(2, '0')}-01`;
  const nextMonth = (year === currentYear ? currentMonth : 11) === 11 ? 0 : (year === currentYear ? currentMonth : 11) + 1;
  const nextYear = (year === currentYear ? currentMonth : 11) === 11 ? year + 1 : year;
  const monthEnd = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;

  const wfhUsageData = await prisma.leave_requests.findMany({
    where: {
      leave_type: 'WFH',
      status: { in: ['approved', 'pending'] },
      start_date: { gte: monthStart, lt: monthEnd }
    },
    select: { employee_id: true, units: true }
  });

  const wfhUsageMap: Record<string, number> = {};
  wfhUsageData.forEach(row => {
    wfhUsageMap[row.employee_id] = (wfhUsageMap[row.employee_id] || 0) + Number(row.units || 0);
  });

  const result: Record<string, LeaveBalanceRecord[]> = {};
  for (const row of data.filter(r => !adminIds.has(r.employee_id))) {
    const eid = row.employee_id;
    if (!result[eid]) result[eid] = [];
    
    const lt = row.leave_types;
    result[eid].push({
      id: row.id,
      employeeId: row.employee_id,
      leaveTypeCode: row.leave_type_code,
      leaveTypeName: lt?.name || row.leave_type_code,
      year: Number(row.balance_year),
      openingDays: Number(row.opening_days || 0),
      carryForwardDays: Number(row.carry_forward_days || 0),
      adjustedDays: Number(row.adjusted_days || 0),
      usedDays: row.leave_type_code === 'WFH' ? (wfhUsageMap[row.employee_id] || 0) : Number(row.used_days || 0),
      minAllowedDays: Number(row.min_allowed_days || 0),
      availableDays: (row.leave_type_code === 'WFH' 
        ? Number(row.opening_days || 0) - (wfhUsageMap[row.employee_id] || 0)
        : Number(row.opening_days || 0) + Number(row.carry_forward_days || 0) + Number(row.adjusted_days || 0) - Number(row.used_days || 0)),
      allowNegativeBalance: Boolean(lt?.allow_negative_balance),
      maxNegativeDays: Number(lt?.max_negative_days || 0),
    });
  }
  return result;
}

async function getWfhMonthlyUsage(employeeId: string, year: number, month: number): Promise<number> {
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const monthEnd = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;

  const data = await prisma.leave_requests.findMany({
    where: {
      employee_id: employeeId,
      leave_type: 'WFH',
      status: { in: ['approved', 'pending'] },
      start_date: { gte: monthStart, lt: monthEnd }
    },
    select: { units: true }
  });

  return (data || []).reduce((sum, row) => sum + Number(row.units || 0), 0);
}

export async function listLeaveBalances(employeeId: string, year: number): Promise<LeaveBalanceRecord[]> {
  const count = await prisma.leave_balances.count({
    where: { employee_id: employeeId, balance_year: year }
  });

  if (count === 0) {
    await ensureBalancesForEmployee(employeeId, year);
  }
  
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const data = await prisma.leave_balances.findMany({
    where: {
      employee_id: employeeId,
      balance_year: year,
      leave_types: { active: true }
    },
    include: {
      leave_types: true
    },
    orderBy: { leave_type_code: 'asc' }
  });

  const results: LeaveBalanceRecord[] = [];
  for (const row of data) {
    const lt = row.leave_types;
    let opening = Number(row.opening_days || 0);
    const cf = Number(row.carry_forward_days || 0);
    const adj = Number(row.adjusted_days || 0);
    let used = Number(row.used_days || 0);

    if (row.leave_type_code === 'WFH') {
      const monthToCalculate = year === currentYear ? currentMonth : 11;
      used = await getWfhMonthlyUsage(employeeId, year, monthToCalculate);
    }

    results.push({
      id: row.id,
      employeeId: row.employee_id,
      leaveTypeCode: row.leave_type_code,
      leaveTypeName: lt?.name || row.leave_type_code,
      year: Number(row.balance_year),
      openingDays: opening,
      carryForwardDays: cf,
      adjustedDays: adj,
      usedDays: used,
      minAllowedDays: Number(row.min_allowed_days || 0),
      availableDays: opening + cf + adj - used,
      allowNegativeBalance: Boolean(lt?.allow_negative_balance),
      maxNegativeDays: Number(lt?.max_negative_days || 0),
    });
  }

  return results;
}

export async function getLeaveBalancePreview(
  employeeId: string,
  leaveTypeCode: string,
  year: number,
  units: number,
  requestStartDate?: string,
): Promise<LeaveBalancePreview> {
  const balances = await listLeaveBalances(employeeId, year);
  const balance = balances.find((item) => item.leaveTypeCode === leaveTypeCode);
  if (!balance) {
    throw new Error('Leave balance not found for selected leave type');
  }

  let before = balance.availableDays;

  if (requestStartDate) {
    const leaveType = await getLeaveTypeByCode(leaveTypeCode);
    if (leaveType?.carryForwardEnabled) {
      const startDate = normalizeDate(requestStartDate);
      const expiry = getCarryForwardExpiryDate(year, leaveType.carryForwardExpiryMonth || 2, 28);

      if (startDate > expiry) {
        const carryForwardRemaining = Math.max(0, roundToHalf(balance.carryForwardDays - balance.usedDays));
        before = roundToHalf(before - carryForwardRemaining);
      }
    }
  }

  const after = roundToHalf(before - units);
  return { before, after, minAllowed: balance.minAllowedDays, leaveTypeCode };
}

export async function listEligibleLeaveTypes(
  employeeId: string,
  year: number,
): Promise<Array<LeaveTypeConfig & { availableDays: number }>> {
  const leaveTypes = await listLeaveTypes(true);
  const balances = await listLeaveBalances(employeeId, year);
  const balanceMap = new Map(balances.map((item) => [item.leaveTypeCode, item]));

  return leaveTypes
    .filter((lt) => {
      const b = balanceMap.get(lt.code);
      if (b && Number(b.openingDays) < 0) return false;
      return true;
    })
    .map((leaveType) => ({
      ...leaveType,
      availableDays: balanceMap.get(leaveType.code)?.availableDays ?? 0,
    }))
    .filter((lt) => {
      if (['REWARD', 'REPLACEMENT'].includes(lt.code)) {
        if (lt.availableDays <= 0) return false;
        if (lt.code === 'REWARD') {
          const alBalance = balanceMap.get('AL')?.availableDays ?? 0;
          if (alBalance > 0) return false;
        }
        return true;
      }
      return true;
    });
}

export async function deductLeaveBalance(params: {
  employeeId: string;
  leaveTypeCode: string;
  year: number;
  units: number;
  requestId: string;
  actor: string;
  requestStartDate?: string;
}) {
  await ensureBalancesForEmployee(params.employeeId, params.year);

  const row = await prisma.leave_balances.findFirst({
    where: {
      employee_id: params.employeeId,
      leave_type_code: params.leaveTypeCode,
      balance_year: params.year
    }
  });

  if (!row) throw new Error('Leave balance record not found');

  const leaveType = await getLeaveTypeByCode(params.leaveTypeCode);
  let available =
    Number(row.opening_days || 0) + Number(row.carry_forward_days || 0) + Number(row.adjusted_days || 0) - Number(row.used_days || 0);

  if (leaveType?.carryForwardEnabled && params.requestStartDate) {
    const expiry = getCarryForwardExpiryDate(params.year, leaveType.carryForwardExpiryMonth || 2, 28);
    const requestDate = normalizeDate(params.requestStartDate);
    if (requestDate > expiry) {
      const carryForwardRemaining = Math.max(0, roundToHalf(Number(row.carry_forward_days || 0) - Number(row.used_days || 0)));
      available = roundToHalf(available - carryForwardRemaining);
    }
  }

  const minAllowed = Number(row.min_allowed_days || 0);
  let availableToValidate = available;

  if (params.leaveTypeCode === 'WFH' && params.requestStartDate) {
    const startDate = new Date(params.requestStartDate);
    const monthlyUsed = await getWfhMonthlyUsage(params.employeeId, params.year, startDate.getMonth());
    const monthlyOpening = Number(row.opening_days || 4);
    availableToValidate = monthlyOpening - monthlyUsed;
  }

  const after = roundToHalf(availableToValidate - params.units);
  if (after < minAllowed) {
    throw new Error(params.leaveTypeCode === 'WFH' 
      ? 'Insufficient WFH balance for this month' 
      : 'Insufficient leave balance for this request');
  }

  if (params.leaveTypeCode === 'REWARD') {
    const alRow = await prisma.leave_balances.findFirst({
      where: {
        employee_id: params.employeeId,
        leave_type_code: 'AL',
        balance_year: params.year
      }
    });
    
    if (alRow) {
      const alAvail = Number(alRow.opening_days || 0) + Number(alRow.carry_forward_days || 0) + Number(alRow.adjusted_days || 0) - Number(alRow.used_days || 0);
      if (alAvail > 0) {
        throw new Error('Please consume your Annual Leave (AL) before using Reward Leave.');
      }
    }
  }

  const newUsed = Number(row.used_days || 0) + params.units;
  
  await prisma.$transaction([
    prisma.leave_balances.update({
      where: { id: row.id },
      data: { used_days: newUsed, updated_at: new Date() }
    }),
    prisma.leave_balance_ledger.create({
      data: {
        id: `LBL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        balance_id: row.id,
        leave_request_id: params.requestId,
        txn_type: 'DEDUCTION',
        delta_days: -params.units,
        note: 'Leave approved',
        created_by: params.actor,
        created_at: new Date()
      }
    })
  ]);
}

export async function calculateLeaveValidation(params: {
  startDate: string;
  endDate: string;
  halfDay: boolean;
  fromHalf: LeaveSlot;
  toHalf: LeaveSlot;
}): Promise<LeaveValidationResult> {
  const startDate = normalizeDate(params.startDate);
  const endDate = normalizeDate(params.endDate);
  if (endDate < startDate) {
    throw new Error('To date cannot be before from date');
  }

  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  const year = startDate.getFullYear();
  const holidayRows = await listHolidays(year);
  const holidaySet = new Set(holidayRows.map((item) => item.holidayDate));

  const warnings: string[] = [];
  const workingDates: string[] = [];
  const slots: LeaveDaySlot[] = [];

  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const dateOnly = toDateOnly(cursor);
    const weekday = cursor.getDay();
    const weekend = weekday === 0 || weekday === 6;
    const holiday = holidaySet.has(dateOnly);

    if (!weekend && !holiday) {
      workingDates.push(dateOnly);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (workingDates.length === 0) {
    throw new Error('Selected date range has no working days');
  }

  const singleDay = start === end;
  for (let i = 0; i < workingDates.length; i += 1) {
    const dateOnly = workingDates[i];
    const isFirst = i === 0;
    const isLast = i === workingDates.length - 1;

    if (!params.halfDay) {
      slots.push({ leaveDate: dateOnly, slot: 'AM', units: 0.5 });
      slots.push({ leaveDate: dateOnly, slot: 'PM', units: 0.5 });
      continue;
    }

    if (singleDay) {
      if (params.fromHalf === 'PM' && params.toHalf === 'AM') throw new Error('Invalid half-day range');
      if (params.fromHalf === params.toHalf) {
        slots.push({ leaveDate: dateOnly, slot: params.fromHalf, units: 0.5 });
      } else {
        slots.push({ leaveDate: dateOnly, slot: 'AM', units: 0.5 });
        slots.push({ leaveDate: dateOnly, slot: 'PM', units: 0.5 });
      }
      continue;
    }

    if (isFirst && params.fromHalf === 'PM') {
      slots.push({ leaveDate: dateOnly, slot: 'PM', units: 0.5 });
      continue;
    }
    if (isLast && params.toHalf === 'AM') {
      slots.push({ leaveDate: dateOnly, slot: 'AM', units: 0.5 });
      continue;
    }
    slots.push({ leaveDate: dateOnly, slot: 'AM', units: 0.5 });
    slots.push({ leaveDate: dateOnly, slot: 'PM', units: 0.5 });
  }

  const units = roundToHalf(slots.reduce((sum, slot) => sum + slot.units, 0));
  return { units, workingDates, warnings, slots };
}

export async function hasLeaveOverlap(employeeId: string, slots: LeaveDaySlot[], excludeRequestId?: string): Promise<boolean> {
  if (slots.length === 0) return false;

  const dates = slots.map((item) => item.leaveDate).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  const data = await prisma.leave_request_days.findMany({
    where: {
      employee_id: employeeId,
      leave_date: { gte: minDate, lte: maxDate },
      leave_requests: {
        status: { in: ['pending', 'approved'] },
        NOT: excludeRequestId ? { id: excludeRequestId } : undefined
      }
    },
    select: { leave_date: true, slot: true }
  });

  const existing = new Set(data.map((row) => `${toDateOnly(row.leave_date)}|${row.slot}`));
  return slots.some((slot) => existing.has(`${slot.leaveDate}|${slot.slot}`));
}

export async function lockLeaveRequestDays(requestId: string, employeeId: string, slots: LeaveDaySlot[]) {
  if (slots.length === 0) return;
  
  const data = slots.map((slot) => ({
    request_id: requestId,
    employee_id: employeeId,
    leave_date: slot.leaveDate,
    slot: slot.slot as leave_request_days_slot,
    units: slot.units,
    created_at: new Date()
  }));

  await prisma.leave_request_days.createMany({ data });
}

export async function releaseLeaveRequestDays(requestId: string) {
  await prisma.leave_request_days.deleteMany({ where: { request_id: requestId } });
}

export async function createLeaveApprovalStep(params: { requestId: string; levelNo: number; approverId: string }) {
  const id = `LAP-${Date.now()}-${params.levelNo}-${Math.floor(Math.random() * 1000)}`;

  await prisma.leave_approvals.upsert({
    where: { id },
    update: {
      approver_id: params.approverId,
      action: 'pending',
      comment: null,
      acted_at: null,
      updated_at: new Date()
    },
    create: {
      id,
      request_id: params.requestId,
      level_no: params.levelNo,
      approver_id: params.approverId,
      action: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    }
  });
}

export async function listLeaveApprovalSteps(requestId: string): Promise<Array<{
  id: string;
  requestId: string;
  levelNo: number;
  approverId: string;
  action: LeaveApprovalAction;
  comment?: string;
  actedAt?: string;
}>> {
  const data = await prisma.leave_approvals.findMany({
    where: { request_id: requestId },
    orderBy: { level_no: 'asc' }
  });

  return (data ?? []).map((row) => ({
    id: row.id,
    requestId: row.request_id,
    levelNo: Number(row.level_no),
    approverId: row.approver_id,
    action: row.action as LeaveApprovalAction,
    comment: row.comment || undefined,
    actedAt: row.acted_at ? row.acted_at.toISOString() : undefined,
  }));
}

export async function updateLeaveApprovalStep(params: {
  requestId: string;
  levelNo: number;
  action: LeaveApprovalAction;
  comment?: string;
  actor: string;
}) {
  await prisma.leave_approvals.updateMany({
    where: {
      request_id: params.requestId,
      level_no: params.levelNo
    },
    data: {
      action: params.action as leave_approvals_action,
      comment: params.comment || null,
      acted_at: new Date(),
      approver_id: params.actor,
      updated_at: new Date()
    }
  });
}

export async function countPendingApprovalsForApprover(approverId: string, department?: string): Promise<number> {
  return await prisma.leave_approvals.count({
    where: {
      approver_id: approverId,
      action: 'pending',
      leave_requests: {
        status: 'pending',
        dept: department || undefined
      }
    }
  });
}

export async function reassignPendingApprovals(params: {
  previousApproverId: string;
  nextApproverId: string;
  department?: string;
}): Promise<number> {
  const result = await prisma.leave_approvals.updateMany({
    where: {
      approver_id: params.previousApproverId,
      action: 'pending',
      leave_requests: {
        status: 'pending',
        dept: params.department || undefined
      }
    },
    data: {
      approver_id: params.nextApproverId,
      updated_at: new Date()
    }
  });
  return result.count;
}

export async function listRequestsPendingForApprover(params: {
  approverId: string;
  status?: string;
  leaveType?: string;
  employmentType?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  employeeNameSearch?: string;
  department?: string;
}): Promise<string[]> {
  const data = await prisma.leave_approvals.findMany({
    where: {
      approver_id: params.approverId === 'ALL' ? undefined : params.approverId,
      action: 'pending',
      leave_requests: {
        status: params.status || 'pending',
        leave_type: params.leaveType || undefined,
        employment_type: params.employmentType || undefined,
        start_date: params.dateRangeStart ? { gte: params.dateRangeStart } : undefined,
        end_date: params.dateRangeEnd ? { lte: params.dateRangeEnd } : undefined,
        employee_name: params.employeeNameSearch ? { contains: params.employeeNameSearch } : undefined,
        dept: params.department || undefined
      }
    },
    select: { request_id: true },
    orderBy: { leave_requests: { requested_at: 'desc' } }
  });

  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of data) {
    if (!seen.has(row.request_id)) {
      seen.add(row.request_id);
      result.push(row.request_id);
    }
  }
  return result;
}

export async function createLeaveCalendarEntry(params: {
  requestId: string;
  employeeId: string;
  employeeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  units: number;
}) {
  await prisma.leave_calendar_entries.upsert({
    where: { request_id: params.requestId },
    update: {
      employee_id: params.employeeId,
      employee_name: params.employeeName,
      leave_type_code: params.leaveTypeCode,
      start_date: params.startDate,
      end_date: params.endDate,
      units: params.units
    },
    create: {
      id: `LCAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      request_id: params.requestId,
      employee_id: params.employeeId,
      employee_name: params.employeeName,
      leave_type_code: params.leaveTypeCode,
      start_date: params.startDate,
      end_date: params.endDate,
      units: params.units,
      created_at: new Date()
    }
  });
}

export async function listTeamLeaveCalendar(params: { month: string; department?: string }) {
  const [year, month] = params.month.split('-').map(Number);
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = toDateOnly(new Date(year, month, 0));

  const data = await prisma.leave_calendar_entries.findMany({
    where: {
      start_date: { lte: monthEnd },
      end_date: { gte: monthStart },
      leave_requests: {
        dept: params.department || undefined
      }
    },
    include: {
      leave_requests: {
        include: {
          users: { select: { status: true } }
        }
      }
    },
    orderBy: [
      { start_date: 'asc' },
      { employee_name: 'asc' }
    ]
  });

  return data.map((row) => ({
    id: row.id,
    requestId: row.request_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    leaveTypeCode: row.leave_type_code,
    startDate: toDateOnly(row.start_date),
    endDate: toDateOnly(row.end_date),
    units: Number(row.units),
    dept: row.leave_requests.dept || 'Unknown',
    employeeStatus: row.leave_requests.users.status || 'active',
    session: row.leave_requests.session || 'FULL',
  }));
}

export async function getLeaveReports(
  mode: 'monthly' | 'yearly' | 'balance' | 'utilization',
  params: { year?: number; month?: string; department?: string; employeeId?: string },
) {
  if (mode === 'monthly') {
    const [year, month] = params.month!.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = toDateOnly(new Date(year, month, 0));

    const data = await prisma.leave_requests.findMany({
      where: {
        status: 'approved',
        start_date: { lte: endDate },
        end_date: { gte: startDate },
        dept: params.department || undefined,
        users: { role: { not: 'admin' } }
      },
      select: { employee_id: true, employee_name: true, dept: true, leave_type: true, units: true }
    });

    const map = new Map<string, any>();
    for (const row of data) {
      const key = `${row.employee_id}|${row.leave_type}`;
      const existing = map.get(key) ?? { employeeId: row.employee_id, employeeName: row.employee_name, dept: row.dept, leaveType: row.leave_type, totalUnits: 0, totalRequests: 0 };
      existing.totalUnits += Number(row.units || 0);
      existing.totalRequests += 1;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }

  if (mode === 'yearly') {
    const year = params.year || new Date().getFullYear();
    const data = await prisma.leave_requests.findMany({
      where: {
        status: 'approved',
        start_date: { gte: `${year}-01-01` },
        end_date: { lte: `${year}-12-31` },
        dept: params.department || undefined,
        users: { role: { not: 'admin' } }
      },
      select: { employee_id: true, employee_name: true, dept: true, units: true }
    });

    const map = new Map<string, any>();
    for (const row of data) {
      const existing = map.get(row.employee_id) ?? { employeeId: row.employee_id, employeeName: row.employee_name, dept: row.dept, totalUnits: 0, approvedRequests: 0 };
      existing.totalUnits += Number(row.units || 0);
      existing.approvedRequests += 1;
      map.set(row.employee_id, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.totalUnits - a.totalUnits);
  }

  if (mode === 'balance') {
    const year = params.year || new Date().getFullYear();
    if (params.employeeId) return listLeaveBalances(params.employeeId, year);

    const bals = await prisma.leave_balances.findMany({
      where: { balance_year: year },
      include: {
        leave_types: true,
        users: { select: { id: true, name: true, dept: true, role: true } }
      }
    });

    return bals
      .filter(b => b.users.role !== 'admin' && (!params.department || b.users.dept === params.department))
      .map((b) => {
        const opening = Number(b.opening_days || 0);
        const cf = Number(b.carry_forward_days || 0);
        const adj = Number(b.adjusted_days || 0);
        const used = Number(b.used_days || 0);
        return {
          Employee: b.users.name,
          Department: b.users.dept,
          LeaveType: b.leave_types.name,
          Opening: opening,
          CarryForward: cf,
          Adjusted: adj,
          Used: used,
          Available: opening + cf + adj - used,
        };
      })
      .sort((a, b) => a.Employee.localeCompare(b.Employee));
  }

  const year = params.year || new Date().getFullYear();
  const data = await prisma.leave_balances.findMany({
    where: {
      balance_year: year,
      employee_id: params.employeeId || undefined,
      users: { role: { not: 'admin' } }
    },
    include: { leave_types: true }
  });

  return data.map((row) => {
    const total = Number(row.opening_days || 0) + Number(row.carry_forward_days || 0) + Number(row.adjusted_days || 0);
    const used = Number(row.used_days || 0);
    return {
      EmployeeId: row.employee_id,
      LeaveTypeCode: row.leave_type_code,
      LeaveTypeName: row.leave_types.name,
      BalanceYear: row.balance_year,
      OpeningDays: Number(row.opening_days || 0),
      CarryForwardDays: Number(row.carry_forward_days || 0),
      AdjustedDays: Number(row.adjusted_days || 0),
      UsedDays: used,
      UtilizationPercent: total === 0 ? 0 : (used * 100) / total,
    };
  }).sort((a, b) => b.UtilizationPercent - a.UtilizationPercent);
}

export async function ensureLeaveManagementSetup(): Promise<void> {}

export async function listLeaveEntitlementOverrides(employeeId?: string, year?: number): Promise<LeaveEntitlementOverrideRecord[]> {
  const data = await prisma.employee_leave_entitlements.findMany({
    where: {
      employee_id: employeeId || undefined,
      balance_year: year || undefined
    },
    orderBy: [
      { balance_year: 'desc' },
      { leave_type_code: 'asc' }
    ]
  });

  return (data ?? []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    leaveTypeCode: row.leave_type_code,
    year: Number(row.balance_year),
    overrideDays: Number(row.override_days || 0),
    overrideReason: row.override_reason || undefined,
    overriddenBy: row.overridden_by || undefined,
  }));
}

export async function clearAllLeaveEntitlementOverrides(year: number) {
  await prisma.employee_leave_entitlements.deleteMany({
    where: { balance_year: year }
  });
}

export async function upsertLeaveEntitlementOverride(record: LeaveEntitlementOverrideRecord) {
  await prisma.employee_leave_entitlements.upsert({
    where: { id: record.id || `OVER-${record.employeeId}-${record.leaveTypeCode}-${record.year}` },
    update: {
      override_days: record.overrideDays,
      override_reason: record.overrideReason || null,
      overridden_by: record.overriddenBy || null,
      updated_at: new Date()
    },
    create: {
      id: `OVER-${record.employeeId}-${record.leaveTypeCode}-${record.year}`,
      employee_id: record.employeeId,
      leave_type_code: record.leaveTypeCode,
      balance_year: record.year,
      override_days: record.overrideDays,
      override_reason: record.overrideReason || null,
      overridden_by: record.overriddenBy || null,
      created_at: new Date(),
      updated_at: new Date()
    }
  });

  await ensureBalancesForEmployee(record.employeeId, record.year, { skipServiceSync: true });
}

export async function upsertManyLeaveEntitlementOverrides(records: LeaveEntitlementOverrideRecord[]) {
  if (records.length === 0) return;

  // 1. Perform all overrides upserts in a single bulk database query!
  const params: any[] = [];
  for (const record of records) {
    const id = record.id || `OVER-${record.employeeId}-${record.leaveTypeCode}-${record.year}`;
    params.push(
      id,
      record.employeeId,
      record.leaveTypeCode,
      record.year,
      record.overrideDays,
      record.overrideReason || null,
      record.overriddenBy || null
    );
  }

  const placeholders = records.map(() => `(?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`).join(', ');
  await prisma.$executeRawUnsafe(`
    INSERT INTO employee_leave_entitlements 
      (id, employee_id, leave_type_code, balance_year, override_days, override_reason, overridden_by, created_at, updated_at)
    VALUES 
      ${placeholders}
    ON DUPLICATE KEY UPDATE
      override_days = VALUES(override_days),
      override_reason = VALUES(override_reason),
      overridden_by = VALUES(overridden_by),
      updated_at = NOW()
  `, ...params);

  // 2. Synchronize balances for each unique employee-year pair ONCE
  const uniqueKeys = new Set<string>();
  const jobs: Array<{ employeeId: string; year: number }> = [];

  for (const r of records) {
    const key = `${r.employeeId}-${r.year}`;
    if (!uniqueKeys.has(key)) {
      uniqueKeys.add(key);
      jobs.push({ employeeId: r.employeeId, year: r.year });
    }
  }

  // Optimize: Pre-fetch active leaveTypes and system settings ONCE to pass to ensuring job loops
  const leaveTypes = await listLeaveTypes(true);
  const { getSystemSettings } = await import('./systemSettingsModel');
  const settings = await getSystemSettings();

  for (const job of jobs) {
    await ensureBalancesForEmployee(job.employeeId, job.year, { 
      leaveTypes,
      settings,
      skipServiceSync: true 
    });
  }
}

export async function deleteLeaveEntitlementOverride(employeeId: string, leaveTypeCode: string, year: number) {
  await prisma.employee_leave_entitlements.deleteMany({
    where: { employee_id: employeeId, leave_type_code: leaveTypeCode, balance_year: year }
  });
}

async function loadLeaveEntitlementOverrides(employeeId: string, year: number) {
  const data = await prisma.employee_leave_entitlements.findMany({
    where: { employee_id: employeeId, balance_year: year },
    select: { leave_type_code: true, override_days: true }
  });

  const map = new Map<string, number>();
  for (const row of data) {
    map.set(String(row.leave_type_code), Number(row.override_days));
  }
  return map;
}

export async function listLeaveRequestStatuses(): Promise<string[]> {
  const data = await prisma.leave_requests.findMany({
    select: { status: true },
    distinct: ['status'],
    orderBy: { status: 'asc' }
  });
  
  const statuses = (data || []).map(r => r.status).filter(s => s !== 'pending-hr');
  const defaults = ['pending', 'approved', 'rejected', 'cancelled'];
  const final = Array.from(new Set([...defaults, ...statuses])).sort();
  return final;
}
