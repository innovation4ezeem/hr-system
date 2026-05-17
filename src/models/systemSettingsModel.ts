import { prisma } from '@/lib/prisma';

export type LeavePolicySettings = {
  annualLeaveDaysLTE2Years: number;
  annualLeaveDays2To5Years: number;
  annualLeaveDaysGT5Years: number;
  annualLeaveCompanyBonusDays: number;
  mcDaysLTE2Years: number;
  mcDays2To5Years: number;
  mcDaysGT5Years: number;
  wfhMonthlyCapDays: number;
  carryForwardCapDays: number;
  carryForwardExpiryMonth: number;
  carryForwardExpiryDay: number;
};

export type PerformanceWeightSettings = {
  performanceWeight: number;
  competencyWeight: number;
  attitudeWeight: number;
  kpiWithinPerformanceWeight: number;
  taskWithinPerformanceWeight: number;
  qualityWithinPerformanceWeight: number;
  performanceLabel?: string;
  participationLabel?: string;
  popularityLabel?: string;
  kpiLabel?: string;
  taskLabel?: string;
  qualityLabel?: string;
  kpiParent?: string;
  taskParent?: string;
  qualityParent?: string;
};

export type PerformanceFormulaSettings = {
  name: string;
  expression: string;
};

export type PerformanceThresholdSettings = {
  high: number;
  mid: number;
};

export type ActivityStandardMarksSettings = Record<string, number>;
export type ActivityBucketCategoriesSettings = Record<string, 'Performance' | 'Participation' | 'Popularity'>;

export type MaintenanceSettings = {
  autoBackupEnabled: boolean;
  autoBackupDay: number;
  autoBackupMonth: number;
};

export type EvaluationSection = {
  id: string;
  title: string;
  attributes: Array<{ id: string; label: string; description?: string }>;
};

export type GeneralSettings = {
  performanceFormUrl: string;
  performanceFormLabel: string;
  evaluationSections?: EvaluationSection[];
};

export type SystemSettingsRecord = {
  leavePolicy: LeavePolicySettings;
  performanceWeights: PerformanceWeightSettings;
  performanceThresholds: PerformanceThresholdSettings;
  performanceFormula: PerformanceFormulaSettings;
  activityStandardMarks: ActivityStandardMarksSettings;
  activityBucketCategories: ActivityBucketCategoriesSettings;
  maintenance: MaintenanceSettings;
  general: GeneralSettings;
};
const SETTINGS_KEYS = {
  leavePolicy: 'leavePolicy',
  performanceWeights: 'performanceWeights',
  performanceThresholds: 'performanceThresholds',
  performanceFormula: 'performanceFormula',
  activityStandardMarks: 'activityStandardMarks',
  activityBucketCategories: 'activityBucketCategories',
  maintenance: 'maintenance',
  general: 'general',
} as const;

export const SYSTEM_SETTINGS_DEFAULTS: SystemSettingsRecord = {
  leavePolicy: {
    annualLeaveDaysLTE2Years: 8,
    annualLeaveDays2To5Years: 12,
    annualLeaveDaysGT5Years: 16,
    annualLeaveCompanyBonusDays: 0,
    mcDaysLTE2Years: 14,
    mcDays2To5Years: 18,
    mcDaysGT5Years: 22,
    wfhMonthlyCapDays: 4,
    carryForwardCapDays: 5,
    carryForwardExpiryMonth: 2,
    carryForwardExpiryDay: 28,
  },
  performanceWeights: {
    performanceWeight: 60,
    competencyWeight: 25,
    attitudeWeight: 15,
    kpiWithinPerformanceWeight: 50,
    taskWithinPerformanceWeight: 25,
    qualityWithinPerformanceWeight: 25,
  },
  performanceThresholds: {
    high: 85,
    mid: 70,
  },
  performanceFormula: {
    name: 'Scoring Formula',
    expression: 'Total Score = Performance (KPI 50% + Tasks 25% + Quality 25%) × 0.6 + Participation × 0.25 + Popularity × 0.15.',
  },
  maintenance: {
    autoBackupEnabled: true,
    autoBackupDay: 1,
    autoBackupMonth: 12,
  },
  activityStandardMarks: {
    'KPI': 10,
    'Tasks Based': 10,
    'Quality': 10,
    'PLAY Attendance': 10,
    'PLAY Winner': 10,
    'LEARN Attendance': 10,
    'HCM Stickers': 3,
    'Voting Form - Attitude (Initiative, Proactive, Voluntary)': 5,
    'Voting Form - Continuous learner (sharpen the saw)': 5,
    'Voting Form - Accountability (being responsible towards own responsibility)': 5,
    'Voting Form - Innovative & Creativity': 5,
    'Voting Form - Effective Collaborator': 5,
    'Intern & Probators sticker': 5,
    'Executive sticker': 10,
    'HOD sticker': 15,
    'Director sticker': 40,
  },
  activityBucketCategories: {
    'KPI': 'Performance',
    'Tasks Based': 'Performance',
    'Quality': 'Performance',
    'PLAY Attendance': 'Participation',
    'PLAY Winner': 'Participation',
    'LEARN Attendance': 'Participation',
    'HCM Stickers': 'Participation',
    'Voting Form - Attitude (Initiative, Proactive, Voluntary)': 'Popularity',
    'Voting Form - Continuous learner (sharpen the saw)': 'Popularity',
    'Voting Form - Accountability (being responsible towards own responsibility)': 'Popularity',
    'Voting Form - Innovative & Creativity': 'Popularity',
    'Voting Form - Effective Collaborator': 'Popularity',
    'Intern & Probators sticker': 'Popularity',
    'Executive sticker': 'Popularity',
    'HOD sticker': 'Popularity',
    'Director sticker': 'Popularity',
  },
  general: {
    performanceFormUrl: `https://forms.gle/ezeem-performance-${new Date().getFullYear()}`,
    performanceFormLabel: `${new Date().getFullYear()} Annual Performance Form`,
    evaluationSections: [
      {
        id: 'sec-1',
        title: 'Core Performance Attributes',
        attributes: [
          { id: 'attr-1', label: 'Quality of Work', description: 'Accuracy, thoroughness and reliability of work produced.' },
          { id: 'attr-2', label: 'Efficiency & Speed', description: 'Ability to complete tasks within reasonable timeframes.' }
        ]
      },
      {
        id: 'sec-2',
        title: 'Culture & Values',
        attributes: [
          { id: 'attr-3', label: 'Collaboration', description: 'Working effectively with team members and other departments.' },
          { id: 'attr-4', label: 'Proactiveness', description: 'Taking initiative to improve processes or solve problems.' }
        ]
      }
    ]
  },
};

const defaultSettings = SYSTEM_SETTINGS_DEFAULTS;

async function upsertSetting(settingKey: string, settingValue: unknown) {
  await prisma.system_settings.upsert({
    where: { setting_key: settingKey },
    update: {
      setting_json: JSON.stringify(settingValue),
      updated_at: new Date()
    },
    create: {
      setting_key: settingKey,
      setting_json: JSON.stringify(settingValue),
      updated_at: new Date()
    }
  });
}

export async function getSystemSettings(): Promise<SystemSettingsRecord> {
  const data = await prisma.system_settings.findMany({
    select: { setting_key: true, setting_json: true }
  });

  if (!data || data.length === 0) {
    await Promise.all([
      upsertSetting(SETTINGS_KEYS.leavePolicy, defaultSettings.leavePolicy),
      upsertSetting(SETTINGS_KEYS.performanceWeights, defaultSettings.performanceWeights),
      upsertSetting(SETTINGS_KEYS.performanceThresholds, defaultSettings.performanceThresholds),
      upsertSetting(SETTINGS_KEYS.performanceFormula, defaultSettings.performanceFormula),
      upsertSetting(SETTINGS_KEYS.activityStandardMarks, defaultSettings.activityStandardMarks),
      upsertSetting(SETTINGS_KEYS.activityBucketCategories, defaultSettings.activityBucketCategories),
      upsertSetting(SETTINGS_KEYS.maintenance, defaultSettings.maintenance),
      upsertSetting(SETTINGS_KEYS.general, defaultSettings.general),
    ]);
    return defaultSettings;
  }

  const map = new Map<string, any>();
  data.forEach((row) => map.set(row.setting_key, row.setting_json));

  const parse = (key: string, def: any) => {
    const val = map.get(key);
    if (val === undefined || val === null) return def;
    try {
      return typeof val === 'string' ? JSON.parse(val) : val;
    } catch {
      return def;
    }
  };

  return {
    leavePolicy: { ...defaultSettings.leavePolicy, ...parse(SETTINGS_KEYS.leavePolicy, {}) },
    performanceWeights: { ...defaultSettings.performanceWeights, ...parse(SETTINGS_KEYS.performanceWeights, {}) },
    performanceThresholds: { ...defaultSettings.performanceThresholds, ...parse(SETTINGS_KEYS.performanceThresholds, {}) },
    performanceFormula: { ...defaultSettings.performanceFormula, ...parse(SETTINGS_KEYS.performanceFormula, {}) },
    activityStandardMarks: { ...defaultSettings.activityStandardMarks, ...parse(SETTINGS_KEYS.activityStandardMarks, {}) },
    activityBucketCategories: { ...defaultSettings.activityBucketCategories, ...parse(SETTINGS_KEYS.activityBucketCategories, {}) },
    maintenance: { ...defaultSettings.maintenance, ...parse(SETTINGS_KEYS.maintenance, {}) },
    general: { ...defaultSettings.general, ...parse(SETTINGS_KEYS.general, {}) },
  };
}

export async function saveSystemSettings(settings: SystemSettingsRecord) {
  await upsertSetting(SETTINGS_KEYS.leavePolicy, settings.leavePolicy);
  await upsertSetting(SETTINGS_KEYS.performanceWeights, settings.performanceWeights);
  await upsertSetting(SETTINGS_KEYS.performanceThresholds, settings.performanceThresholds);
  await upsertSetting(SETTINGS_KEYS.performanceFormula, settings.performanceFormula);
  await upsertSetting(SETTINGS_KEYS.activityStandardMarks, settings.activityStandardMarks);
  await upsertSetting(SETTINGS_KEYS.activityBucketCategories, settings.activityBucketCategories);
  await upsertSetting(SETTINGS_KEYS.maintenance, settings.maintenance);
  await upsertSetting(SETTINGS_KEYS.general, settings.general);
}
