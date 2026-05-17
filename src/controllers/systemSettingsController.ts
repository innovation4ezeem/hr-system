import {
  getSystemSettings,
  saveSystemSettings,
  type SystemSettingsRecord,
} from '@/models/systemSettingsModel';
import { insertSystemAuditLog } from '@/models/systemAuditLogModel';

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function getSystemSettingsController() {
  return getSystemSettings();
}

export async function saveSystemSettingsController(payload: Partial<SystemSettingsRecord>, actor = 'admin') {
  const current = await getSystemSettings();
  const next: SystemSettingsRecord = {
    leavePolicy: {
      ...current.leavePolicy,
      ...(payload.leavePolicy || {}),
    },
    performanceWeights: {
      ...current.performanceWeights,
      ...(payload.performanceWeights || {}),
    },
    performanceThresholds: {
      ...current.performanceThresholds,
      ...(payload.performanceThresholds || {}),
    },
    performanceFormula: {
      ...current.performanceFormula,
      ...(payload.performanceFormula || {}),
    },
    activityStandardMarks: {
      ...current.activityStandardMarks,
      ...(payload.activityStandardMarks || {}),
    },
    activityBucketCategories: {
      ...current.activityBucketCategories,
      ...(payload.activityBucketCategories || {}),
    },
    maintenance: {
      ...current.maintenance,
      ...(payload.maintenance || {}),
    },
    general: {
      ...current.general,
      ...(payload.general || {}),
    },
  };

  if (!next.performanceFormula.expression?.trim()) {
    next.performanceFormula.expression = current.performanceFormula.expression;
  }

  next.performanceWeights.performanceWeight = clampPercent(next.performanceWeights.performanceWeight);
  next.performanceWeights.competencyWeight = clampPercent(next.performanceWeights.competencyWeight);
  next.performanceWeights.attitudeWeight = clampPercent(next.performanceWeights.attitudeWeight);

  next.performanceWeights.kpiWithinPerformanceWeight = clampPercent(next.performanceWeights.kpiWithinPerformanceWeight);
  next.performanceWeights.taskWithinPerformanceWeight = clampPercent(next.performanceWeights.taskWithinPerformanceWeight);
  next.performanceWeights.qualityWithinPerformanceWeight = clampPercent(next.performanceWeights.qualityWithinPerformanceWeight);

  await saveSystemSettings(next);
  await insertSystemAuditLog('system-settings', 'save', actor, {
    leavePolicy: next.leavePolicy,
    performanceWeights: next.performanceWeights,
    performanceThresholds: next.performanceThresholds,
    performanceFormula: next.performanceFormula,
  });
  return next;
}
