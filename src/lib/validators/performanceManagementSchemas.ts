import { z } from 'zod';

export const periodTypeSchema = z.enum(['monthly', 'quarterly', 'yearly']);

export const scoreStatusSchema = z.enum(['calculated', 'approved', 'overridden', 'all']);

export const scoreReportModeSchema = z.enum([
  'employee-performance',
  'dept-leave-performance-correlation',
  'penalty-summary',
  'year-end-summary',
]);

function validatePeriodNoByType(
  periodType: z.infer<typeof periodTypeSchema>,
  periodNo: number | undefined,
  ctx: z.RefinementCtx,
) {
  if (periodNo === undefined) {
    return;
  }

  if (!Number.isInteger(periodNo)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['periodNo'],
      message: 'periodNo must be an integer',
    });
    return;
  }

  if (periodType === 'monthly' && (periodNo < 1 || periodNo > 12)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['periodNo'],
      message: 'periodNo for monthly must be between 1 and 12',
    });
    return;
  }

  if (periodType === 'quarterly' && (periodNo < 1 || periodNo > 4)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['periodNo'],
      message: 'periodNo for quarterly must be between 1 and 4',
    });
    return;
  }

  if (periodType === 'yearly' && periodNo !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['periodNo'],
      message: 'periodNo for yearly must be 1 when provided',
    });
  }
}

export const performanceScoresQuerySchema = z.object({
  mode: z.literal('scores'),
  employeeId: z.string().optional(),
  periodType: periodTypeSchema.optional(),
  periodYear: z.coerce.number().int().optional(),
  periodNo: z.coerce.number().int().optional(),
  department: z.string().optional(),
  status: scoreStatusSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.periodType) {
    validatePeriodNoByType(data.periodType, data.periodNo, ctx);
  }
});

export const performanceConfigQuerySchema = z.object({
  mode: z.literal('config'),
});

export const performancePenaltyTypesQuerySchema = z.object({
  mode: z.literal('penalty-types'),
  activeOnly: z.coerce.number().optional(),
});

export const performancePenaltiesQuerySchema = z.object({
  mode: z.literal('penalties'),
  employeeId: z.string().optional(),
  year: z.coerce.number().optional(),
  department: z.string().optional(),
  penaltyTypeCode: z.string().optional(),
});

export const performanceReportQuerySchema = z.object({
  mode: z.literal('report'),
  reportMode: scoreReportModeSchema,
  year: z.coerce.number().int().optional(),
  periodType: periodTypeSchema.optional(),
  periodNo: z.coerce.number().int().optional(),
  department: z.string().optional(),
  employeeId: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.periodType) {
    validatePeriodNoByType(data.periodType, data.periodNo, ctx);
  }
});

export const performanceProfileQuerySchema = z.object({
  mode: z.literal('profile'),
  employeeId: z.string().min(1),
  year: z.coerce.number().int().optional(),
  periodType: periodTypeSchema.optional(),
});

export const serviceYearsQuerySchema = z.object({
  mode: z.literal('service-years'),
  employeeId: z.string().optional(),
});

export const performanceStandardMarksQuerySchema = z.object({
  mode: z.literal('standard-marks'),
});

export const participationSchema = z.record(z.string(), z.coerce.number().min(0)).default({});
export const popularitySchema = z.record(z.string(), z.coerce.number().min(0)).default({});

export const upsertInputActionSchema = z.object({
  action: z.literal('upsert-input'),
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  department: z.string().min(1),
  periodType: periodTypeSchema,
  periodYear: z.coerce.number().int(),
  periodNo: z.coerce.number().int().optional(),
  kpiAchieved: z.coerce.number().min(0),
  kpiTotal: z.coerce.number().min(0),
  tasksAchieved: z.coerce.number().min(0),
  tasksTotal: z.coerce.number().min(0),
  qualityTotalTasks: z.coerce.number().min(0),
  qualityErrors: z.coerce.number().min(0),
  participation: participationSchema,
  popularity: popularitySchema,
  actor: z.string().optional(),
}).superRefine((data, ctx) => {
  validatePeriodNoByType(data.periodType, data.periodNo, ctx);

  if (data.qualityErrors > data.qualityTotalTasks) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['qualityErrors'],
      message: 'qualityErrors cannot exceed qualityTotalTasks',
    });
  }
});

export const calculateScoreActionSchema = z.object({
  action: z.literal('calculate-score'),
  employeeId: z.string().min(1),
  periodType: periodTypeSchema,
  periodYear: z.coerce.number().int(),
  periodNo: z.coerce.number().int().optional(),
  actor: z.string().optional(),
}).superRefine((data, ctx) => {
  validatePeriodNoByType(data.periodType, data.periodNo, ctx);
});

export const autoCalculateActionSchema = z.object({
  action: z.literal('auto-calculate-period'),
  periodType: periodTypeSchema,
  periodYear: z.coerce.number().int(),
  periodNo: z.coerce.number().int().optional(),
  department: z.string().optional(),
  actor: z.string().optional(),
}).superRefine((data, ctx) => {
  validatePeriodNoByType(data.periodType, data.periodNo, ctx);
});

export const approveScoreActionSchema = z.object({
  action: z.literal('approve-score'),
  employeeId: z.string().min(1),
  periodType: periodTypeSchema,
  periodYear: z.coerce.number().int(),
  periodNo: z.coerce.number().int().optional(),
  actor: z.string().min(1),
}).superRefine((data, ctx) => {
  validatePeriodNoByType(data.periodType, data.periodNo, ctx);
});

export const overrideScoreActionSchema = z.object({
  action: z.literal('override-score'),
  employeeId: z.string().min(1),
  periodType: periodTypeSchema,
  periodYear: z.coerce.number().int(),
  periodNo: z.coerce.number().int().optional(),
  overrideScore: z.coerce.number().min(0).max(100),
  comment: z.string().min(3),
  actor: z.string().min(1),
}).superRefine((data, ctx) => {
  validatePeriodNoByType(data.periodType, data.periodNo, ctx);
});

export const upsertConfigActionSchema = z.object({
  action: z.literal('upsert-config'),
  config: z.record(z.string(), z.any()),
  actor: z.string().min(1),
});

export const createPenaltyActionSchema = z.object({
  action: z.literal('create-penalty'),
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  department: z.string().min(1),
  penaltyTypeCode: z.string().min(1),
  penaltyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(3),
  attachment: z.string().optional(),
  linkedLeaveRequestId: z.string().optional(),
  actor: z.string().min(1),
});

const penaltyPatchSchema = z.object({
  employeeId: z.string().min(1).optional(),
  employeeName: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  penaltyTypeCode: z.string().min(1).optional(),
  penaltyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reason: z.string().min(3).optional(),
  attachment: z.string().optional().nullable(),
  linkedLeaveRequestId: z.string().optional().nullable(),
});

export const updatePenaltyActionSchema = z.object({
  action: z.literal('update-penalty'),
  id: z.string().min(1),
  patch: penaltyPatchSchema,
  actor: z.string().min(1),
});


export const upsertPenaltyTypeActionSchema = z.object({
  action: z.literal('upsert-penalty-type'),
  payload: z.object({
    id: z.string().min(1),
    typeCode: z.string().min(1),
    typeName: z.string().min(1),
    active: z.boolean(),
  }),
  actor: z.string().min(1),
});

export const syncServiceYearsActionSchema = z.object({
  action: z.literal('sync-service-years'),
  employeeId: z.string().optional(),
  actor: z.string().optional(),
});

export const upsertServiceYearActionSchema = z.object({
  action: z.literal('upsert-service-year'),
  actor: z.string().min(1),
  payload: z.object({
    employeeId: z.string().min(1),
    employeeName: z.string().min(1),
    hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    employmentType: z.enum(['Permanent', 'Intern', 'Probation']),
    serviceYears: z.coerce.number().min(0),
  }),
});

export const getUnifiedProfileActionSchema = z.object({
  action: z.literal('get-profile'),
  employeeId: z.string().min(1),
  year: z.coerce.number().int().optional(),
  periodType: periodTypeSchema.optional(),
  actor: z.string().optional(),
});

export const saveThresholdsActionSchema = z.object({
  action: z.literal('save-thresholds'),
  thresholds: z.object({
    high: z.coerce.number().min(0).max(100),
    mid: z.coerce.number().min(0).max(100),
  }),
  actor: z.string().min(1),
});

export const saveStandardMarksActionSchema = z.object({
  action: z.literal('save-standard-marks'),
  marks: z.record(z.string(), z.coerce.number().min(0)).nullable(),
  bucketCategories: z.record(z.string(), z.string()).optional().nullable(),
  actor: z.string().min(1),
});

export function toObject(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries());
}
