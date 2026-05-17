export type ClientRole = 'admin' | 'hod' | 'employee' | 'intern' | 'probation';

export type ClientIdentity = {
  role: ClientRole;
  userId: string;
  userName: string;
  department: string;
  silentMode?: boolean;
};

const ROLE_DEFAULTS: Record<ClientRole, Omit<ClientIdentity, 'role'>> = {
  admin: {
    userId: 'admin-001',
    userName: 'Admin',
    department: 'Headquarters',
  },
  hod: {
    userId: 'u-001',
    userName: 'HOD / Manager',
    department: 'Operations',
  },
  employee: {
    userId: 'EMP-0042',
    userName: 'Employee',
    department: 'Operations',
  },
  intern: {
    userId: 'INT-0001',
    userName: 'Intern',
    department: 'Operations',
  },
  probation: {
    userId: 'PRB-0001',
    userName: 'Probation',
    department: 'Operations',
  },
};

const REPORTING_OFFICER_BY_DEPT: Record<string, string> = {
  operations: 'u-001',
  ops: 'u-001',
  headquarters: 'admin-001',
  finance: 'u-001',
  hr: 'u-001',
};

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeRole(value: string | null | undefined, fallback: ClientRole): ClientRole {
  const normalized = String(value || '').trim().toLowerCase();
  if (['admin', 'hod', 'employee', 'intern', 'probation'].includes(normalized)) {
    return normalized as ClientRole;
  }
  return fallback;
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const cookiePairs = document.cookie ? document.cookie.split(';') : [];
  for (const pair of cookiePairs) {
    const trimmed = pair.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    const key = separatorIndex === -1 ? trimmed : trimmed.slice(0, separatorIndex);
    if (key !== name) {
      continue;
    }

    const rawValue = separatorIndex === -1 ? '' : trimmed.slice(separatorIndex + 1);
    return safeDecode(rawValue);
  }

  return undefined;
}

function readLocalStorage(name: string): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const value = window.localStorage.getItem(name);
    return value === null ? undefined : safeDecode(value);
  } catch {
    return undefined;
  }
}

export function readClientIdentity(preferredRole: ClientRole = 'employee'): ClientIdentity {
  const role = normalizeRole(readCookie('ezeem_role') || readLocalStorage('ezeem_role'), preferredRole);
  const defaults = ROLE_DEFAULTS[role];

  const userId = safeDecode(String(readCookie('ezeem_user_id') || readLocalStorage('ezeem_user_id') || defaults.userId).trim() || defaults.userId);
  const userName = safeDecode(String(readCookie('ezeem_user_name') || readLocalStorage('ezeem_name') || defaults.userName).trim() || defaults.userName);
  const department = safeDecode(String(readCookie('ezeem_department') || readLocalStorage('ezeem_department') || defaults.department).trim() || defaults.department);

  return {
    role,
    userId,
    userName,
    department,
  };
}

export function buildClientAuthHeaders(identity: ClientIdentity) {
  return {
    'x-user-role': identity.role,
    'x-user-id': identity.userId,
    'x-user-department': identity.department,
    'x-silent-mode': identity.silentMode ? 'true' : 'false',
  };
}

export function getDefaultReportingOfficer(department: string, fallback = 'u-001') {
  const fromCookie = String(readCookie('ezeem_reporting_officer') || '').trim();
  if (fromCookie) {
    return fromCookie;
  }

  const normalizedDepartment = String(department || '').trim().toLowerCase();
  return REPORTING_OFFICER_BY_DEPT[normalizedDepartment] || fallback;
}
export function getInitials(name?: string, fallback = '??') {
  if (!name || !name.trim()) return fallback;
  try {
    const decoded = decodeURIComponent(name);
    const parts = decoded.split(' ').filter(Boolean);
    if (parts.length === 0) return fallback;
    const initials = parts.map(n => n[0]).join('').toUpperCase();
    return initials.slice(0, 2);
  } catch {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return fallback;
    const initials = parts.map(n => n[0]).join('').toUpperCase();
    return initials.slice(0, 2);
  }
}
