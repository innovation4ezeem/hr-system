import { formatToDisplayDate } from '@/lib/dateUtils';

export function processUnifiedProfile(profileData: any, context: { userId: string; userName: string; userRole: string; userDepartment: string; selectedYear: number; isArchive: boolean }) {
  const { userId, userName, userRole, userDepartment, selectedYear, isArchive } = context;

  const baseProfile = {
    name: userName || 'User',
    id: userId || 'ID-PENDING',
    role: (userRole === 'hod') ? `Head of ${userDepartment || 'Department'}` : (userRole === 'admin') ? 'System Admin' : 'Employee',
    dept: userDepartment || 'General',
    status: 'Active',
    reportTo: userRole === 'employee' ? 'HOD' : 'Organization',
    joinDate: 'TBD',
    yearsService: 0,
    monthsService: 0,
    email: '',
    phone: '+60xx-xxxxxxx',
    profileUpdateStatus: 'approved',
    lastUpdatedAt: null as string | null,
    performanceHistory: [] as any[],
    rewards: [] as any[],
    achievements: [] as any[],
    experiences: [] as any[],
  };

  if (!profileData?.userMeta) return baseProfile;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const rawPerformance = profileData.performance || [];
  const hasYearlyResult = rawPerformance.some((p: any) => p.periodType === 'yearly');

  const performanceHistory = rawPerformance
    .filter((p: any) => {
      const isYearly = p.periodType === 'yearly';
      const pYear = p.periodYear || selectedYear;
      const pMonth = (p.periodNo || 1) - 1;

      if (isYearly) return true;
      if (isArchive && hasYearlyResult) return false;
      if (pYear === currentYear && pMonth > currentMonth && Number(p.finalScore || 0) === 0) {
        return false;
      }
      if (hasYearlyResult && Number(p.finalScore || 0) === 0) return false;
      return true;
    })
    .map((p: any) => ({
      year: p.periodYear || selectedYear,
      periodLabel: p.periodLabel,
      score: p.finalScore,
      grade: p.grade || 'C'
    }));

  return {
    ...baseProfile,
    name: profileData.userMeta.name || userName || 'User',
    id: userId || 'ID-PENDING',
    role: profileData.userMeta.role || baseProfile.role,
    dept: profileData.userMeta.dept || userDepartment || 'General',
    joinDate: profileData.userMeta.joinDate ? formatToDisplayDate(profileData.userMeta.joinDate) : 'TBD',
    yearsService: profileData.userMeta.yearsService || 0,
    monthsService: profileData.userMeta.monthsService || 0,
    status: profileData.userMeta.status || 'Active',
    reportTo: profileData.userMeta.reportsToName || baseProfile.reportTo,
    email: profileData.userMeta.email || '',
    phone: profileData.userMeta.phone || '+60xx-xxxxxxx',
    profileUpdateStatus: profileData.userMeta.profileUpdateStatus || 'approved',
    lastUpdatedAt: profileData.userMeta.lastUpdatedAt || null,
    wfhUsed: profileData.summary?.wfhUsed || 0,
    wfhLimit: profileData.summary?.wfhLimit || 4,
    rewards: profileData.rewards || [],
    achievements: profileData.achievements || [],
    experiences: profileData.experienceInOffice || [],
    performanceHistory,
  };
}
