export type PerformanceMetric = 'attendance' | 'delivery' | 'quality' | 'projectCompletion' | 'taskAccuracy';

export type PerformanceScoreBreakdown = {
  kpiScore: number; // 0-60
  kpiAttendance: number; // 0-20
  kpiDelivery: number; // 0-20
  kpiQuality: number; // 0-20
  tasksBasedScore: number; // 0-25
  qualityScore: number; // 0-15
  totalScore: number; // 0-100
};

export interface PerformanceCalculation {
  employeeId: string;
  month: string;
  year: number;
  breakdown: PerformanceScoreBreakdown;
  remarks?: string;
  lastUpdated: string;
}

// Formula structure:
// Total Score = KPI (60) + Tasks Based (25) + Quality (15)
// Where:
// - KPI (60) = Attendance (20) + Delivery (20) + Quality (20)
// - Tasks Based (25) = (Achieved Tasks / Total Tasks) × 25
// - Quality (15) = ((Total Tasks - Errors) / Total Tasks) × 15

export function calculateKPIAttendance(
  attendanceDays: number,
  workingDays: number
): number {
  // 0-20 points
  const percentage = (attendanceDays / workingDays) * 100;
  return Math.min(20, (percentage / 100) * 20);
}

export function calculateKPIDelivery(
  completedDeliverables: number,
  plannedDeliverables: number,
  overdueItems: number = 0
): number {
  // 0-20 points
  // Each overdue item deducts 5 points
  const baseScore = (completedDeliverables / plannedDeliverables) * 20;
  const deductions = overdueItems * 5;
  return Math.max(0, Math.min(20, baseScore - deductions));
}

export function calculateKPIThirdComponent(
  defects: number,
  totalOutput: number
): number {
  // 0-20 points
  // Quality metric: 100 - ((Defects / Total Output) * 100)
  const errorPercentage = (defects / totalOutput) * 100;
  const qualityPercentage = 100 - errorPercentage;
  return Math.max(0, Math.min(20, (qualityPercentage / 100) * 20));
}

export function calculateTasksBasedScore(
  achievedTasks: number,
  totalTasks: number
): number {
  // 0-25 points
  return (achievedTasks / totalTasks) * 25;
}

export function calculateQualityScore(
  totalTasks: number,
  errors: number
): number {
  // 0-15 points
  const qualityPercentage = ((totalTasks - errors) / totalTasks) * 100;
  return (qualityPercentage / 100) * 15;
}

export function calculateTotalPerformanceScore(
  breakdown: Partial<PerformanceScoreBreakdown>
): number {
  const kpi = (breakdown.kpiScore || 0);
  const tasks = (breakdown.tasksBasedScore || 0);
  const quality = (breakdown.qualityScore || 0);
  return Math.min(100, kpi + tasks + quality);
}

export function getGradeFromScore(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  return 'C';
}

export function generatePerformanceRemark(score: number, grade: string): string {
  if (grade === 'A+') return 'Excellent performance. Consistently exceeding expectations.';
  if (grade === 'A') return 'Very good performance. Meeting and exceeding most targets.';
  if (grade === 'B+') return 'Good performance. Meeting key objectives.';
  if (grade === 'B') return 'Satisfactory performance. Meeting basic requirements.';
  if (grade === 'C+') return 'Needs improvement. Some areas below expectations.';
  return 'Below expectations. Improvement plan required.';
}
