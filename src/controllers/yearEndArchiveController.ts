import { getPerformanceSheetByYear } from '@/models/performanceScoreModel';
import { listScoringCategories, replaceScoringCategories } from '@/models/scoringCategoryModel';
import { listArchiveRuns, upsertHistoricalRecord, insertArchiveRun } from '@/models/yearEndArchiveModel';
import { insertSystemAuditLog } from '@/models/systemAuditLogModel';
import { listPenaltyRecords } from '@/models/penaltyRecordModel';

export async function runYearEndArchiveController(fromYear: number, triggeredBy: string, options?: { clearActive?: boolean }) {
  const toYear = fromYear + 1;

  const [performanceSheet, scoringCategories, penalties, leaveBalances, allUsers, settings] = await Promise.all([
    getPerformanceSheetByYear(fromYear),
    listScoringCategories(fromYear),
    listPenaltyRecords({ year: fromYear }),
    import('@/models/leaveManagementModel').then(m => m.listAllTeamBalances(fromYear)),
    import('@/models/userModel').then(m => m.listUsers()),
    import('@/models/systemSettingsModel').then(m => m.getSystemSettings()),
  ]);

  const userMap = new Map(allUsers.map(u => [u.id, u.name]));
  const userDeptMap = new Map(allUsers.map(u => [u.id, u.dept]));

  // 1. Snapshot and Archive to Historical Records
  
  // Flatten performance scores into a wide table list for the archive
  let performanceSummaryList: any[] = [];
  if (performanceSheet && performanceSheet.cellsByEmployee) {
    performanceSummaryList = Object.entries(performanceSheet.cellsByEmployee).map(([empId, categories]) => {
      return {
        employeeId: empId,
        employeeName: userMap.get(empId) || empId,
        dept: userDeptMap.get(empId) || '-',
        ...categories // Spreads all category columns (KPI, Quality, etc.)
      };
    });
  }
  await upsertHistoricalRecord(fromYear, 'performance', performanceSummaryList);
  
  // Flatten scoring rules (Weights + Standard Marks + Buckets)
  const scoringRulesArchive = [
    ...scoringCategories.map(c => ({ type: 'Category Weight', name: c.name, value: `${c.weight}%`, description: c.description })),
    ...Object.entries(settings.activityStandardMarks).map(([name, mark]) => ({
      type: 'Standard Mark',
      name,
      value: mark,
      description: 'Base score for activity'
    })),
    ...Object.entries(settings.activityBucketCategories).map(([name, bucket]) => ({
      type: 'Bucket Mapping',
      name,
      value: bucket,
      description: 'Primary scoring bucket'
    }))
  ];
  await upsertHistoricalRecord(fromYear, 'scoring-categories', scoringRulesArchive);

  await upsertHistoricalRecord(fromYear, 'penalty-records', penalties || []);
  
  // Flatten leave balances into a readable list for the archive
  const leaveSummaryList = Object.entries(leaveBalances).flatMap(([empId, balances]) => {
    return balances.map(b => ({
      employeeId: empId,
      employeeName: userMap.get(empId) || empId,
      leaveType: b.leaveTypeName,
      opening: b.openingDays,
      used: b.usedDays,
      remaining: b.availableDays
    }));
  });
  await upsertHistoricalRecord(fromYear, 'leave-summaries', leaveSummaryList);

  // Query and archive detailed leave histories
  const { listLeaveRequests } = await import('@/models/leaveRequestModel');
  const leaveRequests = await listLeaveRequests({
    dateRangeStart: `${fromYear}-01-01`,
    dateRangeEnd: `${fromYear}-12-31`,
    status: 'all'
  });
  await upsertHistoricalRecord(fromYear, 'leave-history', leaveRequests);

  // Query and archive detailed performance activities (activity_score_entries)
  const { prisma } = await import('@/lib/prisma');
  const activityEntries = await prisma.activity_score_entries.findMany({
    where: { year: fromYear }
  });
  await upsertHistoricalRecord(fromYear, 'performance-activities', activityEntries);

  // 2. Prepare next year workspace (Historical Placeholder)
  if (performanceSheet) {
    await upsertHistoricalRecord(toYear, 'performance', {
      note: 'Prepared next year workspace',
      createdFromYear: fromYear,
      archivedAt: new Date().toISOString(),
    });
  }

  // 3. Migrate scoring categories to next year
  if (scoringCategories.length) {
    const nextYearCategories = scoringCategories.map((item, index) => ({
      ...item,
      order: index + 1,
    }));
    await replaceScoringCategories(toYear, nextYearCategories);
  }

  // 4. Refresh Leave Entitlements for the new year
  // This recalculates balances based on updated service years (tenure)
  const { resyncAllEmployeeBalances } = await import('@/models/leaveManagementModel');
  await resyncAllEmployeeBalances(toYear);

  // 5. Clear active records for the archived year if requested
  if (options?.clearActive) {
    const { prisma } = await import('@/lib/prisma');
    const leaveRequestIds = leaveRequests.map(r => r.id);
    
    await Promise.all([
      prisma.performance_scores.deleteMany({ where: { period_year: fromYear } }),
      prisma.performance_inputs.deleteMany({ where: { period_year: fromYear } }),
      // Clear performance activities score entries for the archived year
      prisma.activity_score_entries.deleteMany({ where: { year: fromYear } }),
      // Clear active penalties for the archived year
      prisma.penalties.deleteMany({
        where: {
          penalty_date: {
            gte: `${fromYear}-01-01`,
            lte: `${fromYear}-12-31`
          }
        }
      }),
      // Clear active leave history requests and related details
      prisma.leave_approvals.deleteMany({ where: { request_id: { in: leaveRequestIds } } }),
      prisma.leave_request_days.deleteMany({ where: { request_id: { in: leaveRequestIds } } }),
      prisma.leave_calendar_entries.deleteMany({ where: { request_id: { in: leaveRequestIds } } }),
      prisma.employee_leave_attendance_records.deleteMany({ where: { leave_request_id: { in: leaveRequestIds } } }),
      prisma.leave_requests.deleteMany({ where: { id: { in: leaveRequestIds } } }),
    ]);
  }

  const summary = {
    archivedModules: ['performance', 'scoring-categories', 'penalty-records', 'leave-summaries', 'leave-history', 'performance-activities'],
    performanceFound: Boolean(performanceSheet),
    scoringCategoryCount: scoringCategories.length,
    leaveStateFound: false,
    penaltyCount: penalties.length,
    nextYearInitialized: toYear,
    clearedActive: Boolean(options?.clearActive),
  };

  await insertArchiveRun(fromYear, toYear, triggeredBy || 'system', summary);
  await insertSystemAuditLog('year-end-archive', 'run', triggeredBy || 'system', {
    fromYear,
    toYear,
    summary,
  });
  return { fromYear, toYear, summary };
}

export async function getArchiveRunsController() {
  return listArchiveRuns();
}
