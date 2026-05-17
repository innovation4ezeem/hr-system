import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const leaveTypeCodeSchema = z.enum([
  'AL',
  'MC',
  'CASUAL',
  'MATERNITY',
  'PATERNITY',
  'BEREAVEMENT',
  'UNPAID',
  'WFH',
  'REWARD',
  'CS',
  'REPLACEMENT',
  'ADDITIONAL',
]);

export const employmentTypeSchema = z.enum(['Permanent', 'Intern', 'Probation']);
export const sessionSchema = z.enum(['FULL', 'AM', 'PM']);
export const halfDaySchema = z.enum(['AM', 'PM']);
export const entitlementLeaveTypeCodeSchema = z.enum(['AL', 'MC', 'SL', 'WFH', 'REWARD', 'CS', 'MATERNITY', 'PATERNITY', 'REPLACEMENT', 'ADDITIONAL', 'BEREAVEMENT', 'UNPAID']);

export const validateLeaveRequestSchema = z.object({
  employeeId: z.string().min(1),
  leaveType: leaveTypeCodeSchema,
  startDate: z.string().regex(dateRegex, 'startDate must be YYYY-MM-DD'),
  endDate: z.string().regex(dateRegex, 'endDate must be YYYY-MM-DD'),
  session: sessionSchema,
  fromHalf: halfDaySchema.optional(),
  toHalf: halfDaySchema.optional(),
});

export const submitLeaveRequestSchema = z.object({
  action: z.literal('submit').default('submit'),
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  dept: z.string().min(1),
  leaveType: leaveTypeCodeSchema,
  employmentType: employmentTypeSchema,
  startDate: z.string().regex(dateRegex, 'startDate must be YYYY-MM-DD'),
  endDate: z.string().regex(dateRegex, 'endDate must be YYYY-MM-DD'),
  session: sessionSchema,
  units: z.number().positive().optional(),
  reason: z.string().trim().min(10),
  attachment: z.string().optional(),
  reportingOfficer: z.string().min(1),
  fromHalf: halfDaySchema.optional(),
  toHalf: halfDaySchema.optional(),
});

export const bulkDecisionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  actor: z.string().min(1),
  requestIds: z.array(z.string().min(1)).min(1),
  reason: z.string().optional(),
  comment: z.string().optional(),
});

export const requestActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'cancel', 'inquire', 'respond-to-inquiry']),
  actor: z.string().min(1),
  reason: z.string().optional(),
  comment: z.string().optional(),
});

export const leaveTypeUpsertSchema = z.object({
  code: leaveTypeCodeSchema,
  name: z.string().min(1),
  daysPerYear: z.number().min(0),
  baseDays: z.number().min(0).default(0),
  additionalDays: z.number().min(0).default(0),
  isProRated: z.boolean().default(false),
  carryForwardExpiryMonth: z.number().min(1).max(12).default(3),
  allowNegativeBalance: z.boolean().default(false),
  maxNegativeDays: z.number().min(0).default(0),
  carryForwardEnabled: z.boolean().default(false),
  carryForwardCap: z.number().min(0).default(0),
  genderScope: z.enum(['ALL', 'MALE', 'FEMALE', 'OTHER']).default('ALL'),
  approvalLevels: z.union([z.literal(1), z.literal(2)]).default(1),
  requiresAttachment: z.boolean().default(false),
  allowHalfDay: z.boolean().default(true),
  autoPenaltyOnWithoutPay: z.boolean().default(false),
  autoPenaltyOnExceedBalance: z.boolean().default(false),
  penaltyTypeCode: z.string().optional(),
  active: z.boolean().default(true),
});

export const workflowUpsertSchema = z.object({
  id: z.string().min(1).optional(),
  departmentId: z.string().optional(),
  leaveTypeCode: leaveTypeCodeSchema.optional(),
  levelCount: z.union([z.literal(1), z.literal(2)]),
  hrApproverId: z.string().optional(),
  active: z.boolean().default(true),
});

export const holidayUpsertSchema = z.object({
  id: z.string().min(1).optional(),
  holidayDate: z.string().regex(dateRegex, 'holidayDate must be YYYY-MM-DD'),
  name: z.string().min(1),
  region: z.string().default('DEFAULT'),
  optional: z.boolean().default(false),
});

export const leaveEntitlementOverrideSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeCode: entitlementLeaveTypeCodeSchema,
  year: z.coerce.number().int().min(2020),
  overrideDays: z.number().min(0),
  overrideReason: z.string().trim().min(1).optional(),
  overriddenBy: z.string().trim().optional(),
});

export const reportQuerySchema = z.object({
  reportMode: z.enum(['monthly', 'yearly', 'balance', 'utilization']),
  year: z.coerce.number().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  department: z.string().optional(),
  employeeId: z.string().optional(),
});

export const calendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  department: z.string().optional(),
});

export const historyQuerySchema = z.object({
  mode: z.literal('history'),
  employeeId: z.string().min(1),
  year: z.coerce.number().optional(),
  status: z.string().optional(),
});

export const teamHistoryQuerySchema = z.object({
  mode: z.literal('team-history'),
  year: z.coerce.number().optional(),
  status: z.string().optional(),
  leaveType: z.string().optional(),
  employmentType: z.string().optional(),
  dateRangeStart: z.string().regex(dateRegex).optional(),
  dateRangeEnd: z.string().regex(dateRegex).optional(),
  employeeNameSearch: z.string().optional(),
  department: z.string().optional(),
});

export const queueQuerySchema = z.object({
  mode: z.literal('queue'),
  hodId: z.string().min(1),
  status: z.string().optional(),
  leaveType: z.string().optional(),
  employmentType: z.string().optional(),
  dateRangeStart: z.string().regex(dateRegex).optional(),
  dateRangeEnd: z.string().regex(dateRegex).optional(),
  employeeNameSearch: z.string().optional(),
});

export const eligibleLeaveTypesQuerySchema = z.object({
  employeeId: z.string().min(1),
  year: z.coerce.number().optional(),
});

export const balancesQuerySchema = z.object({
  employeeId: z.string().min(1),
  year: z.coerce.number().optional(),
});

export function toObject(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries());
}
