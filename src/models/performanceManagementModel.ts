import { prisma } from '@/lib/prisma';
import { normalizeCategory, round2 } from '@/data/activityScoreRules';
import { randomId } from '@/lib/utils';
import { getSystemSettings } from './systemSettingsModel';

export type PeriodType = 'monthly' | 'quarterly' | 'yearly';
export type ScoreStatus = 'calculated' | 'approved' | 'overridden';
export type PenaltyStatus = 'active' | 'resolved' | 'archived';
export type DeductionMode = 'percent' | 'fixed';
export type EmploymentType = 'Permanent' | 'Intern' | 'Probation';
export type LeaveEntitlementTier = 'LE_2_AND_BELOW' | 'GT_2_AND_LE_5' | 'GT_5';

type ScoreRule = {
  pointsPerUnit: number;
  maxPoints: number;
};

type RuleBucketConfig = {
  bucketMaxPoints: number;
  [ruleCode: string]: number | ScoreRule;
};

export type ScoringConfig = {
  weights: { performance: number; participation: number; popularity: number };
  performance: { kpiWeight: number; tasksWeight: number; qualityWeight: number; qualityMinPercent: number };
  participationRules: RuleBucketConfig;
  popularityRules: RuleBucketConfig;
  penalty: { allowDeduction: boolean; maxDeduction: number };
  workflow: { allowManagerSelfApproval: boolean; selfApprovalFallbackApproverId: string };
  leavePolicy: {
    annualLeave: { serviceYears2To5: number; serviceYearsGT5: number; intern: number };
    carryForwardExpiryMonth: number;
    carryForwardExpiryDay: number;
    allowNextYearBookingAfterMonth: number;
    allowNextYearBookingAfterDay: number;
    requireExportPreviousYearBeforeNextYearBooking: boolean;
    prorateAfterYears: number;
  };
};

export type ScoringConfigRecord = {
  id: number;
  key: string;
  versionNo: number;
  isActive: boolean;
  updatedBy?: string;
  updatedAt?: string;
  config: ScoringConfig;
};

export type PerformanceInputRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  periodType: PeriodType;
  periodYear: number;
  periodNo: number;
  periodLabel: string;
  kpiAchieved: number;
  kpiTotal: number;
  tasksAchieved: number;
  tasksTotal: number;
  qualityTotalTasks: number;
  qualityErrors: number;
  participation: Record<string, number>;
  popularity: Record<string, number>;
  updatedBy?: string;
};

export type PerformanceScoreRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  periodType: PeriodType;
  periodYear: number;
  periodNo: number;
  periodLabel: string;
  performance60: number;
  participation25: number;
  popularity15: number;
  rawScore: number;
  penaltyDeduction: number;
  finalScore: number;
  manualOverrideScore?: number;
  overrideComment?: string;
  formulaSnapshot: Record<string, unknown>;
  inputSnapshot: Record<string, unknown>;
  status: ScoreStatus;
  calculatedBy?: string;
  calculatedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
};

export type PenaltyTypeRecord = {
  id: string;
  typeCode: string;
  typeName: string;
  active: boolean;
};

export type PenaltyRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  penaltyTypeCode: string;
  penaltyDate: string;
  reason: string;
  status: PenaltyStatus;
  attachment?: string;
  linkedLeaveRequestId?: string;
  createdBy?: string;
  penaltyCategory?: 'standard' | 'cash';
  cashAmount?: number;
};

export type EmployeeServiceYearRecord = {
  employeeId: string;
  employeeName: string;
  hireDate: string;
  employmentType: EmploymentType;
  serviceYears: number;
  lastCalculatedAt?: string;
};

export type ManagerSelfApprovalPolicy = {
  allowManagerSelfApproval: boolean;
  fallbackApproverId: string;
};

export type AnnualLeaveEntitlement = {
  employeeId: string;
  year: number;
  employmentType: EmploymentType;
  serviceYears: number;
  entitlementDays: number;
  prorated: boolean;
  rewardDays?: number;
};

export type LeaveEntitlementSnapshot = {
  employeeId: string;
  year: number;
  employmentType: EmploymentType;
  serviceYears: number;
  serviceTier: LeaveEntitlementTier;
  annualLeaveDays: number;
  sickLeaveDays: number;
  wfhDaysPerMonth: number;
  unpaidLeaveDays: number;
  rewardDays: number;
  prorated: boolean;
};


const CONFIG_KEY = '3ps-default';

const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: { performance: 60, participation: 25, popularity: 15 },
  performance: { kpiWeight: 50, tasksWeight: 25, qualityWeight: 25, qualityMinPercent: 80 },
  participationRules: {
    PLAY_ATTENDANCE: { pointsPerUnit: 2, maxPoints: 20 },
    PLAY_WINNER: { pointsPerUnit: 5, maxPoints: 20 },
    LEARN_ATTENDANCE: { pointsPerUnit: 2, maxPoints: 20 },
    HCM_STICKERS: { pointsPerUnit: 1, maxPoints: 20 },
    bucketMaxPoints: 80,
  },
  popularityRules: {
    GRATITUDE_STICKER: { pointsPerUnit: 10, maxPoints: 10 },
    VOTING_FORM: { pointsPerUnit: 5, maxPoints: 20 },
    bucketMaxPoints: 30,
  },
  penalty: { allowDeduction: true, maxDeduction: 40 },
  workflow: { allowManagerSelfApproval: true, selfApprovalFallbackApproverId: 'hr-001' },
  leavePolicy: {
    annualLeave: { serviceYears2To5: 12, serviceYearsGT5: 16, intern: 0 },
    carryForwardExpiryMonth: 2,
    carryForwardExpiryDay: 28,
    allowNextYearBookingAfterMonth: 12,
    allowNextYearBookingAfterDay: 31,
    requireExportPreviousYearBeforeNextYearBooking: true,
    prorateAfterYears: 2,
  },
};

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function roundHalf(value: number) { return Math.round(value * 2) / 2; }

function isScoreRule(value: unknown): value is ScoreRule {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return typeof r.pointsPerUnit === 'number' && Number.isFinite(r.pointsPerUnit)
    && typeof r.maxPoints === 'number' && Number.isFinite(r.maxPoints);
}

function parseBucketRules(bucketConfig: RuleBucketConfig | undefined, fallback: RuleBucketConfig) {
  const source = bucketConfig || fallback;
  const normalizedRules: Record<string, ScoreRule> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === 'bucketMaxPoints') continue;
    if (!isScoreRule(value)) continue;
    normalizedRules[key] = { pointsPerUnit: Math.max(0, Number(value.pointsPerUnit || 0)), maxPoints: Math.max(0, Number(value.maxPoints || 0)) };
  }
  const rawBucketMax = Number(source.bucketMaxPoints);
  const bucketMaxPoints = Number.isFinite(rawBucketMax)
    ? Math.max(0, rawBucketMax)
    : Math.max(1, Object.values(normalizedRules).reduce((sum, rule) => sum + rule.maxPoints, 0));
  return { rules: normalizedRules, bucketMaxPoints };
}

function ratio(numerator: number, denominator: number) {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  if (!Number.isFinite(numerator) || numerator <= 0) return 0;
  return clamp(numerator / denominator, 0, 1);
}

function normalizeDate(date: Date | string | null | undefined) {
  if (!date) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (date instanceof Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const str = String(date).split('T')[0];
  const parts = str.split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return new Date(year, month, day, 0, 0, 0, 0);
    }
  }
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateOnly(date: Date | string) {
  const d = normalizeDate(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function prorateUnitsToYearWindow(params: { startDate: Date | string; endDate: Date | string; units: number; year: number }) {
  const safeUnits = Number(params.units || 0);
  if (!Number.isFinite(safeUnits) || safeUnits <= 0) return 0;
  const start = normalizeDate(params.startDate);
  const end = normalizeDate(params.endDate);
  if (end < start) return 0;
  const windowStart = normalizeDate(`${params.year}-01-01`);
  const windowEnd = normalizeDate(`${params.year}-12-31`);
  if (end < windowStart || start > windowEnd) return 0;
  const overlapStart = start > windowStart ? start : windowStart;
  const overlapEnd = end < windowEnd ? end : windowEnd;
  const dayMs = 1000 * 60 * 60 * 24;
  const totalDays = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;
  const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / dayMs) + 1;
  if (totalDays <= 0 || overlapDays <= 0) return 0;
  return (safeUnits * overlapDays) / totalDays;
}

function parseJson<T>(value: any, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === 'object') return value as T;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}



const DEFAULT_PENALTY_TYPES: Array<{
  id: string;
  typeCode: string;
  typeName: string;
}> = [
  { id: 'PT-LATE', typeCode: 'LATE', typeName: 'Late Arrival' },
  { id: 'PT-ABSENT_NO_LEAVE', typeCode: 'ABSENT_NO_LEAVE', typeName: 'Absent Without Leave' },
  { id: 'PT-POLICY', typeCode: 'POLICY', typeName: 'Policy Violation' },
  { id: 'PT-UNPAID_LEAVE', typeCode: 'UNPAID_LEAVE', typeName: 'Unpaid Leave Impact' },
  { id: 'PT-TIER1', typeCode: 'TIER_1', typeName: 'Tier 1' },
  { id: 'PT-TIER2', typeCode: 'TIER_2', typeName: 'Tier 2' },
  { id: 'PT-TIER3', typeCode: 'TIER_3', typeName: 'Tier 3' },
];

function sanitizePenaltyTypeCode(value: string) {
  const n = String(value || '').trim().toUpperCase();
  if (!n) throw new Error('penaltyTypeCode is required');
  return n;
}

function normalizePenaltyCreatePayload(payload: any): Omit<PenaltyRecord, 'id'> {
  const reason = String(payload.reason || '').trim();
  if (!reason) throw new Error('reason is required');
  const employeeId = String(payload.employeeId || '').trim();
  const employeeName = String(payload.employeeName || '').trim();
  const department = String(payload.department || '').trim();
  if (!employeeId || !employeeName || !department) throw new Error('employeeId, employeeName and department are required');
  return {
    ...payload,
    employeeId, employeeName, department,
    penaltyTypeCode: sanitizePenaltyTypeCode(payload.penaltyTypeCode),
    penaltyDate: payload.penaltyDate,
    reason,
    attachment: payload.attachment ? String(payload.attachment).trim() || undefined : undefined,
    linkedLeaveRequestId: payload.linkedLeaveRequestId ? String(payload.linkedLeaveRequestId).trim() || undefined : undefined,
    createdBy: payload.createdBy ? String(payload.createdBy).trim() || undefined : undefined,
    penaltyCategory: payload.penaltyCategory || (Number(payload.cashAmount || 0) > 0 ? 'cash' : 'standard'),
    cashAmount: Number(payload.cashAmount || 0),
  };
}

function normalizePenaltyPatch(existing: PenaltyRecord, patch: Partial<PenaltyRecord>): PenaltyRecord {
  const reasonCandidate = patch.reason === undefined ? existing.reason : String(patch.reason || '').trim();
  if (!reasonCandidate) throw new Error('reason is required');
  return {
    ...existing, ...patch,
    penaltyTypeCode: patch.penaltyTypeCode ? sanitizePenaltyTypeCode(patch.penaltyTypeCode) : existing.penaltyTypeCode,
    penaltyDate: patch.penaltyDate ? toDateOnly(patch.penaltyDate) : existing.penaltyDate,
    reason: reasonCandidate,
  };
}

function monthsDiffInclusive(from: Date, to: Date) {
  const yearDiff = to.getFullYear() - from.getFullYear();
  const monthDiff = to.getMonth() - from.getMonth();
  return Math.max(0, yearDiff * 12 + monthDiff + 1);
}

function getLeaveEntitlementTier(serviceYears: number): LeaveEntitlementTier {
  if (serviceYears > 5) return 'GT_5';
  if (serviceYears > 2) return 'GT_2_AND_LE_5';
  return 'LE_2_AND_BELOW';
}

function normalizePeriodNo(periodType: PeriodType, periodNo?: number): number {
  if (periodType === 'yearly') return 1;
  const n = Number(periodNo);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (periodType === 'quarterly') return Math.min(4, n);
  if (periodType === 'monthly') return Math.min(12, n);
  return 1;
}

function buildPeriodLabel(periodType: PeriodType, year: number, periodNo: number): string {
  if (periodType === 'yearly') return `${year} Annual`;
  if (periodType === 'quarterly') return `Q${periodNo} ${year}`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[periodNo - 1] || `M${periodNo}`} ${year}`;
}

function resolvePeriodRange(periodType: PeriodType, year: number, periodNo: number): { startDate: string; endDate: string } {
  if (periodType === 'yearly') return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  if (periodType === 'quarterly') {
    const monthStart = (periodNo - 1) * 3 + 1;
    const monthEnd = monthStart + 2;
    const startDate = `${year}-${String(monthStart).padStart(2, '0')}-01`;
    const endDate = new Date(year, monthEnd, 0).toISOString().slice(0, 10);
    return { startDate, endDate };
  }
  const startDate = `${year}-${String(periodNo).padStart(2, '0')}-01`;
  const endDate = new Date(year, periodNo, 0).toISOString().slice(0, 10);
  return { startDate, endDate };
}

function sanitizeScoringConfig(config?: Partial<ScoringConfig>): ScoringConfig {
  const incomingParticipationRules = (config?.participationRules || {}) as RuleBucketConfig;
  const incomingPopularityRules = (config?.popularityRules || {}) as RuleBucketConfig;
  const mergedParticipationRules: RuleBucketConfig = { ...(DEFAULT_SCORING_CONFIG.participationRules as RuleBucketConfig), ...incomingParticipationRules };
  const mergedPopularityRules: RuleBucketConfig = { ...(DEFAULT_SCORING_CONFIG.popularityRules as RuleBucketConfig), ...incomingPopularityRules };
  const merged: ScoringConfig = {
    ...DEFAULT_SCORING_CONFIG, ...(config || {}),
    weights: { ...DEFAULT_SCORING_CONFIG.weights, ...(config?.weights || {}) },
    performance: { ...DEFAULT_SCORING_CONFIG.performance, ...(config?.performance || {}) },
    participationRules: mergedParticipationRules,
    popularityRules: mergedPopularityRules,
    penalty: { ...DEFAULT_SCORING_CONFIG.penalty, ...(config?.penalty || {}) },
    workflow: { ...DEFAULT_SCORING_CONFIG.workflow, ...(config?.workflow || {}) },
    leavePolicy: { ...DEFAULT_SCORING_CONFIG.leavePolicy, ...(config?.leavePolicy || {}), annualLeave: { ...DEFAULT_SCORING_CONFIG.leavePolicy.annualLeave, ...(config?.leavePolicy?.annualLeave || {}) } },
  };

  const weightSum = merged.weights.performance + merged.weights.participation + merged.weights.popularity;
  if (Math.abs(weightSum - 100) > 0.001) throw new Error('weights.performance + weights.participation + weights.popularity must equal 100');
  const perfWeightSum = merged.performance.kpiWeight + merged.performance.tasksWeight + merged.performance.qualityWeight;
  if (Math.abs(perfWeightSum - 100) > 0.001) throw new Error('performance.kpiWeight + performance.tasksWeight + performance.qualityWeight must equal 100');
  if (merged.performance.qualityMinPercent < 0 || merged.performance.qualityMinPercent > 100) throw new Error('performance.qualityMinPercent must be between 0 and 100');
  if (merged.penalty.maxDeduction < 0 || merged.penalty.maxDeduction > 100) throw new Error('penalty.maxDeduction must be between 0 and 100');

  const participationRules = parseBucketRules(merged.participationRules, DEFAULT_SCORING_CONFIG.participationRules);
  const popularityRules = parseBucketRules(merged.popularityRules, DEFAULT_SCORING_CONFIG.popularityRules);
  if (Object.keys(participationRules.rules).length === 0) throw new Error('participationRules must contain at least one scoring rule');
  if (Object.keys(popularityRules.rules).length === 0) throw new Error('popularityRules must contain at least one scoring rule');

  merged.participationRules = { ...participationRules.rules, bucketMaxPoints: participationRules.bucketMaxPoints };
  merged.popularityRules = { ...popularityRules.rules, bucketMaxPoints: popularityRules.bucketMaxPoints };

  return merged;
}

// ─── Performance Config ───────────────────────────────────────────────────────

export async function ensurePerformanceHrTables(): Promise<void> {
  const now = new Date();
  for (const item of DEFAULT_PENALTY_TYPES) {
    await prisma.penalty_types.upsert({
      where: { id: item.id },
      update: { 
        type_code: item.typeCode,
        type_name: item.typeName,
        updated_at: now
      },
      create: {
        id: item.id,
        type_code: item.typeCode,
        type_name: item.typeName,
        default_severity: 'low',
        active: true,
        created_at: now,
        updated_at: now
      }
    });
  }
}

async function assertPenaltyTypeExists(typeCode: string) {
  const data = await prisma.penalty_types.findUnique({
    where: { type_code: typeCode }
  });

  if (!data) {
    // If not found in DB, try to run init once
    await ensurePerformanceHrTables();
    const secondTry = await prisma.penalty_types.findUnique({
      where: { type_code: typeCode }
    });
    if (!secondTry) throw new Error(`Penalty type '${typeCode}' does not exist and could not be initialized`);
  }
}

export async function getActivePerformanceConfig(): Promise<ScoringConfigRecord> {
  const data = await prisma.performance_config.findFirst({
    where: { config_key: CONFIG_KEY, is_active: true },
    orderBy: [
      { version_no: 'desc' },
      { updated_at: 'desc' }
    ]
  });

  if (!data) return { id: 0, key: CONFIG_KEY, versionNo: 1, isActive: true, updatedBy: 'system', config: DEFAULT_SCORING_CONFIG };

  return {
    id: Number(data.id),
    key: data.config_key,
    versionNo: Number(data.version_no || 1),
    isActive: Boolean(data.is_active),
    updatedBy: data.updated_by ?? undefined,
    updatedAt: data.updated_at ? data.updated_at.toISOString() : undefined,
    config: sanitizeScoringConfig(parseJson<ScoringConfig>(data.config_json, DEFAULT_SCORING_CONFIG)),
  };
}

export async function savePerformanceConfig(config: Partial<ScoringConfig>, actor = 'admin'): Promise<ScoringConfigRecord> {
  const sanitized = sanitizeScoringConfig(config);

  const current = await prisma.performance_config.findFirst({
    where: { config_key: CONFIG_KEY, is_active: true },
    orderBy: { version_no: 'desc' }
  });

  const currentVersion = Number(current?.version_no || 0);

  await prisma.performance_config.updateMany({
    where: { config_key: CONFIG_KEY, is_active: true },
    data: { is_active: false, updated_at: new Date() }
  });

  await prisma.performance_config.create({
    data: {
      config_key: CONFIG_KEY,
      config_json: JSON.stringify(sanitized),
      is_active: true,
      version_no: currentVersion + 1,
      updated_by: actor,
      created_at: new Date(),
      updated_at: new Date()
    }
  });

  return getActivePerformanceConfig();
}

export async function getManagerSelfApprovalPolicy(): Promise<ManagerSelfApprovalPolicy> {
  const config = await getActivePerformanceConfig();
  return {
    allowManagerSelfApproval: Boolean(config.config.workflow.allowManagerSelfApproval),
    fallbackApproverId: config.config.workflow.selfApprovalFallbackApproverId || 'hr-001',
  };
}

export async function getLeavePolicyConfig() {
  const config = await getActivePerformanceConfig();
  return config.config.leavePolicy;
}

// ─── Penalty Types ────────────────────────────────────────────────────────────

export async function listPenaltyTypes(activeOnly = true): Promise<PenaltyTypeRecord[]> {
  const data = await prisma.penalty_types.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { type_name: 'asc' }
  });

  return (data ?? []).map((row) => ({
    id: row.id,
    typeCode: row.type_code,
    typeName: row.type_name,
    active: Boolean(row.active),
  }));
}

export async function upsertPenaltyType(payload: PenaltyTypeRecord) {
  const normalizedTypeName = String(payload.typeName || '').trim();
  if (!normalizedTypeName) throw new Error('typeName is required');

  await prisma.penalty_types.upsert({
    where: { id: payload.id },
    update: { 
      type_code: payload.typeCode, 
      type_name: normalizedTypeName, 
      active: payload.active, 
      updated_at: new Date() 
    },
    create: {
      id: payload.id, 
      type_code: payload.typeCode, 
      type_name: normalizedTypeName, 
      default_severity: 'medium',
      active: payload.active, 
      created_at: new Date(), 
      updated_at: new Date()
    }
  });
}

// ─── Penalties ────────────────────────────────────────────────────────────────

function mapPenaltyRow(row: any): PenaltyRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department,
    penaltyTypeCode: row.penalty_type_code,
    penaltyDate: toDateOnly(row.penalty_date),
    reason: String(row.reason || ''),
    status: (row.status as PenaltyStatus) || 'active',
    attachment: row.attachment || undefined,
    linkedLeaveRequestId: row.linked_leave_request_id || undefined,
    createdBy: row.created_by || undefined,
    penaltyCategory: (row.penalty_category as 'standard' | 'cash') || 'standard',
    cashAmount: Number(row.cash_amount || 0),
  };
}

export async function listPenalties(filters: {
  employeeId?: string;
  year?: number;
  department?: string;
  penaltyTypeCode?: string;
} = {}): Promise<PenaltyRecord[]> {
  const data = await prisma.penalties.findMany({
    where: {
      employee_id: filters.employeeId || undefined,
      department: filters.department || undefined,
      penalty_type_code: filters.penaltyTypeCode || undefined,
      penalty_date: typeof filters.year === 'number' ? {
        gte: `${filters.year}-01-01`,
        lte: `${filters.year}-12-31`
      } : undefined
    },
    orderBy: [
      { penalty_date: 'desc' },
      { created_at: 'desc' }
    ]
  });
  
  return (data ?? []).map(mapPenaltyRow);
}

async function getPenaltyById(id: string): Promise<PenaltyRecord | null> {
  const data = await prisma.penalties.findUnique({ where: { id } });
  if (!data) return null;
  return mapPenaltyRow(data);
}

function deriveSeverityFromTypeCode(typeCode: string): 'low' | 'medium' | 'high' {
  const code = String(typeCode || '').toUpperCase();
  if (code.includes('ABSENT') || code === 'POLICY_VIOLATION' || code.includes('CONDUCT')) return 'high';
  if (code.includes('LATE') || code.includes('POLICY') || code.includes('UNPAID')) return 'medium';
  return 'low';
}

export async function createPenalty(payload: Omit<PenaltyRecord, 'id'>): Promise<PenaltyRecord> {
  const normalizedPayload = normalizePenaltyCreatePayload(payload);
  await assertPenaltyTypeExists(normalizedPayload.penaltyTypeCode);
  const record: PenaltyRecord = { ...normalizedPayload, id: randomId('PEN') };
  const severity = (payload as any).severity || deriveSeverityFromTypeCode(record.penaltyTypeCode);

  await prisma.penalties.create({
    data: {
      id: record.id,
      employee_id: record.employeeId,
      employee_name: record.employeeName,
      department: record.department,
      penalty_type_code: record.penaltyTypeCode,
      penalty_date: record.penaltyDate,
      reason: record.reason,
      attachment: record.attachment || null,
      linked_leave_request_id: record.linkedLeaveRequestId || null,
      created_by: record.createdBy || null,
      penalty_category: record.penaltyCategory || 'standard',
      cash_amount: record.cashAmount || 0,
      severity,
      created_at: new Date(),
      updated_at: new Date()
    }
  });

  return record;
}

export async function updatePenalty(id: string, patch: Partial<PenaltyRecord>): Promise<PenaltyRecord | null> {
  const existing = await getPenaltyById(id);
  if (!existing) return null;
  const next = normalizePenaltyPatch(existing, patch);
  await assertPenaltyTypeExists(next.penaltyTypeCode);

  const updateData: any = {
    employee_id: next.employeeId,
    employee_name: next.employeeName,
    department: next.department,
    penalty_type_code: next.penaltyTypeCode,
    penalty_date: next.penaltyDate,
    reason: next.reason,
    attachment: next.attachment || null,
    linked_leave_request_id: next.linkedLeaveRequestId || null,
    penalty_category: next.penaltyCategory || 'standard',
    cash_amount: next.cashAmount || 0,
    updated_at: new Date()
  };
  
  if ((patch as any).severity) updateData.severity = (patch as any).severity;
  if ((patch as any).status) updateData.status = (patch as any).status;

  await prisma.penalties.update({
    where: { id },
    data: updateData
  });

  return next;
}

export async function deletePenalty(id: string): Promise<void> {
  await prisma.penalties.delete({ where: { id } });
}


// ─── Employee Service Years ───────────────────────────────────────────────────

export async function syncEmployeeServiceYears(employeeId?: string): Promise<EmployeeServiceYearRecord[]> {
  const users = await prisma.users.findMany({
    where: employeeId ? { id: employeeId } : undefined,
    select: { id: true, name: true, join_date: true, role: true }
  });

  const now = new Date();
  const upsertPromises = users.map(user => {
    const joinDate = toDateOnly(user.join_date || new Date().toISOString().slice(0, 10));
    const serviceYears = Math.max(0, (normalizeDate(new Date()).getTime() - normalizeDate(joinDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    const role = String(user.role || '').toLowerCase();
    const employmentType = role === 'intern' ? 'Intern' : 'Permanent';

    return prisma.employee_service_years.upsert({
      where: { employee_id: user.id },
      update: {
        employee_name: user.name,
        hire_date: joinDate,
        employment_type: employmentType,
        service_years: round2(serviceYears),
        last_calculated_at: now,
        updated_at: now
      },
      create: {
        employee_id: user.id,
        employee_name: user.name,
        hire_date: joinDate,
        employment_type: employmentType,
        service_years: round2(serviceYears),
        last_calculated_at: now,
        created_at: now,
        updated_at: now
      }
    });
  });

  await Promise.all(upsertPromises);
  return listEmployeeServiceYears(employeeId);
}

export async function listEmployeeServiceYears(employeeId?: string): Promise<EmployeeServiceYearRecord[]> {
  const data = await prisma.employee_service_years.findMany({
    where: employeeId ? { employee_id: employeeId } : undefined,
    orderBy: { employee_name: 'asc' }
  });

  return (data ?? []).map((row) => ({
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    hireDate: toDateOnly(row.hire_date),
    employmentType: row.employment_type as EmploymentType,
    serviceYears: Number(row.service_years || 0),
    lastCalculatedAt: row.last_calculated_at ? row.last_calculated_at.toISOString() : undefined,
  }));
}

export async function upsertEmployeeServiceYear(record: EmployeeServiceYearRecord) {
  const now = new Date();
  await prisma.employee_service_years.upsert({
    where: { employee_id: record.employeeId },
    update: {
      employee_name: record.employeeName,
      hire_date: toDateOnly(record.hireDate),
      employment_type: record.employmentType,
      service_years: round2(record.serviceYears),
      last_calculated_at: now,
      updated_at: now
    },
    create: {
      employee_id: record.employeeId,
      employee_name: record.employeeName,
      hire_date: toDateOnly(record.hireDate),
      employment_type: record.employmentType,
      service_years: round2(record.serviceYears),
      last_calculated_at: now,
      created_at: now,
      updated_at: now
    }
  });
}

export async function calculateLeaveEntitlementSnapshot(employeeId: string, year: number, options?: { skipSync?: boolean }): Promise<LeaveEntitlementSnapshot> {
  if (!options?.skipSync) {
    await syncEmployeeServiceYears(employeeId);
  }
  const settings = await getSystemSettings();
  const serviceRows = await listEmployeeServiceYears(employeeId);
  const service = serviceRows[0];
  if (!service) throw new Error('Employee service year record not found');

  const hireDate = normalizeDate(service.hireDate);
  const targetYearEnd = new Date(year, 11, 31);
  const serviceYearsAtYearEnd = Math.max(0, (targetYearEnd.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  const serviceTier = getLeaveEntitlementTier(serviceYearsAtYearEnd);
  const prorated = serviceYearsAtYearEnd < 1;

  if (service.employmentType === 'Intern') {
    return {
      employeeId,
      year,
      employmentType: 'Intern',
      serviceYears: round2(serviceYearsAtYearEnd),
      serviceTier: 'LE_2_AND_BELOW',
      annualLeaveDays: 0,
      sickLeaveDays: 1,
      wfhDaysPerMonth: 2,
      unpaidLeaveDays: 10,
      rewardDays: 0,
      prorated: false,
    };
  }

  const annualByTier: Record<LeaveEntitlementTier, number> = {
    LE_2_AND_BELOW: settings.leavePolicy.annualLeaveDaysLTE2Years ?? 8,
    GT_2_AND_LE_5: settings.leavePolicy.annualLeaveDays2To5Years ?? 12,
    GT_5: settings.leavePolicy.annualLeaveDaysGT5Years ?? 16,
  };

  const sickByTier: Record<LeaveEntitlementTier, number> = {
    LE_2_AND_BELOW: settings.leavePolicy.mcDaysLTE2Years ?? 14,
    GT_2_AND_LE_5: settings.leavePolicy.mcDays2To5Years ?? 18,
    GT_5: settings.leavePolicy.mcDaysGT5Years ?? 22,
  };

  const bonusDays = settings.leavePolicy.annualLeaveCompanyBonusDays || 0;

  const annualBase = annualByTier[serviceTier];
  const annualLeaveDays = annualBase + bonusDays;

  return {
    employeeId,
    year,
    employmentType: service.employmentType,
    serviceYears: round2(serviceYearsAtYearEnd),
    serviceTier,
    annualLeaveDays,
    sickLeaveDays: sickByTier[serviceTier],
    wfhDaysPerMonth: 4,
    unpaidLeaveDays: 10,
    rewardDays: 0,
    prorated,
  };
}

export async function calculateAnnualLeaveEntitlement(employeeId: string, year: number): Promise<AnnualLeaveEntitlement> {
  const snapshot = await calculateLeaveEntitlementSnapshot(employeeId, year);
  return {
    employeeId,
    year,
    employmentType: snapshot.employmentType,
    serviceYears: snapshot.serviceYears,
    entitlementDays: snapshot.annualLeaveDays,
    prorated: snapshot.prorated,
    rewardDays: snapshot.rewardDays,
  };
}

// ─── Performance Inputs ───────────────────────────────────────────────────────

function mapInputRow(row: any): PerformanceInputRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department,
    periodType: row.period_type as PeriodType,
    periodYear: Number(row.period_year),
    periodNo: Number(row.period_no),
    periodLabel: row.period_label,
    kpiAchieved: Number(row.kpi_achieved || 0),
    kpiTotal: Number(row.kpi_total || 0),
    tasksAchieved: Number(row.tasks_achieved || 0),
    tasksTotal: Number(row.tasks_total || 0),
    qualityTotalTasks: Number(row.quality_total_tasks || 0),
    qualityErrors: Number(row.quality_errors || 0),
    participation: parseJson<Record<string, number>>(row.participation_json, {}),
    popularity: parseJson<Record<string, number>>(row.popularity_json, {}),
    updatedBy: row.updated_by || undefined,
  };
}

export async function upsertPerformanceInput(
  payload: Omit<PerformanceInputRecord, 'id' | 'periodLabel'> & { periodLabel?: string },
): Promise<PerformanceInputRecord> {
  const periodNo = normalizePeriodNo(payload.periodType, payload.periodNo);
  const periodLabel = payload.periodLabel || buildPeriodLabel(payload.periodType, payload.periodYear, periodNo);
  
  const existing = await prisma.performance_inputs.findFirst({
    where: {
      employee_id: payload.employeeId,
      period_type: payload.periodType as any,
      period_year: payload.periodYear,
      period_no: periodNo
    }
  });

  const id = existing?.id || randomId('PIN');
  const now = new Date();

  await prisma.performance_inputs.upsert({
    where: { id },
    update: {
      employee_name: payload.employeeName,
      department: payload.department,
      kpi_achieved: Number(payload.kpiAchieved || 0),
      kpi_total: Number(payload.kpiTotal || 0),
      tasks_achieved: Number(payload.tasksAchieved || 0),
      tasks_total: Number(payload.tasksTotal || 0),
      quality_total_tasks: Number(payload.qualityTotalTasks || 0),
      quality_errors: Number(payload.qualityErrors || 0),
      participation_json: JSON.stringify(payload.participation || {}),
      popularity_json: JSON.stringify(payload.popularity || {}),
      updated_by: payload.updatedBy ?? null,
      updated_at: now
    },
    create: {
      id,
      employee_id: payload.employeeId,
      employee_name: payload.employeeName,
      department: payload.department,
      period_type: payload.periodType as any,
      period_year: payload.periodYear,
      period_no: periodNo,
      period_label: periodLabel,
      kpi_achieved: Number(payload.kpiAchieved || 0),
      kpi_total: Number(payload.kpiTotal || 0),
      tasks_achieved: Number(payload.tasksAchieved || 0),
      tasks_total: Number(payload.tasksTotal || 0),
      quality_total_tasks: Number(payload.qualityTotalTasks || 0),
      quality_errors: Number(payload.qualityErrors || 0),
      participation_json: JSON.stringify(payload.participation || {}),
      popularity_json: JSON.stringify(payload.popularity || {}),
      updated_by: payload.updatedBy ?? null,
      created_at: now,
      updated_at: now
    }
  });

  const refreshed = await getPerformanceInput(payload.employeeId, payload.periodType, payload.periodYear, periodNo);
  return refreshed!;
}

export async function getPerformanceInput(
  employeeId: string,
  periodType: PeriodType,
  periodYear: number,
  periodNo?: number,
): Promise<PerformanceInputRecord | null> {
  const normalizedNo = normalizePeriodNo(periodType, periodNo);
  const data = await prisma.performance_inputs.findFirst({
    where: {
      employee_id: employeeId,
      period_type: periodType as any,
      period_year: periodYear,
      period_no: normalizedNo
    }
  });

  if (!data) return null;
  return mapInputRow(data);
}

export async function listPerformanceInputs(filters: {
  employeeId?: string;
  periodType?: PeriodType;
  periodYear?: number;
  periodNo?: number;
  department?: string;
}): Promise<PerformanceInputRecord[]> {
  const data = await prisma.performance_inputs.findMany({
    where: {
      employee_id: filters.employeeId || undefined,
      period_type: (filters.periodType as any) || undefined,
      period_year: filters.periodYear || undefined,
      period_no: filters.periodNo || undefined,
      department: filters.department || undefined
    },
    orderBy: [
      { period_year: 'desc' },
      { period_type: 'asc' },
      { period_no: 'desc' },
      { employee_name: 'asc' }
    ]
  });

  return (data ?? []).map(mapInputRow);
}

export type PerformanceActivity = {
  id: string;
  employeeId: string;
  activityName: string;
  category: string;
  scoreBucket: string;
  score: number;
  score_value: number; // Added for compatibility
  pillar: 'Performance' | 'Participation' | 'Popularity';
  activityDate: string;
  createdAt: string;
  created_at: string; // Added for compatibility
};

// ─── Performance Scores ───────────────────────────────────────────────────────


function mapScoreRow(row: any): PerformanceScoreRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department,
    periodType: row.period_type as PeriodType,
    periodYear: Number(row.period_year),
    periodNo: Number(row.period_no),
    periodLabel: row.period_label,
    performance60: Number(row.performance_60 || 0),
    participation25: Number(row.participation_25 || 0),
    popularity15: Number(row.popularity_15 || 0),
    rawScore: Number(row.raw_score || 0),
    penaltyDeduction: Number(row.penalty_deduction || 0),
    finalScore: Number(row.final_score || 0),
    manualOverrideScore: row.manual_override_score !== null && row.manual_override_score !== undefined ? Number(row.manual_override_score) : undefined,
    overrideComment: row.override_comment || undefined,
    formulaSnapshot: parseJson<Record<string, unknown>>(row.formula_snapshot_json, {}),
    inputSnapshot: parseJson<Record<string, unknown>>(row.input_snapshot_json, {}),
    status: row.status as ScoreStatus,
    calculatedBy: row.calculated_by || undefined,
    calculatedAt: row.calculated_at ? row.calculated_at.toISOString() : undefined,
    approvedBy: row.approved_by || undefined,
    approvedAt: row.approved_at ? row.approved_at.toISOString() : undefined,
  };
}

async function listPenaltiesForPeriod(employeeId: string, periodType: PeriodType, periodYear: number, periodNo: number): Promise<PenaltyRecord[]> {
  const range = resolvePeriodRange(periodType, periodYear, periodNo);
  const data = await prisma.penalties.findMany({
    where: {
      employee_id: employeeId,
      penalty_date: { gte: range.startDate, lte: range.endDate }
    },
    orderBy: [
      { penalty_date: 'asc' },
      { id: 'asc' }
    ]
  });

  return (data ?? []).map(mapPenaltyRow);
}

function scoreBucket(items: Record<string, number>, rules: Record<string, ScoreRule>, bucketMaxPoints: number) {
  const detail: Record<string, number> = {};
  let total = 0;
  Object.keys(rules).sort().forEach((key) => {
    const rule = rules[key];
    if (!rule || typeof rule.pointsPerUnit !== 'number' || typeof rule.maxPoints !== 'number') return;
    const units = Math.max(0, Number(items[key] || 0));
    const value = Math.min(rule.maxPoints, units * rule.pointsPerUnit);
    detail[key] = round2(value);
    total += value;
  });
  const maxPoints = bucketMaxPoints > 0 ? bucketMaxPoints : Math.max(1, total);
  return { totalPoints: round2(total), maxPoints: round2(maxPoints), normalizedPercent: round2(clamp((total / maxPoints) * 100, 0, 100)), detail };
}

function calculate3Ps(input: PerformanceInputRecord, config: ScoringConfig, penalties: PenaltyRecord[]) {
  const kpiScore = ratio(input.kpiAchieved, input.kpiTotal) * config.performance.kpiWeight;
  const tasksScore = ratio(input.tasksAchieved, input.tasksTotal) * config.performance.tasksWeight;
  const qualityRatio = ratio(input.qualityTotalTasks - input.qualityErrors, input.qualityTotalTasks);
  const qualityPercent = qualityRatio * 100;
  const qualityScore = qualityPercent >= config.performance.qualityMinPercent ? qualityRatio * config.performance.qualityWeight : 0;
  const performanceRawPercent = clamp(kpiScore + tasksScore + qualityScore, 0, 100);

  const participationRuleSet = parseBucketRules(config.participationRules, DEFAULT_SCORING_CONFIG.participationRules);
  const popularityRuleSet = parseBucketRules(config.popularityRules, DEFAULT_SCORING_CONFIG.popularityRules);
  const participationBucket = scoreBucket(input.participation, participationRuleSet.rules, participationRuleSet.bucketMaxPoints);
  const popularityBucket = scoreBucket(input.popularity, popularityRuleSet.rules, popularityRuleSet.bucketMaxPoints);

  const performance60 = round2((performanceRawPercent * config.weights.performance) / 100);
  const participation25 = round2((participationBucket.normalizedPercent * config.weights.participation) / 100);
  const popularity15 = round2((popularityBucket.normalizedPercent * config.weights.popularity) / 100);
  const rawScore = round2(performance60 + participation25 + popularity15);

  const finalScore = round2(rawScore);

  return {
    performance60, participation25, popularity15, rawScore, penaltyDeduction: 0, finalScore,
    detail: {
      kpiScore: round2(kpiScore), tasksScore: round2(tasksScore), qualityScore: round2(qualityScore),
      qualityPercent: round2(qualityPercent), performanceRawPercent: round2(performanceRawPercent),
      participation: participationBucket, popularity: popularityBucket,
      penalties: penalties.map((item) => ({ id: item.id, type: item.penaltyTypeCode, points: 0 })),
    },
  };
}

export async function calculateAndSavePerformanceScore(params: {
  employeeId: string;
  periodType: PeriodType;
  periodYear: number;
  periodNo?: number;
  actor?: string;
  input?: Omit<PerformanceInputRecord, 'id' | 'periodLabel' | 'employeeId' | 'periodType' | 'periodYear' | 'periodNo'>;
}): Promise<PerformanceScoreRecord> {
  const periodNo = normalizePeriodNo(params.periodType, params.periodNo);
  const periodLabel = buildPeriodLabel(params.periodType, params.periodYear, periodNo);

  let input = await getPerformanceInput(params.employeeId, params.periodType, params.periodYear, periodNo);
  if (!input && params.input) {
    input = await upsertPerformanceInput({ employeeId: params.employeeId, ...params.input, periodType: params.periodType, periodYear: params.periodYear, periodNo, updatedBy: params.actor });
  }
  if (!input) throw new Error('Performance input is missing for the selected employee and period');

  const config = await getActivePerformanceConfig();
  const settings = await getSystemSettings();
  
  if (settings.performanceWeights) {
      config.config.weights.performance = settings.performanceWeights.performanceWeight;
      config.config.weights.participation = settings.performanceWeights.competencyWeight;
      config.config.weights.popularity = settings.performanceWeights.attitudeWeight;
      
      config.config.performance.kpiWeight = settings.performanceWeights.kpiWithinPerformanceWeight;
      config.config.performance.tasksWeight = settings.performanceWeights.taskWithinPerformanceWeight;
      config.config.performance.qualityWeight = settings.performanceWeights.qualityWithinPerformanceWeight;
  }

  const penalties = await listPenaltiesForPeriod(input.employeeId, input.periodType, input.periodYear, input.periodNo);
  const calculated = calculate3Ps(input, config.config, penalties);

  const existing = await prisma.performance_scores.findFirst({
    where: {
      employee_id: input.employeeId,
      period_type: input.periodType as any,
      period_year: input.periodYear,
      period_no: input.periodNo
    }
  });

  const id = existing?.id || randomId('PSC');
  const now = new Date();
  const formulaSnapshot = { configId: config.id, versionNo: config.versionNo, config: config.config, detail: calculated.detail };
  const inputSnapshot = { employeeId: input.employeeId, employeeName: input.employeeName, department: input.department, periodType: input.periodType, periodYear: input.periodYear, periodNo: input.periodNo, periodLabel, metrics: { kpiAchieved: input.kpiAchieved, kpiTotal: input.kpiTotal, tasksAchieved: input.tasksAchieved, tasksTotal: input.tasksTotal, qualityTotalTasks: input.qualityTotalTasks, qualityErrors: input.qualityErrors }, participation: input.participation, popularity: input.popularity, penalties };

  await prisma.performance_scores.upsert({
    where: { id },
    update: {
      performance_60: calculated.performance60,
      participation_25: calculated.participation25,
      popularity_15: calculated.popularity15,
      raw_score: calculated.rawScore,
      penalty_deduction: calculated.penaltyDeduction,
      final_score: calculated.finalScore,
      formula_snapshot_json: JSON.stringify({ ...formulaSnapshot, performanceWeights: settings.performanceWeights }), 
      input_snapshot_json: JSON.stringify(inputSnapshot),
      status: 'calculated',
      calculated_by: params.actor || 'system',
      calculated_at: now,
      updated_at: now
    },
    create: {
      id,
      employee_id: input.employeeId,
      employee_name: input.employeeName,
      department: input.department,
      period_type: input.periodType as any,
      period_year: input.periodYear,
      period_no: input.periodNo,
      period_label: input.periodLabel,
      performance_60: calculated.performance60,
      participation_25: calculated.participation25,
      popularity_15: calculated.popularity15,
      raw_score: calculated.rawScore,
      penalty_deduction: calculated.penaltyDeduction,
      final_score: calculated.finalScore,
      formula_snapshot_json: JSON.stringify({ ...formulaSnapshot, performanceWeights: settings.performanceWeights }), 
      input_snapshot_json: JSON.stringify(inputSnapshot),
      status: 'calculated',
      calculated_by: params.actor || 'system',
      calculated_at: now,
      created_at: now,
      updated_at: now
    }
  });

  const updated = await getPerformanceScore(input.employeeId, input.periodType, input.periodYear, input.periodNo);
  return updated!;
}

export async function getPerformanceScore(
  employeeId: string,
  periodType: PeriodType,
  periodYear: number,
  periodNo?: number,
): Promise<PerformanceScoreRecord | null> {
  const normalizedNo = normalizePeriodNo(periodType, periodNo);
  const data = await prisma.performance_scores.findFirst({
    where: {
      employee_id: employeeId,
      period_type: periodType as any,
      period_year: periodYear,
      period_no: normalizedNo
    }
  });

  if (!data) return null;
  return mapScoreRow(data);
}

export async function listPerformanceScores(filters: {
  employeeId?: string;
  periodType?: PeriodType;
  periodYear?: number;
  periodNo?: number;
  department?: string;
  status?: ScoreStatus | 'all';
}): Promise<PerformanceScoreRecord[]> {
  const data = await prisma.performance_scores.findMany({
    where: {
      employee_id: filters.employeeId || undefined,
      period_type: (filters.periodType as any) || undefined,
      period_year: filters.periodYear || undefined,
      period_no: filters.periodNo || undefined,
      department: filters.department || undefined,
      status: (filters.status && filters.status !== 'all') ? (filters.status as any) : undefined
    },
    orderBy: [
      { period_year: 'desc' },
      { period_type: 'desc' },
      { period_no: 'desc' },
      { employee_name: 'asc' }
    ]
  });

  return (data ?? []).map(mapScoreRow);
}

export async function approvePerformanceScore(params: {
  employeeId: string; periodType: PeriodType; periodYear: number; periodNo?: number; approver: string;
}): Promise<PerformanceScoreRecord | null> {
  const normalizedNo = normalizePeriodNo(params.periodType, params.periodNo);
  const now = new Date();
  
  await prisma.performance_scores.updateMany({
    where: {
      employee_id: params.employeeId,
      period_type: params.periodType as any,
      period_year: params.periodYear,
      period_no: normalizedNo
    },
    data: {
      status: 'approved',
      approved_by: params.approver,
      approved_at: now,
      updated_at: now
    }
  });

  return getPerformanceScore(params.employeeId, params.periodType, params.periodYear, normalizedNo);
}

export async function overridePerformanceScore(params: {
  employeeId: string; periodType: PeriodType; periodYear: number; periodNo?: number;
  overrideScore: number; comment: string; actor: string;
}) {
  const normalizedNo = normalizePeriodNo(params.periodType, params.periodNo);
  const overrideScore = clamp(Number(params.overrideScore || 0), 0, 100);
  const now = new Date();

  await prisma.performance_scores.updateMany({
    where: {
      employee_id: params.employeeId,
      period_type: params.periodType as any,
      period_year: params.periodYear,
      period_no: normalizedNo
    },
    data: {
      manual_override_score: overrideScore,
      override_comment: params.comment,
      final_score: overrideScore,
      status: 'overridden',
      approved_by: params.actor,
      approved_at: now,
      updated_at: now
    }
  });

  return getPerformanceScore(params.employeeId, params.periodType, params.periodYear, normalizedNo);
}

export async function autoCalculatePeriod(params: {
  periodType: PeriodType; periodYear: number; periodNo?: number; department?: string; actor?: string;
}) {
  const periodNo = normalizePeriodNo(params.periodType, params.periodNo);
  const inputs = await listPerformanceInputs({ periodType: params.periodType, periodYear: params.periodYear, periodNo, department: params.department });
  const results: Array<{ employeeId: string; success: boolean; error?: string; score?: PerformanceScoreRecord }> = [];

  for (const input of inputs) {
    try {
      const score = await calculateAndSavePerformanceScore({ employeeId: input.employeeId, periodType: params.periodType, periodYear: params.periodYear, periodNo, actor: params.actor });
      results.push({ employeeId: input.employeeId, success: true, score });
    } catch (error) {
      results.push({ employeeId: input.employeeId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  return results;
}

// ─── Leave Attendance Impact ──────────────────────────────────────────────────

export async function recordLeaveAttendanceImpact(params: {
  employeeId: string; employeeName: string; department: string; leaveRequestId: string;
  leaveTypeCode: string; startDate: string; endDate: string; units: number;
  withoutPay: boolean; exceedBalance: boolean; actor?: string;
}): Promise<{ penalty?: PenaltyRecord }> {
  const now = new Date();

  const existing = await prisma.employee_leave_attendance_records.findFirst({
    where: { leave_request_id: params.leaveRequestId }
  });

  if (!existing) {
    await prisma.employee_leave_attendance_records.create({
      data: {
        id: randomId('LAR'),
        employee_id: params.employeeId,
        employee_name: params.employeeName,
        department: params.department,
        leave_request_id: params.leaveRequestId,
        leave_type_code: params.leaveTypeCode,
        start_date: toDateOnly(params.startDate),
        end_date: toDateOnly(params.endDate),
        units: params.units,
        without_pay: params.withoutPay,
        exceed_balance: params.exceedBalance,
        created_at: now
      }
    });
  }

  const rule = await prisma.leave_types.findUnique({
    where: { code: params.leaveTypeCode },
    select: { auto_penalty_on_without_pay: true, auto_penalty_on_exceed_balance: true, penalty_type_code: true }
  });

  const penaltyTypeCode = rule?.penalty_type_code || 'UNPAID_LEAVE';
  const triggerWithoutPay = Boolean(rule?.auto_penalty_on_without_pay);
  const triggerExceedBalance = Boolean(rule?.auto_penalty_on_exceed_balance);

  if ((params.withoutPay && triggerWithoutPay) || (params.exceedBalance && triggerExceedBalance)) {
    const existingPenalty = await prisma.penalties.findFirst({
      where: {
        linked_leave_request_id: params.leaveRequestId,
        penalty_type_code: penaltyTypeCode
      },
      orderBy: { created_at: 'desc' }
    });

    if (existingPenalty) return {};

    const penalty = await createPenalty({
      employeeId: params.employeeId, employeeName: params.employeeName, department: params.department,
      penaltyTypeCode, penaltyDate: params.startDate,
      reason: params.withoutPay
        ? `Auto penalty from approved leave ${params.leaveRequestId}: without pay leave impact.`
        : `Auto penalty from approved leave ${params.leaveRequestId}: exceeded configured leave balance.`,
      attachment: undefined,
      status: 'active',
      linkedLeaveRequestId: params.leaveRequestId, createdBy: params.actor || 'system',
    });
    return { penalty };
  }
  return {};
}

// ─── Performance Reports ──────────────────────────────────────────────────────

export async function getPerformanceReport(params: {
  reportMode: 'employee-performance' | 'dept-leave-performance-correlation' | 'penalty-summary' | 'year-end-summary';
  year: number; periodType?: PeriodType; periodNo?: number; department?: string; employeeId?: string;
}) {
  if (params.reportMode === 'employee-performance') {
    return listPerformanceScores({ employeeId: params.employeeId, periodYear: params.year, periodType: params.periodType, periodNo: params.periodNo, department: params.department });
  }

  if (params.reportMode === 'penalty-summary') {
    const penalties = await listPenalties({ employeeId: params.employeeId, year: params.year, department: params.department });
    const grouped = penalties.reduce((acc, item) => {
      const key = `${item.employeeId}::${item.penaltyTypeCode}`;
      if (!acc[key]) acc[key] = { employeeId: item.employeeId, employeeName: item.employeeName, department: item.department, penaltyTypeCode: item.penaltyTypeCode, count: 0 };
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, { employeeId: string; employeeName: string; department: string; penaltyTypeCode: string; count: number }>);
    return Object.values(grouped);
  }

  if (params.reportMode === 'dept-leave-performance-correlation') {
    const yearStart = `${params.year}-01-01`;
    const yearEnd = `${params.year}-12-31`;

    let attendanceData = await prisma.employee_leave_attendance_records.findMany({
      where: {
        department: params.department || undefined,
        start_date: { lte: yearEnd },
        end_date: { gte: yearStart }
      }
    });

    let leaveRows: any[] = attendanceData;

    if (leaveRows.length === 0) {
      const fallbackData = await prisma.leave_requests.findMany({
        where: {
          status: 'approved',
          dept: params.department || undefined,
          start_date: { lte: yearEnd },
          end_date: { gte: yearStart }
        }
      });
      leaveRows = fallbackData.map((r) => ({ employee_id: r.employee_id, employee_name: r.employee_name, department: r.dept, start_date: r.start_date, end_date: r.end_date, units: r.units }));
    }

    const leaveByEmployee: Record<string, any> = {};
    for (const row of leaveRows) {
      const empId = String(row.employee_id || '').trim();
      if (!empId) continue;
      const overlapUnits = prorateUnitsToYearWindow({ startDate: row.start_date, endDate: row.end_date, units: Number(row.units || 0), year: params.year });
      if (!leaveByEmployee[empId]) leaveByEmployee[empId] = { employee_id: empId, employee_name: String(row.employee_name || empId), department: String(row.department || 'Unknown'), leave_units: 0 };
      leaveByEmployee[empId].leave_units += overlapUnits;
    }

    const perfData = await prisma.performance_scores.findMany({
      where: {
        period_year: params.year,
        department: params.department || undefined
      },
      select: { employee_id: true, final_score: true }
    });

    const perfByEmployee = new Map<string, { count: number; total: number }>();
    for (const row of perfData) {
      const entry = perfByEmployee.get(row.employee_id) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += Number(row.final_score || 0);
      perfByEmployee.set(row.employee_id, entry);
    }

    return Object.values(leaveByEmployee).map((item) => {
      const perf = perfByEmployee.get(item.employee_id);
      return { employee_id: item.employee_id, employee_name: item.employee_name, department: item.department, leave_units: round2(item.leave_units), avg_final_score: round2(perf ? perf.total / perf.count : 0) };
    }).sort((a, b) => { const d = a.department.localeCompare(b.department); return d !== 0 ? d : a.employee_name.localeCompare(b.employee_name); });
  }

  if (params.reportMode === 'year-end-summary') {
    const scores = await listPerformanceScores({ periodYear: params.year, department: params.department, periodType: params.periodType, periodNo: params.periodNo });
    const penalties = await listPenalties({ year: params.year, department: params.department });
    const penaltyByEmployee = penalties.reduce((acc, item) => {
      if (!acc[item.employeeId]) acc[item.employeeId] = { totalPenaltyCount: 0, activePenaltyCount: 0 };
      acc[item.employeeId].totalPenaltyCount += 1;
      return acc;
    }, {} as Record<string, { totalPenaltyCount: number; activePenaltyCount: number }>);

    return scores.map((score) => ({ 
      employeeId: score.employeeId, 
      employeeName: score.employeeName, 
      department: score.department, 
      periodLabel: score.periodLabel, 
      finalScore: score.finalScore, 
      performance60: score.performance60, 
      participation25: score.participation25, 
      popularity15: score.popularity15, 
      penaltyDeduction: score.penaltyDeduction, 
      totalPenaltyCount: penaltyByEmployee[score.employeeId]?.totalPenaltyCount || 0, 
      activePenaltyCount: penaltyByEmployee[score.employeeId]?.activePenaltyCount || 0 
    }));
  }

  return [];
}

// ─── Unified Employee Profile ─────────────────────────────────────────────────

export async function getUnifiedEmployeeProfile(params: { employeeId: string; year: number; periodType?: PeriodType }) {
  const userData = await prisma.users.findUnique({
    where: { id: params.employeeId },
    include: {
      profiles: {
        take: 1,
        orderBy: { created_at: 'desc' }
      }
    }
  });

  if (!userData) return null;

  let managerName = 'None';
  if (userData.reports_to_id) {
    const mgr = await prisma.users.findUnique({
      where: { id: userData.reports_to_id },
      select: { name: true }
    });
    if (mgr?.name) managerName = mgr.name;
  }

  const yearStart = `${params.year}-01-01`;
  const yearEnd = `${params.year}-12-31`;

  const [performance, penalties, settings, leaveHistoryRows, leaveAttendanceData, leaveBalances] = await Promise.all([
    listPerformanceScores({ employeeId: params.employeeId, periodYear: params.year, periodType: params.periodType }),
    listPenalties({ employeeId: params.employeeId, year: params.year }),
    getSystemSettings(),
    prisma.leave_requests.findMany({
      where: {
        employee_id: params.employeeId,
        start_date: { lte: yearEnd },
        end_date: { gte: yearStart }
      },
      orderBy: { requested_at: 'desc' }
    }),
    prisma.employee_leave_attendance_records.findMany({
      where: {
        employee_id: params.employeeId,
        start_date: { lte: yearEnd },
        end_date: { gte: yearStart }
      }
    }),
    prisma.leave_balances.findMany({
      where: {
        employee_id: params.employeeId,
        balance_year: params.year
      }
    })
  ]);

  const leaveHistory = leaveHistoryRows.map((row) => {
    const proratedUnits = round2(prorateUnitsToYearWindow({ startDate: row.start_date, endDate: row.end_date, units: Number(row.units || 0), year: params.year }));
    return { id: row.id, employeeId: row.employee_id, employeeName: row.employee_name, department: row.dept, leaveType: row.leave_type, startDate: toDateOnly(row.start_date), endDate: toDateOnly(row.end_date), units: proratedUnits, status: row.status, requestedAt: row.requested_at ? row.requested_at.toISOString() : undefined, approvedAt: row.approved_at ? row.approved_at.toISOString() : undefined, cancelledAt: row.cancelled_at ? row.cancelled_at.toISOString() : undefined, movedToHistoryAt: row.moved_to_history_at ? row.moved_to_history_at.toISOString() : undefined };
  });

  const latestScore = performance[0];
  const activities = await listPerformanceActivities({ employeeId: params.employeeId, year: params.year });
  const weights = settings?.performanceWeights || { 
    performanceWeight: 60, competencyWeight: 25, attitudeWeight: 15,
    kpiWithinPerformanceWeight: 50, taskWithinPerformanceWeight: 25, qualityWithinPerformanceWeight: 25,
    performanceLabel: 'Performance', participationLabel: 'Participation', popularityLabel: 'Popularity'
  };
  
  const provisionalMetrics: any = {
    performance: 0, participation: 0, popularity: 0, total: 0,
    labels: { performance: weights.performanceLabel || 'Performance', participation: weights.participationLabel || 'Participation', popularity: weights.popularityLabel || 'Popularity' },
    weights: { performance: weights.performanceWeight || 60, participation: weights.competencyWeight || 25, popularity: weights.attitudeWeight || 15 }
  };

  if (activities.length > 0) {
    const scoresByCategory: Record<string, number> = { 'performance': 0, 'participation': 0, 'popularity': 0 };
    activities.forEach(a => {
      const pillar = String(a.pillar || '').toLowerCase();
      const score = Number(a.score || a.score_value || 0);
      if (scoresByCategory.hasOwnProperty(pillar)) scoresByCategory[pillar] += score;
    });
    provisionalMetrics.performance = Math.min(100, scoresByCategory['performance']);
    provisionalMetrics.participation = Math.min(100, scoresByCategory['participation']);
    provisionalMetrics.popularity = Math.min(100, scoresByCategory['popularity']);
    provisionalMetrics.total = round2((provisionalMetrics.performance * (provisionalMetrics.weights.performance / 100)) + (provisionalMetrics.participation * (provisionalMetrics.weights.participation / 100)) + (provisionalMetrics.popularity * (provisionalMetrics.weights.popularity / 100)));
  }

  // Use the balance table as the source of truth for approved leave units to maintain integrity with quota cards.
  // WFH units are managed monthly and are typically excluded from the yearly summary value unless specifically included.
  // Include all approved leave units (including WFH) in the summary to ensure the KPI card reflects actual usage.
  const approvedLeaveUnits = round2(leaveBalances
    .reduce((sum, b) => sum + Number(b.used_days || 0), 0));

  
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const wfhLimit = settings?.leavePolicy?.wfhMonthlyCapDays ?? 4;
  
  let wfhUsedThisMonth = 0;
  if (params.year === currentYear) {
    wfhUsedThisMonth = leaveHistory.filter(item => item.leaveType === 'WFH' && ['approved', 'pending'].includes(String(item.status).toLowerCase())).filter(item => {
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        return (start.getMonth() === currentMonth || end.getMonth() === currentMonth);
      }).reduce((sum, item) => sum + Number(item.units || 0), 0);
  }

  const tenure = calculateTenure(userData?.join_date || null);

  const officialScore = latestScore?.finalScore || 0;
  const useProvisional = officialScore === 0 && provisionalMetrics.total > 0;

  const summary = { 
    latestFinalScore: useProvisional ? provisionalMetrics.total : officialScore, 
    latestScoreStatus: latestScore?.status || (activities.length > 0 ? 'provisional' : 'n/a'), 
    periodLabel: latestScore?.periodLabel || (activities.length > 0 ? `${params.year} Provisional` : `${params.year} Annual`),
    approvedLeaveUnits: round2(approvedLeaveUnits), 
    totalPenalties: penalties.length,
    activePenalties: penalties.filter(p => p.status === 'active').length,
    wfhUsed: wfhUsedThisMonth,
    wfhLimit: wfhLimit,
    provisionalMetrics: {
      performance: useProvisional 
        ? provisionalMetrics.performance 
        : (latestScore?.performance60 ? Math.min(100, Math.round(latestScore.performance60 / (weights.performanceWeight / 100))) : 0),
      participation: useProvisional 
        ? provisionalMetrics.participation 
        : (latestScore?.participation25 ? Math.min(100, Math.round(latestScore.participation25 / (weights.competencyWeight / 100))) : 0),
      popularity: useProvisional 
        ? provisionalMetrics.popularity 
        : (latestScore?.popularity15 ? Math.min(100, Math.round(latestScore.popularity15 / (weights.attitudeWeight / 100))) : 0),
    }
  };

  return {
    employeeId: userData.profiles?.[0]?.employee_id || userData.id, 
    year: params.year,
    userMeta: {
      name: userData?.name || 'Unknown',
      email: userData?.email || '',
      role: userData?.role || 'employee',
      dept: userData?.dept || '',
      phone: userData?.phone || '',
      address: userData?.address || '',
      mailingAddress: userData?.mailing_address || '',
      emergencyContact: userData?.emergency_contact || '',
      preferredName: userData?.preferred_name || '',
      bankDetails: userData?.bank_details || '',
      joinDate: userData?.join_date || '',
      reportsToId: userData?.reports_to_id || null,
      reportsToName: managerName,
      profileUpdateStatus: userData?.profile_update_status || 'approved',
      lastUpdatedAt: userData?.updated_at ? userData.updated_at.toISOString() : null,
      yearsService: tenure.years,
      monthsService: tenure.months
    },
    summary,
    leaveHistory, 
    performance, 
    penalties,
    rewards: parseJson(userData?.rewards as string, []),
    achievements: parseJson(userData?.achievements as string, []),
    experienceInOffice: parseJson(userData?.experience_in_office as string, []),
    general: settings.general,
  };
}

function calculateTenure(joinDate: string | null) {
  if (!joinDate) return { years: 0, months: 0 };
  const join = new Date(joinDate);
  const now = new Date();
  
  let totalMonths = (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth());
  if (now.getDate() < join.getDate()) {
    totalMonths--;
  }
  
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  
  return { years: Math.max(0, years), months: Math.max(0, months) };
}

// ─── Seed defaults ────────────────────────────────────────────────────────────

export async function ensureDefaultPerformanceConfig(): Promise<void> {
  const data = await prisma.performance_config.findFirst({
    where: { config_key: CONFIG_KEY, is_active: true },
    select: { id: true }
  });

  if (!data) {
    await savePerformanceConfig(DEFAULT_SCORING_CONFIG, 'system');
  }

  const penalties = await prisma.penalty_types.findUnique({
    where: { type_code: 'TIER_1' },
    select: { type_code: true }
  });

  if (!penalties) {
    const now = new Date();
    await prisma.penalty_types.createMany({
      data: [
        { id: 'PT-TIER1', type_code: 'TIER_1', type_name: 'Tier 1', default_severity: 'low', active: true, created_at: now, updated_at: now },
        { id: 'PT-TIER2', type_code: 'TIER_2', type_name: 'Tier 2', default_severity: 'medium', active: true, created_at: now, updated_at: now },
        { id: 'PT-TIER3', type_code: 'TIER_3', type_name: 'Tier 3', default_severity: 'high', active: true, created_at: now, updated_at: now },
        { id: 'PT-SPECIAL', type_code: 'SPECIAL', type_name: 'Special', default_severity: 'medium', active: true, created_at: now, updated_at: now },
      ]
    });
  }
}

// ─── Performance Activities ──────────────────────────────────────────────────

export async function listPerformanceActivities(params: {
  employeeId: string;
  pillar?: 'Performance' | 'Participation' | 'Popularity' | 'All';
  year?: number;
}): Promise<PerformanceActivity[]> {
  const data = await prisma.activity_score_entries.findMany({
    where: {
      assigned_to_id: params.employeeId,
      category: (params.pillar && params.pillar !== 'All') ? params.pillar : undefined,
      year: params.year || undefined
    },
    orderBy: { date: 'desc' }
  });

  return (data ?? []).map((row) => ({
    id: row.id,
    employeeId: row.assigned_to_id,
    activityName: row.activity_name,
    category: row.category,
    scoreBucket: row.score_bucket,
    score: Number(row.score || 0),
    score_value: Number(row.score || 0),
    pillar: normalizeCategory(row.category) as 'Performance' | 'Participation' | 'Popularity',
    activityDate: row.date,
    createdAt: row.created_at.toISOString(),
    created_at: row.created_at.toISOString(),
  }));
}


