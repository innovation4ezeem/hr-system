import { prisma } from '@/lib/prisma';
import { users_role, users_status, users_preferred_theme, users_profile_update_status } from '@prisma/client';

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'hod' | 'employee' | 'intern' | 'probation' | 'director';
  phoneNumber?: string | null;
  dept: string;
  status: 'active' | 'inactive' | 'pending' | 'terminated';
  joinDate: string | null;
  reportsToId?: string | null;
  departmentId?: string | null;
  profileUpdateStatus?: 'approved' | 'pending_approval' | 'rejected';
  preferredTheme?: 'light' | 'dark' | null;
  updatedAt?: string | null;
  rewards?: any[];
  achievements?: any[];
  experienceInOffice?: any[];
  address?: string | null;
  mailingAddress?: string | null;
  password?: string | null;
};

function normalizeUserRow(row: any): UserRecord {
  const role = String(row?.role || 'employee').toLowerCase();
  const status = String(row?.status || 'active').toLowerCase();

  return {
    id: String(row?.id || '').trim(),
    name: String(row?.name || '').trim(),
    email: String(row?.email || '').trim(),
    role: ['admin', 'hod', 'intern', 'probation', 'director'].includes(role) ? role as UserRecord['role'] : 'employee',
    phoneNumber: row?.phone ?? row?.phone_number ?? row?.phoneNumber ?? null,
    dept: String(row?.dept || 'Operations').trim() || 'Operations',
    status: ['inactive', 'pending', 'terminated'].includes(status) ? status as UserRecord['status'] : 'active',
    joinDate: row?.join_date ?? row?.joinDate ?? null,
    reportsToId: row?.reports_to_id ?? row?.reportsToId ?? null,
    departmentId: row?.department_id ?? row?.departmentId ?? null,
    profileUpdateStatus: row?.profile_update_status === 'approved' ? 'approved' : (row?.profile_update_status === 'pending' ? 'pending_approval' : 'approved'),
    preferredTheme: (row?.preferred_theme as UserRecord['preferredTheme']) ?? null,
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
    rewards: Array.isArray(row?.rewards) ? row.rewards : [],
    achievements: Array.isArray(row?.achievements) ? row.achievements : [],
    experienceInOffice: Array.isArray(row?.experience_in_office) ? row.experience_in_office : [],
    address: row?.address ?? null,
    mailingAddress: row?.mailing_address ?? null,
    password: row?.password ?? null,
  };
}

export async function listUsers(): Promise<UserRecord[]> {
  const data = await prisma.users.findMany({
    orderBy: { name: 'asc' },
  });

  return (data ?? []).map(normalizeUserRow).filter(user => Boolean(user.id));
}

export async function upsertUser(user: UserRecord) {
  const roleValue = (['admin', 'hod', 'employee', 'intern', 'probation', 'director'].includes(user.role) 
    ? user.role 
    : 'employee') as users_role;
    
  const statusValue = (['active', 'inactive', 'pending'].includes(user.status)
    ? user.status
    : (user.status === 'terminated' ? 'inactive' : 'active')) as users_status;

  await prisma.users.upsert({
    where: { id: user.id },
    update: {
      name: user.name,
      email: user.email,
      role: roleValue,
      phone: user.phoneNumber,
      dept: user.dept,
      status: statusValue,
      join_date: user.joinDate || "",
      reports_to_id: user.reportsToId,
      department_id: user.departmentId,
      profile_update_status: user.profileUpdateStatus === 'pending_approval' ? 'pending' : 'approved',
      preferred_theme: (user.preferredTheme as users_preferred_theme) || null,
      rewards: user.rewards || [],
      achievements: user.achievements || [],
      experience_in_office: user.experienceInOffice || [],
      address: user.address || null,
      mailing_address: user.mailingAddress || null,
      password: user.password || undefined,
      updated_at: new Date(),
    },
    create: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: roleValue,
      phone: user.phoneNumber,
      dept: user.dept,
      status: statusValue,
      join_date: user.joinDate || "",
      reports_to_id: user.reportsToId,
      department_id: user.departmentId,
      profile_update_status: user.profileUpdateStatus === 'pending_approval' ? 'pending' : 'approved',
      preferred_theme: (user.preferredTheme as users_preferred_theme) || null,
      rewards: user.rewards || [],
      achievements: user.achievements || [],
      experience_in_office: user.experienceInOffice || [],
      address: user.address || null,
      mailing_address: user.mailingAddress || null,
      password: user.password || null,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
}

export async function deleteUser(id: string) {
  // Enhanced Cascading Delete to ensure absolute data integrity
  await prisma.$transaction(async (tx) => {
    // 1. Gather all Leave Request IDs for sub-table cleanup
    const requests = await tx.leave_requests.findMany({
      where: { employee_id: id },
      select: { id: true }
    });
    const requestIds = requests.map(r => r.id);

    // 2. Cascade Delete Leave Sub-tables
    if (requestIds.length > 0) {
      await tx.leave_approvals.deleteMany({ where: { request_id: { in: requestIds } } });
      await tx.leave_request_days.deleteMany({ where: { request_id: { in: requestIds } } });
      await tx.leave_calendar_entries.deleteMany({ where: { request_id: { in: requestIds } } });
    }

    // 3. Cascade Delete Balance Sub-tables
    const balances = await tx.leave_balances.findMany({
      where: { employee_id: id },
      select: { id: true }
    });
    const balanceIds = balances.map(b => b.id);
    if (balanceIds.length > 0) {
      await tx.leave_balance_ledger.deleteMany({ where: { balance_id: { in: balanceIds } } });
    }

    // 4. Delete Core User Data Records
    await tx.leave_balances.deleteMany({ where: { employee_id: id } });
    await tx.leave_requests.deleteMany({ where: { employee_id: id } });
    await tx.employee_leave_attendance_records.deleteMany({ where: { employee_id: id } });
    await tx.employee_leave_entitlements.deleteMany({ where: { employee_id: id } });
    
    // Performance & Evaluation Cleanup
    await tx.activity_score_entries.deleteMany({ where: { assigned_to_id: id } });
    await tx.performance_scores.deleteMany({ where: { employee_id: id } });
    await tx.performance_inputs.deleteMany({ where: { employee_id: id } });
    await tx.performance_comments.deleteMany({ where: { employee_id: id } });
    await tx.self_evaluations.deleteMany({ where: { employee_id: id } });
    await tx.evaluation_attachments.deleteMany({ where: { employee_id: id } });
    
    // HR & Administrative Cleanup
    await tx.penalties.deleteMany({ where: { employee_id: id } });
    await tx.employee_service_years.deleteMany({ where: { employee_id: id } });
    await tx.profile_update_requests.deleteMany({ where: { employee_id: id } });
    await tx.profiles.deleteMany({ where: { id: id } }); // Profiles table uses id as PK (synced with user id)
    await tx.notifications.deleteMany({ where: { recipient_id: id } });

    // 5. Cleanup External References (Nullify instead of delete to preserve record history for others)
    // Reports To chain
    await tx.users.updateMany({
      where: { reports_to_id: id },
      data: { reports_to_id: null }
    });

    // Leave Approver references
    await tx.leave_approvals.updateMany({
      where: { approver_id: id },
      data: { approver_id: 'DELETED_USER' }
    });

    // Audit logs of actions they performed (Nullify actor ID but keep the log)
    await tx.system_audit_logs.updateMany({
      where: { actor: id },
      data: { actor: `deleted_user_${id.substring(0, 8)}` }
    });

    // 6. Finally delete the user record itself
    await tx.users.delete({ where: { id } });
  });
}

export async function getUser(id: string): Promise<UserRecord | null> {
  const data = await prisma.users.findUnique({
    where: { id }
  });
  if (!data) return null;
  return normalizeUserRow(data);
}

