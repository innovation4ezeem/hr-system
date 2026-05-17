import {
  archiveLeaveYear,
  getLeaveArchives,
  getLeaveYearConfigs,
  enableNextYearBooking,
  calculateProratedAllocation,
  type LeaveArchiveRecord,
  type LeaveYearConfig,
} from '@/models/leaveArchiveModel';
import { insertSystemAuditLog } from '@/models/systemAuditLogModel';

/**
 * Check if today is December 31st and trigger year-end archival if needed
 */
export async function checkAndProcessYearEnd(): Promise<boolean> {
  const today = new Date();
  const isYearEnd = today.getMonth() === 11 && today.getDate() === 31; // Dec 31

  if (!isYearEnd) {
    return false;
  }

  const currentYear = today.getFullYear();
  
  try {
    // Archive current year data
    const archived = await archiveLeaveYear(currentYear);
    
    // Enable next year booking
    await enableNextYearBooking(currentYear);
    
    // Log the operation
    await insertSystemAuditLog('leave-year-end', 'process', 'system', {
      year: currentYear,
      archiveCount: archived.length,
      action: 'year-end-archival-and-next-year-enable',
    });

    return true;
  } catch (error) {
    console.error('Year-end processing failed:', error);
    await insertSystemAuditLog('leave-year-end', 'process-failed', 'system', {
      year: currentYear,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Get leave year configurations with summary details
 */
export async function getLeaveYearSummary(): Promise<(LeaveYearConfig & { summary?: any })[]> {
  const configs = await getLeaveYearConfigs();
  
  return Promise.all(configs.map(async (config) => {
    // Get archive records for summary
    const archives = await getLeaveArchives(config.year);
    
    const summary = {
      totalEmployees: archives.length,
      totalAllocated: archives.reduce((sum, a) => sum + a.totalAllocation, 0),
      totalUtilized: archives.reduce((sum, a) => sum + a.utilized, 0),
      totalBalance: archives.reduce((sum, a) => sum + a.balance, 0),
      totalCarryForward: archives.reduce((sum, a) => sum + a.carryForward, 0),
    };

    return { ...config, summary };
  }));
}

/**
 * Export leave data for a specific year to JSON/CSV format
 */
export async function exportLeaveData(year: number, format: 'json' | 'csv' = 'json'): Promise<string> {
  const archives = await getLeaveArchives(year);

  if (format === 'json') {
    return JSON.stringify(archives, null, 2);
  }

  // CSV format
  const headers = [
    'ID',
    'Employee ID',
    'Employee Name',
    'Total Allocation',
    'Utilized',
    'Balance',
    'Carry Forward',
    'Prorated Allocation',
    'Archive Date',
  ];

  const rows = archives.map(a => [
    a.id,
    a.employeeId,
    a.employeeName,
    a.totalAllocation,
    a.utilized,
    a.balance,
    a.carryForward,
    a.proratedAllocation || 'N/A',
    a.archiveDate,
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csv;
}

/**
 * Check if an employee should have prorated allocation based on join date
 */
export async function shouldApplyProration(employeeJoinDate: string, year: number): Promise<boolean> {
  const joinDate = new Date(employeeJoinDate);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  // Prorated applies if joined during the year or if it's been less than 2 years
  const isJoinedThisYear = joinDate >= yearStart && joinDate <= yearEnd;
  const yearsService = (yearEnd.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

  return isJoinedThisYear || yearsService < 2;
}

/**
 * Get leave balance for an employee with prorated calculation if needed
 */
export async function getEmployeeLeaveBalance(
  employeeId: string,
  joinDate: string,
  year: number,
): Promise<{
  standardAllocation: number;
  proratedAllocation: number;
  applicableAllocation: number;
  utilized: number;
  balance: number;
  isProratedApplied: boolean;
}> {
  const standardAllocation = 21; // Standard 21 days per year
  const isProratedApplied = await shouldApplyProration(joinDate, year);
  const proratedAllocation = isProratedApplied ? await calculateProratedAllocation(joinDate, year) : standardAllocation;
  const applicableAllocation = isProratedApplied ? proratedAllocation : standardAllocation;

  // Get utilized days (from approved leave requests)
  // This would need to be fetched from leaveRequests table
  const utilized = 0; // Placeholder
  const balance = applicableAllocation - utilized;

  return {
    standardAllocation,
    proratedAllocation,
    applicableAllocation,
    utilized,
    balance,
    isProratedApplied,
  };
}
