import { getLeaveControlState, upsertLeaveControlState } from '@/models/leaveControlModel';
import { getSystemSettings } from '@/models/systemSettingsModel';
import { insertSystemAuditLog } from '@/models/systemAuditLogModel';

const LEAVE_STATE_ID = 'default';

const fallbackState = {
  roleQuotas: [
    {
      role: 'Intern',
      annualLeaveRule: 'Pro-rated 0.5 day / month',
      annualLeaveCap: 6,
      medicalLeave: 5,
      carryForwardCap: 0,
      notes: 'No carry-forward allowed',
    },
    {
      role: 'Employee (<2yr)',
      annualLeaveRule: 'AutoCount Sync: 8 days',
      annualLeaveCap: 8,
      medicalLeave: 14,
      carryForwardCap: 5,
      notes: 'AL carry-forward max 5 days',
    },
    {
      role: 'Employee (>5yr)',
      annualLeaveRule: 'AutoCount Sync: 12 days',
      annualLeaveCap: 12,
      medicalLeave: 22,
      carryForwardCap: 5,
      notes: 'AL carry-forward max 5 days',
    },
  ],
 
  rewardCarryCap: 5,
  wfhMonthlyCap: 4,
  satLog: [],
};

export async function getLeaveControlStateController() {
  const [record, settings] = await Promise.all([
    getLeaveControlState(LEAVE_STATE_ID),
    getSystemSettings(),
  ]);

  const baseState = record
    ? { ...fallbackState, ...(record.payload || {}) }
    : fallbackState;

  const withProjected = applyProjectedEntitlementToRequests(baseState, settings.leavePolicy);
  const cleanseResult = applyFebCleanseIfNeeded(withProjected, settings.leavePolicy);
  const cleansed = cleanseResult.state;

  if (!record) {
    await upsertLeaveControlState({ id: LEAVE_STATE_ID, payload: cleansed });
    if (cleanseResult.didRun) {
      await insertSystemAuditLog('feb-cleanse', 'auto-run', 'system', {
        reason: cleanseResult.reason,
        at: cleansed.febCleanseLastRunAt,
      });
    }
    return cleansed;
  }

  if (JSON.stringify(cleansed) !== JSON.stringify(baseState)) {
    await upsertLeaveControlState({ id: LEAVE_STATE_ID, payload: cleansed });
    if (cleanseResult.didRun) {
      await insertSystemAuditLog('feb-cleanse', 'auto-run', 'system', {
        reason: cleanseResult.reason,
        at: cleansed.febCleanseLastRunAt,
      });
    }
  }

  return cleansed;
}

export async function saveLeaveControlStateController(payload: Record<string, unknown>) {
  const settings = await getSystemSettings();
  const normalized = applyProjectedEntitlementToRequests(payload || {}, settings.leavePolicy);
  const cleansed = applyFebCleanseIfNeeded(normalized, settings.leavePolicy).state;
  await upsertLeaveControlState({ id: LEAVE_STATE_ID, payload: cleansed });
}

export async function runFebCleanseController(options?: { force?: boolean; asOfDate?: string; triggeredBy?: string }) {
  const [settings, record] = await Promise.all([
    getSystemSettings(),
    getLeaveControlState(LEAVE_STATE_ID),
  ]);

  const currentState = {
    ...fallbackState,
    ...((record?.payload || {}) as Record<string, any>),
  };

  const withProjected = applyProjectedEntitlementToRequests(currentState, settings.leavePolicy);
  const result = applyFebCleanseIfNeeded(withProjected, settings.leavePolicy, {
    force: Boolean(options?.force),
    asOfDate: options?.asOfDate,
  });

  if (!result.didRun) {
    return {
      didRun: false,
      reason: result.reason,
      state: result.state,
    };
  }

  await upsertLeaveControlState({ id: LEAVE_STATE_ID, payload: result.state });
  await insertSystemAuditLog('feb-cleanse', options?.force ? 'manual-rerun' : 'scheduled-run', options?.triggeredBy || 'system', {
    reason: result.reason,
    at: result.state.febCleanseLastRunAt,
  });

  return {
    didRun: true,
    reason: result.reason,
    state: result.state,
  };
}

function applyFebCleanseIfNeeded(
  state: Record<string, any>,
  leavePolicy: Record<string, any>,
  options?: { force?: boolean; asOfDate?: string },
) {
  const now = options?.asOfDate ? new Date(options.asOfDate) : new Date();
  const year = now.getFullYear();

  const expiryMonth = Number(leavePolicy?.carryForwardExpiryMonth || 2);
  const expiryDay = Number(leavePolicy?.carryForwardExpiryDay || 28);
  const runDate = new Date(year, expiryMonth, expiryDay + 1, 0, 0, 0, 0);
  const alreadyRunYear = Number(state?.febCleanseLastRunYear || 0);

  if (!options?.force && (now < runDate || alreadyRunYear >= year)) {
    return { state, didRun: false, reason: 'not-due-or-already-run' };
  }

  const next = { ...state };
  const profiles = Array.isArray(next.profiles) ? [...next.profiles] : [];
  const cap = Number(leavePolicy?.carryForwardCapDays || 5);

  next.profiles = profiles.map((profile: any) => {
    const balances = { ...(profile?.balances || {}) };

    const alCarry = Number(balances.alCarryForward || 0);
    const rewardCarry = Number(balances.rewardCarryForward || 0);

    const clippedAl = Math.min(Math.max(0, alCarry), cap);
    const clippedReward = Math.min(Math.max(0, rewardCarry), cap);

    balances.alCarryForward = 0;
    balances.rewardCarryForward = 0;
    balances.carryForwardExpired = clippedAl + clippedReward;

    return {
      ...profile,
      balances,
    };
  });

  next.febCleanseLastRunYear = year;
  next.febCleanseLastRunAt = now.toISOString();
  return {
    state: next,
    didRun: true,
    reason: options?.force ? 'manual-force' : 'due-after-expiry',
  };
}

function toDate(value: string) {
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d;
  const parts = value.split('/');
  if (parts.length === 3) {
    const parsed = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function computeServiceYears(joinDate: string, atDate: string) {
  const start = toDate(joinDate);
  const end = toDate(atDate);
  const diffDays = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays / 365.25;
}

function projectedEntitlement(profile: any, leaveDate: string, leavePolicy: Record<string, any>) {
  const serviceYears = computeServiceYears(String(profile?.joinDate || ''), leaveDate);
  const role = String(profile?.role || 'Employee').toLowerCase();

  if (role === 'intern') {
    return {
      tier: 'Intern',
      annualLeave: 0,
      medicalLeave: 5,
      wfhMonthlyCap: Number(leavePolicy?.wfhMonthlyCapDays || 4),
    };
  }

  if (serviceYears <= 2) {
    return {
      tier: '<=2 Years',
      annualLeave: Number(leavePolicy?.annualLeaveDaysLTE2Years || 12),
      medicalLeave: Number(leavePolicy?.mcDaysLTE2Years || 14),
      wfhMonthlyCap: Number(leavePolicy?.wfhMonthlyCapDays || 4),
    };
  }

  if (serviceYears <= 5) {
    return {
      tier: '2-5 Years',
      annualLeave: Number(leavePolicy?.annualLeaveDays2To5Years || 16),
      medicalLeave: Number(leavePolicy?.mcDays2To5Years || 18),
      wfhMonthlyCap: Number(leavePolicy?.wfhMonthlyCapDays || 4),
    };
  }

  return {
    tier: '>5 Years',
    annualLeave: Number(leavePolicy?.annualLeaveDaysGT5Years || 20),
    medicalLeave: Number(leavePolicy?.mcDaysGT5Years || 22),
    wfhMonthlyCap: Number(leavePolicy?.wfhMonthlyCapDays || 4),
  };
}

function applyProjectedEntitlementToRequests(state: Record<string, any>, leavePolicy: Record<string, any>) {
  const next = { ...state };
  const profiles = Array.isArray(next.profiles) ? next.profiles : [];
  const requests = Array.isArray(next.requests) ? next.requests : [];

  const byName = new Map<string, any>();
  profiles.forEach((profile: any) => {
    const name = String(profile?.name || '').trim().toLowerCase();
    if (name) byName.set(name, profile);
  });

  next.requests = requests.map((request: any) => {
    const profile = byName.get(String(request?.employee || '').trim().toLowerCase());
    if (!profile) return request;
    const entitlement = projectedEntitlement(profile, String(request?.date || new Date().toISOString().slice(0, 10)), leavePolicy);
    return {
      ...request,
      projectedTier: entitlement.tier,
      projectedAnnualLeave: entitlement.annualLeave,
      projectedMedicalLeave: entitlement.medicalLeave,
      projectedWfhMonthlyCap: entitlement.wfhMonthlyCap,
    };
  });

  return next;
}
