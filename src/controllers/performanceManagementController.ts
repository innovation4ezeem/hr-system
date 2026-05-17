import {
  approvePerformanceScore,
  autoCalculatePeriod,
  calculateAndSavePerformanceScore,
  createPenalty,
  deletePenalty,
  getActivePerformanceConfig,
  getPerformanceReport,
  getUnifiedEmployeeProfile,
  listPenalties,
  listPenaltyTypes,
  listPerformanceScores,
  listPerformanceActivities,
  overridePerformanceScore,
  savePerformanceConfig,
  syncEmployeeServiceYears,
  upsertEmployeeServiceYear,
  upsertPenaltyType,
  upsertPerformanceInput,
  updatePenalty,
  type EmployeeServiceYearRecord,
  type PenaltyRecord,
  type PenaltyTypeRecord,
  type PerformanceActivity,
  type PeriodType,
  type ScoringConfig,
} from '@/models/performanceManagementModel';

import { getSystemSettings, saveSystemSettings } from '@/models/systemSettingsModel';
import { insertSystemAuditLog } from '@/models/systemAuditLogModel';
// HRNotificationService moved to dynamic imports inside mutation controllers to break circular dependencies


function scoreToGrade(score: number) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

export async function getPerformanceConfigController() {
  return getActivePerformanceConfig();
}

export async function savePerformanceConfigController(config: Partial<ScoringConfig>, actor: string) {
  const saved = await savePerformanceConfig(config, actor);
  await insertSystemAuditLog('performance-config', 'update', actor, {
    configId: saved.id,
    versionNo: saved.versionNo,
  });
  return saved;
}

export async function upsertPerformanceInputController(payload: {
  employeeId: string;
  employeeName: string;
  department: string;
  periodType: PeriodType;
  periodYear: number;
  periodNo?: number;
  kpiAchieved: number;
  kpiTotal: number;
  tasksAchieved: number;
  tasksTotal: number;
  qualityTotalTasks: number;
  qualityErrors: number;
  participation: Record<string, number>;
  popularity: Record<string, number>;
  actor?: string;
}) {
  const input = await upsertPerformanceInput({
    employeeId: payload.employeeId,
    employeeName: payload.employeeName,
    department: payload.department,
    periodType: payload.periodType,
    periodYear: payload.periodYear,
    periodNo: payload.periodNo,
    kpiAchieved: payload.kpiAchieved,
    kpiTotal: payload.kpiTotal,
    tasksAchieved: payload.tasksAchieved,
    tasksTotal: payload.tasksTotal,
    qualityTotalTasks: payload.qualityTotalTasks,
    qualityErrors: payload.qualityErrors,
    participation: payload.participation,
    popularity: payload.popularity,
    updatedBy: payload.actor,
  });

  await insertSystemAuditLog('performance-score', 'upsert-input', payload.actor || 'system', {
    employeeId: payload.employeeId,
    periodType: payload.periodType,
    periodYear: payload.periodYear,
    periodNo: payload.periodNo,
  });

  return input;
}

export async function calculatePerformanceScoreController(payload: {
  employeeId: string;
  periodType: PeriodType;
  periodYear: number;
  periodNo?: number;
  actor?: string;
}) {
  const score = await calculateAndSavePerformanceScore(payload);
  await insertSystemAuditLog('performance-score', 'calculate', payload.actor || 'system', {
    employeeId: payload.employeeId,
    periodType: payload.periodType,
    periodYear: payload.periodYear,
    periodNo: payload.periodNo,
    finalScore: score.finalScore,
  });
  return score;
}

export async function autoCalculatePerformancePeriodController(payload: {
  periodType: PeriodType;
  periodYear: number;
  periodNo?: number;
  department?: string;
  actor?: string;
}) {
  const results = await autoCalculatePeriod(payload);
  await insertSystemAuditLog('performance-score', 'auto-calculate-period', payload.actor || 'system', {
    periodType: payload.periodType,
    periodYear: payload.periodYear,
    periodNo: payload.periodNo,
    department: payload.department,
    total: results.length,
    success: results.filter(item => item.success).length,
  });
  return results;
}

export async function approvePerformanceScoreController(payload: {
  employeeId: string;
  periodType: PeriodType;
  periodYear: number;
  periodNo?: number;
  actor: string;
}) {
  const updated = await approvePerformanceScore({
    employeeId: payload.employeeId,
    periodType: payload.periodType,
    periodYear: payload.periodYear,
    periodNo: payload.periodNo,
    approver: payload.actor,
  });

  if (!updated) {
    throw new Error('Performance score not found for approval target');
  }

  const allUsers = await (await import('@/models/userModel')).listUsers();
  const employee = allUsers.find(u => u.id === payload.employeeId);
  const actor = allUsers.find(u => u.id === payload.actor);

  await insertSystemAuditLog('performance-score', 'approve', payload.actor, {
    employeeId: payload.employeeId,
    periodType: payload.periodType,
    periodYear: payload.periodYear,
    periodNo: payload.periodNo,
  });

  // Notify employee
  const { HRNotificationService } = await import('@/lib/notifications/hrNotificationService');
  await HRNotificationService.notifyPerformanceUpdate({

    employeeId: payload.employeeId,
    employeeName: updated.employeeName || 'Staff',
    employeeEmail: employee?.email || `${payload.employeeId}@ezeetechnosys.com.my`,
    periodLabel: `${payload.periodType} ${payload.periodYear}${payload.periodNo ? ` P${payload.periodNo}` : ''}`,
    finalScore: updated.finalScore,
    maxScore: 100, // Default max score
    grade: scoreToGrade(updated.finalScore),
    remarks: updated.overrideComment || undefined,
    actorId: payload.actor,
    actorName: actor?.name || payload.actor,
    breakdown: [
      { label: 'Performance', score: updated.performance60 },
      { label: 'Participation', score: updated.participation25 },
      { label: 'Popularity', score: updated.popularity15 },
    ]
  });

  return updated;
}

export async function overridePerformanceScoreController(payload: {
  employeeId: string;
  periodType: PeriodType;
  periodYear: number;
  periodNo?: number;
  overrideScore: number;
  comment: string;
  actor: string;
}) {
  const updated = await overridePerformanceScore(payload);

  if (!updated) {
    throw new Error('Performance score not found for override target');
  }

  const allUsers = await (await import('@/models/userModel')).listUsers();
  const employee = allUsers.find(u => u.id === payload.employeeId);
  const actor = allUsers.find(u => u.id === payload.actor);

  await insertSystemAuditLog('manual-override', 'performance-score', payload.actor, {
    employeeId: payload.employeeId,
    periodType: payload.periodType,
    periodYear: payload.periodYear,
    periodNo: payload.periodNo,
    overrideScore: payload.overrideScore,
    comment: payload.comment,
  });

  // Notify employee
  const { HRNotificationService } = await import('@/lib/notifications/hrNotificationService');
  await HRNotificationService.notifyPerformanceUpdate({

    employeeId: payload.employeeId,
    employeeName: updated.employeeName || 'Staff',
    employeeEmail: employee?.email || `${payload.employeeId}@ezeetechnosys.com.my`,
    periodLabel: `${payload.periodType} ${payload.periodYear}${payload.periodNo ? ` P${payload.periodNo}` : ''}`,
    finalScore: updated.finalScore,
    maxScore: 100,
    grade: scoreToGrade(updated.finalScore),
    remarks: payload.comment,
    actorId: payload.actor,
    actorName: actor?.name || payload.actor,
    breakdown: [
      { label: 'Override Reason', score: payload.comment }
    ]
  });

  return updated;
}

export async function getPerformanceScoresController(filters: {
  employeeId?: string;
  periodType?: PeriodType;
  periodYear?: number;
  periodNo?: number;
  department?: string;
  status?: 'calculated' | 'approved' | 'overridden' | 'all';
}) {
  return listPerformanceScores(filters);
}

export async function getPenaltyTypesController(activeOnly = true) {
  return listPenaltyTypes(activeOnly);
}

export async function upsertPenaltyTypeController(payload: PenaltyTypeRecord, actor: string) {
  await upsertPenaltyType(payload);
  await insertSystemAuditLog('penalty-record', 'upsert-type', actor, {
    typeCode: payload.typeCode,
    active: payload.active,
  });
  return payload;
}

export async function getPenaltiesController(filters: {
  employeeId?: string;
  year?: number;
  department?: string;
  penaltyTypeCode?: string;
}) {
  return listPenalties(filters);
}

export async function createPenaltyController(payload: Omit<PenaltyRecord, 'id'>, actor: string) {
  const created = await createPenalty({
    ...payload,
    createdBy: actor,
  });

  const allUsers = await (await import('@/models/userModel')).listUsers();
  const employee = allUsers.find(u => u.id === created.employeeId);
  const actorRecord = allUsers.find(u => u.id === actor);

  const { HRNotificationService } = await import('@/lib/notifications/hrNotificationService');
  await HRNotificationService.notifyPenaltyAction({

    penaltyId: created.id,
    employeeId: created.employeeId,
    employeeName: created.employeeName,
    employeeEmail: employee?.email || `${created.employeeId}@ezeetechnosys.com.my`,
    penaltyType: created.penaltyTypeCode,
    incidentDate: created.penaltyDate,
    amount: 'Record logged',
    action: 'created',
    actorId: actor,
    actorName: actorRecord?.name || actor,
    description: created.reason,
  });

  return created;
}

export async function updatePenaltyController(id: string, patch: Partial<PenaltyRecord>, actor: string) {
  const updated = await updatePenalty(id, patch);
  if (updated) {
    const allUsers = await (await import('@/models/userModel')).listUsers();
    const employee = allUsers.find(u => u.id === updated.employeeId);
    const actorRecord = allUsers.find(u => u.id === actor);

    const { HRNotificationService } = await import('@/lib/notifications/hrNotificationService');
    await HRNotificationService.notifyPenaltyAction({

      penaltyId: id,
      employeeId: updated.employeeId,
      employeeName: updated.employeeName,
      employeeEmail: employee?.email || `${updated.employeeId}@ezeetechnosys.com.my`,
      penaltyType: updated.penaltyTypeCode,
      incidentDate: updated.penaltyDate,
      amount: 'Record updated',
      action: 'updated',
      actorId: actor,
      actorName: actorRecord?.name || actor,
      description: updated.reason,
    });
  }
  return updated;
}


export async function deletePenaltyController(id: string, actor: string) {
  await deletePenalty(id);
  await insertSystemAuditLog('penalty-record', 'delete', actor, {
    penaltyId: id,
  });
}

export async function syncEmployeeServiceYearsController(employeeId?: string, actor = 'system') {
  const rows = await syncEmployeeServiceYears(employeeId);
  await insertSystemAuditLog('performance-score', 'sync-service-years', actor, {
    employeeId: employeeId || null,
    total: rows.length,
  });
  return rows;
}

export async function upsertEmployeeServiceYearController(record: EmployeeServiceYearRecord, actor: string) {
  await upsertEmployeeServiceYear(record);
  await insertSystemAuditLog('performance-score', 'upsert-service-year', actor, {
    employeeId: record.employeeId,
    employmentType: record.employmentType,
    serviceYears: record.serviceYears,
  });
  return record;
}

export async function getUnifiedEmployeeProfileController(payload: {
  employeeId: string;
  year: number;
  periodType?: PeriodType;
  actor?: string;
}) {
  const profile = await getUnifiedEmployeeProfile(payload);
  // Non-blocking audit log
  void insertSystemAuditLog('employee-profile', 'view', payload.actor || 'system', {
    employeeId: payload.employeeId,
    year: payload.year,
    periodType: payload.periodType || 'all',
  });
  return profile;
}

export async function getPerformanceReportController(payload: {
  reportMode: 'employee-performance' | 'dept-leave-performance-correlation' | 'penalty-summary' | 'year-end-summary';
  year: number;
  periodType?: PeriodType;
  periodNo?: number;
  department?: string;
  employeeId?: string;
  actor?: string;
}) {
  const report = await getPerformanceReport(payload);
  await insertSystemAuditLog('performance-score', 'report', payload.actor || 'system', {
    reportMode: payload.reportMode,
    year: payload.year,
    periodType: payload.periodType,
    periodNo: payload.periodNo,
    department: payload.department,
    employeeId: payload.employeeId,
  });
  return report;
}
export async function getPerformanceActivitiesController(params: {
  employeeId: string;
  pillar?: 'Performance' | 'Participation' | 'Popularity' | 'All';
  year?: number;
}) {
  return listPerformanceActivities(params);
}

export async function getPerformanceThresholdsController() {
  const settings = await getSystemSettings();
  return settings.performanceThresholds;
}

export async function savePerformanceThresholdsController(thresholds: { high: number; mid: number }, actor: string) {
  const settings = await getSystemSettings();
  settings.performanceThresholds = thresholds;
  await saveSystemSettings(settings);
  await insertSystemAuditLog('system-settings', 'update-thresholds', actor, { thresholds });
  return thresholds;
}

export async function getPerformanceStandardMarksController() {
  const settings = await getSystemSettings();
  return {
    standardMarks: settings.activityStandardMarks,
    bucketCategories: settings.activityBucketCategories,
  };
}

export async function savePerformanceStandardMarksController(
  payload: { marks: Record<string, number> | null; bucketCategories: Record<string, any> | null }, 
  actor: string
) {
  const { SYSTEM_SETTINGS_DEFAULTS } = await import('@/models/systemSettingsModel');
  const settings = await getSystemSettings();
  
  if (payload.marks === null) {
    settings.activityStandardMarks = SYSTEM_SETTINGS_DEFAULTS.activityStandardMarks;
  } else {
    settings.activityStandardMarks = payload.marks;
  }

  if (payload.bucketCategories === null) {
    settings.activityBucketCategories = SYSTEM_SETTINGS_DEFAULTS.activityBucketCategories;
  } else {
    settings.activityBucketCategories = payload.bucketCategories as any;
  }

  await saveSystemSettings(settings);
  await insertSystemAuditLog('system-settings', 'update-standard-marks', actor, { 
    marks: settings.activityStandardMarks, 
    bucketCategories: settings.activityBucketCategories 
  });
  return { marks: settings.activityStandardMarks, bucketCategories: settings.activityBucketCategories };
}
