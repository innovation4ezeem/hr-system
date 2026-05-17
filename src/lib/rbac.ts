export type AppRole = 'admin' | 'hod' | 'employee' | 'intern' | 'probation';

export type AppFeature =
  | 'user_management'
  | 'scoring_engine'
  | 'task_assignment'
  | 'penalty_logs'
  | 'leave_system'
  | 'data_visibility'
  | 'archives';

type AccessLevel = 'none' | 'department' | 'company';

type FeaturePermission = {
  view: AccessLevel;
  edit: AccessLevel;
};

export const FEATURE_ACCESS: Record<AppRole, Record<AppFeature, FeaturePermission>> = {
  admin: {
    user_management: { view: 'company', edit: 'company' },
    scoring_engine: { view: 'company', edit: 'company' },
    task_assignment: { view: 'company', edit: 'company' },
    penalty_logs: { view: 'company', edit: 'company' },
    leave_system: { view: 'company', edit: 'company' },
    data_visibility: { view: 'company', edit: 'company' },
    archives: { view: 'company', edit: 'company' },
  },
  hod: {
    user_management: { view: 'department', edit: 'none' },
    scoring_engine: { view: 'department', edit: 'none' },
    task_assignment: { view: 'department', edit: 'department' },
    penalty_logs: { view: 'department', edit: 'department' },
    leave_system: { view: 'department', edit: 'department' },
    data_visibility: { view: 'department', edit: 'none' },
    archives: { view: 'department', edit: 'none' },
  },
  employee: {
    user_management: { view: 'none', edit: 'none' },
    scoring_engine: { view: 'none', edit: 'none' },
    task_assignment: { view: 'department', edit: 'none' },
    penalty_logs: { view: 'department', edit: 'none' },
    leave_system: { view: 'department', edit: 'department' },
    data_visibility: { view: 'department', edit: 'none' },
    archives: { view: 'department', edit: 'none' },
  },
  intern: {
    user_management: { view: 'none', edit: 'none' },
    scoring_engine: { view: 'none', edit: 'none' },
    task_assignment: { view: 'department', edit: 'none' },
    penalty_logs: { view: 'department', edit: 'none' },
    leave_system: { view: 'department', edit: 'department' },
    data_visibility: { view: 'department', edit: 'none' },
    archives: { view: 'department', edit: 'none' },
  },
  probation: {
    user_management: { view: 'none', edit: 'none' },
    scoring_engine: { view: 'none', edit: 'none' },
    task_assignment: { view: 'department', edit: 'none' },
    penalty_logs: { view: 'department', edit: 'none' },
    leave_system: { view: 'department', edit: 'department' },
    data_visibility: { view: 'department', edit: 'none' },
    archives: { view: 'department', edit: 'none' },
  },
};

export const ROUTE_ACCESS: Record<string, AppRole[]> = {
  '/admin-panel': ['admin'],
  '/manager-dashboard': ['admin', 'hod'],
  '/employee-portal': ['admin', 'hod', 'employee', 'intern', 'probation'],
};

export function canAccessRoute(role: AppRole | null | undefined, pathname: string) {
  if (!role) return false;

  const matchedPrefix = Object.keys(ROUTE_ACCESS).find(route => pathname.startsWith(route));
  if (!matchedPrefix) return true;

  return ROUTE_ACCESS[matchedPrefix].includes(role);
}

export function getDefaultRouteByRole(role: AppRole) {
  if (role === 'admin') return '/admin-panel';
  if (role === 'hod') return '/manager-dashboard';
  return '/employee-portal';
}

export function getDepartmentFilter(role: AppRole, department: string | null | undefined) {
  if (role === 'admin') return null;
  return department ?? null;
}

export function canEditFeature(role: AppRole, feature: AppFeature) {
  return FEATURE_ACCESS[role][feature].edit !== 'none';
}

/**
 * Returns true if the role is any type of employee (standard, intern, or probation).
 */
export function isEmployeeType(role: AppRole | null | undefined): boolean {
  if (!role) return false;
  return ['employee', 'intern', 'probation'].includes(role);
}