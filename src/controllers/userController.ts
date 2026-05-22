import { deleteUser, listUsers, upsertUser, type UserRecord } from '@/models/userModel';
import { prisma } from '@/lib/prisma';
import { listDepartments } from '@/models/departmentModel';
import {
  countPendingApprovalsForApprover,
  reassignPendingApprovals,
} from '@/models/leaveManagementModel';
import { insertSystemAuditLog } from '@/models/systemAuditLogModel';
import bcrypt from 'bcryptjs';

const fallbackUsers: UserRecord[] = [];

function normalizeRole(value: string): UserRecord['role'] {
  const v = value.toLowerCase();
  if (['admin', 'hod', 'director', 'intern', 'probation'].includes(v)) return v as any;
  return 'employee';
}

function normalizeStatus(value: string): UserRecord['status'] {
  return ['active', 'inactive', 'terminated'].includes(value) ? (value as UserRecord['status']) : 'pending';
}

type UserUpdatePayload = Partial<UserRecord> & {
  replacementApproverId?: string;
};

function findReplacementApproverId(
  users: UserRecord[],
  existing: UserRecord,
  replacementApproverId?: string,
) {
  const explicitReplacementId = String(replacementApproverId || '').trim();
  if (explicitReplacementId) {
    const explicit = users.find(item => item.id === explicitReplacementId);
    if (!explicit) {
      throw new Error('replacementApproverId was not found');
    }
    if (explicit.id === existing.id) {
      throw new Error('replacementApproverId cannot be the same as the original approver');
    }
    if (explicit.status !== 'active') {
      throw new Error('replacementApproverId must be an active user');
    }
    if (explicit.role !== 'hod' && explicit.role !== 'admin') {
      throw new Error('replacementApproverId must be a HOD or admin user');
    }
    return explicit.id;
  }

  const hodInSameDept = users.find(item => (
    item.id !== existing.id
    && item.role === 'hod'
    && item.status === 'active'
    && item.dept === existing.dept
  ));
  if (hodInSameDept) {
    return hodInSameDept.id;
  }

  const activeAdmin = users.find(item => (
    item.id !== existing.id
    && item.role === 'admin'
    && item.status === 'active'
  ));
  if (activeAdmin) {
    return activeAdmin.id;
  }

  return null;
}

export async function getUsersController() {
  return listUsers();
}

export async function createUserController(payload: Partial<UserRecord> & { sendNotification?: boolean, internDurationMonths?: number }, actor = 'system') {
  const users = await listUsers();

  const record: UserRecord = {
    id: payload.id || `u-${Date.now()}`,
    name: (payload.name || '').trim(),
    email: (payload.email || '').trim(),
    phoneNumber: (payload.phoneNumber || '').trim(),
    role: normalizeRole(String(payload.role || 'employee')),
    dept: (payload.dept || 'Operations').trim() || 'Operations',
    status: normalizeStatus(String(payload.status || 'pending')),
    joinDate: payload.joinDate || null,
    rewards: Array.isArray(payload.rewards) ? payload.rewards : [],
    achievements: Array.isArray(payload.achievements) ? payload.achievements : [],
    experienceInOffice: Array.isArray(payload.experienceInOffice) ? payload.experienceInOffice : [],
    address: payload.address || null,
    mailingAddress: payload.mailingAddress || null,
    departmentId: payload.departmentId || null,
    reportsToId: payload.reportsToId || null,
    password: payload.password || null,
  };

  // Ensure password is hashed if provided in plain text
  if (record.password && !record.password.startsWith('$2a$') && !record.password.startsWith('$2b$')) {
    record.password = await bcrypt.hash(record.password, 10);
  }

  // Auto-resolve department info
  const depts = await listDepartments();
  const matchedDept = depts.find(d => 
    d.id === record.departmentId || 
    d.name.trim().toLowerCase() === record.dept.trim().toLowerCase()
  );
  if (matchedDept) {
    record.departmentId = matchedDept.id;
    record.dept = matchedDept.name;
    if (record.role !== 'hod' && matchedDept.hodId && !record.reportsToId) {
      record.reportsToId = matchedDept.hodId;
    }
  }

  if (!record.name || !record.email) {
    throw new Error('Name and email are required');
  }

  const duplicateId = users.find(item => item.id === record.id);
  if (duplicateId) {
    throw new Error('User id already exists');
  }

  const duplicateEmail = users.find(item => item.email.toLowerCase() === record.email.toLowerCase());
  if (duplicateEmail) {
    throw new Error('Email already exists');
  }

  await upsertUser(record);
  
  // Sync HOD status to Department table if user is an HOD
  if (record.role === 'hod' && record.status === 'active') {
    await prisma.departments.updateMany({
      where: { name: record.dept },
      data: {
        hod_id: record.id,
        hod: record.name,
        updated_at: new Date()
      }
    });

    // Also update all employees in this department to report to this new HOD
    await prisma.users.updateMany({
      where: { 
        dept: record.dept,
        role: { not: 'hod' }
      },
      data: {
        reports_to_id: record.id,
        updated_at: new Date()
      }
    });
  }

  // 1. Initialize leave balances for the current year automatically based on role/tenure
  try {
    const { ensureBalancesForEmployee, upsertLeaveEntitlementOverride } = await import('@/models/leaveManagementModel');
    const currentYear = new Date().getFullYear();

    if (record.role === 'intern' && payload.internDurationMonths) {
      await upsertLeaveEntitlementOverride({
        employeeId: record.id,
        leaveTypeCode: 'WFH',
        year: currentYear,
        overrideDays: Number(payload.internDurationMonths) * 2,
        overrideReason: 'Intern Duration'
      });
    }

    await ensureBalancesForEmployee(record.id, currentYear);
    console.log(`Initialized leave balances for new user: ${record.name} (${record.id})`);
  } catch (err) {
    console.error(`Failed to initialize leave balances for user ${record.id}:`, err);
    // We don't throw here to avoid failing the whole user creation if just balances fail
  }

  // 2. Welcome Notification
  const shouldNotify = payload.sendNotification === true;
  if (shouldNotify) {
    try {
      const { HRNotificationService } = await import('@/lib/notifications/hrNotificationService');
      await HRNotificationService.notifyUserWelcome({
        employeeId: record.id,
        employeeName: record.name,
        employeeEmail: record.email,
        role: record.role,
        dept: record.dept,
        joinDate: record.joinDate || 'TBD',
        status: record.status
      });
    } catch (err) {
      console.error(`Failed to send welcome notification for user ${record.id}:`, err);
    }
  }

  await insertSystemAuditLog('user-management', 'USER_CREATED', actor, {
    userId: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    dept: record.dept,
  });

  return record;
}

export async function updateUserController(id: string, payload: UserUpdatePayload, actor = 'system') {
  if (!id) throw new Error('User id is required');

  const users = await listUsers();
  const existing = users.find(item => item.id === id);
  if (!existing) throw new Error('User not found');

  const nextName = payload.name === undefined ? existing.name : String(payload.name || '').trim();
  const nextEmail = payload.email === undefined ? existing.email : String(payload.email || '').trim();
  const nextDept = payload.dept === undefined ? existing.dept : String(payload.dept || '').trim();

  if (!nextName || !nextEmail || !nextDept) {
    throw new Error('Name, email and department are required');
  }

  const duplicateEmail = users.find(item => item.id !== id && item.email.toLowerCase() === nextEmail.toLowerCase());
  if (duplicateEmail) {
    throw new Error('Email already exists');
  }

  const record: UserRecord = {
    ...existing,
    ...payload,
    id,
    name: nextName,
    email: nextEmail,
    dept: nextDept,
    phoneNumber: payload.phoneNumber === undefined ? existing.phoneNumber : (payload.phoneNumber || '').trim(),
    role: normalizeRole(String(payload.role || existing.role)),
    status: normalizeStatus(String(payload.status || existing.status)),
    rewards: Array.isArray(payload.rewards) ? payload.rewards : existing.rewards,
    achievements: Array.isArray(payload.achievements) ? payload.achievements : existing.achievements,
    experienceInOffice: Array.isArray(payload.experienceInOffice) ? payload.experienceInOffice : existing.experienceInOffice,
    address: payload.address === undefined ? existing.address : (payload.address || null),
    mailingAddress: payload.mailingAddress === undefined ? existing.mailingAddress : (payload.mailingAddress || null),
    departmentId: payload.departmentId === undefined ? existing.departmentId : (payload.departmentId || null),
    reportsToId: payload.reportsToId === undefined ? existing.reportsToId : (payload.reportsToId || null),
    password: payload.password === undefined ? existing.password : (payload.password || null),
  };

  // Ensure password is hashed if updated in plain text
  if (payload.password && !payload.password.startsWith('$2a$') && !payload.password.startsWith('$2b$')) {
    record.password = await bcrypt.hash(payload.password, 10);
  }

  // Auto-resolve department info if department changed
  if (record.dept !== existing.dept || record.departmentId !== existing.departmentId) {
    const depts = await listDepartments();
    // If name was explicitly changed in payload, prioritize finding by name
    const nameChanged = payload.dept !== undefined && payload.dept !== existing.dept;
    
    const matchedDept = depts.find(d => {
      if (nameChanged) {
        return d.name.trim().toLowerCase() === record.dept.trim().toLowerCase();
      }
      return d.id === record.departmentId || d.name.trim().toLowerCase() === record.dept.trim().toLowerCase();
    });

    if (matchedDept) {
      record.departmentId = matchedDept.id;
      record.dept = matchedDept.name;
      // Only auto-update manager if it wasn't explicitly changed in this payload
      if (record.role !== 'hod' && matchedDept.hodId && payload.reportsToId === undefined) {
        record.reportsToId = matchedDept.hodId;
      }
    }
  }

  const isHodTransition = existing.role === 'hod' && (
    record.role !== 'hod'
    || record.status !== 'active'
    || record.dept !== existing.dept
  );

  let reassignedPendingApprovals = 0;
  if (isHodTransition) {
    const pendingCount = await countPendingApprovalsForApprover(existing.id, existing.dept);
    if (pendingCount > 0) {
      const replacementApproverId = findReplacementApproverId(users, existing, payload.replacementApproverId);
      if (!replacementApproverId) {
        throw new Error('Pending approvals exist for this HOD. Provide replacementApproverId or activate another HOD/admin first.');
      }

      reassignedPendingApprovals = await reassignPendingApprovals({
        previousApproverId: existing.id,
        nextApproverId: replacementApproverId,
        department: existing.dept,
      });
    }
  }

  const isActivating = existing.status === 'pending' && record.status === 'active';

  await upsertUser(record);
  
  // If name has changed, sync it across historical records to ensure consistency
  if (record.name !== existing.name) {
    const nextName = record.name;
    const userId = record.id;
    
    await Promise.all([
      prisma.activity_score_entries.updateMany({
        where: { assigned_to_id: userId },
        data: { assigned_to_name: nextName }
      }),
      prisma.leave_requests.updateMany({
        where: { employee_id: userId },
        data: { employee_name: nextName }
      }),
      prisma.penalties.updateMany({
        where: { employee_id: userId },
        data: { employee_name: nextName }
      }),
      prisma.performance_inputs.updateMany({
        where: { employee_id: userId },
        data: { employee_name: nextName }
      }),
      prisma.performance_scores.updateMany({
        where: { employee_id: userId },
        data: { employee_name: nextName }
      }),
      prisma.employee_leave_attendance_records.updateMany({
        where: { employee_id: userId },
        data: { employee_name: nextName }
      }),
      prisma.leave_calendar_entries.updateMany({
        where: { employee_id: userId },
        data: { employee_name: nextName }
      }),
      prisma.employee_service_years.updateMany({
        where: { employee_id: userId },
        data: { employee_name: nextName }
      }),
      // Also update them as HOD in Department if they were already assigned
      prisma.departments.updateMany({
        where: { hod_id: userId },
        data: { hod: nextName }
      })
    ]);
    
    console.log(`Synced name change for ${userId}: ${existing.name} -> ${nextName}`);
  }

  if (isActivating) {
    try {
      const { HRNotificationService } = await import('@/lib/notifications/hrNotificationService');
      await HRNotificationService.notifyAccountActivation({
        employeeId: record.id,
        employeeName: record.name,
        employeeEmail: record.email,
      });
    } catch (err) {
      console.error(`Failed to send activation notification for user ${record.id}:`, err);
    }
  }
  
  // Sync HOD status to Department table
  if (record.role === 'hod' && record.status === 'active') {
    // Overwrite the department's HOD with this user
    await prisma.departments.updateMany({
      where: { name: record.dept },
      data: {
        hod_id: record.id,
        hod: record.name,
        updated_at: new Date()
      }
    });

    // Also update all employees in this department to report to this HOD
    await prisma.users.updateMany({
      where: { 
        dept: record.dept,
        role: { not: 'hod' }
      },
      data: {
        reports_to_id: record.id,
        updated_at: new Date()
      }
    });
  } else if (existing.role === 'hod' && record.role !== 'hod') {
    // If they were an HOD but aren't anymore, clear the department's HOD field
    await prisma.departments.updateMany({
      where: { hod_id: record.id },
      data: {
        hod_id: null,
        hod: 'Pending Assignment',
        updated_at: new Date()
      }
    });
  }

  await insertSystemAuditLog('user-management', 'USER_UPDATED', actor, {
    userId: record.id,
    name: record.name,
    changes: payload,
  });

  return {
    ...record,
    reassignedPendingApprovals,
  };
}

export async function deleteUserController(id: string, actor = 'system') {
  if (!id) throw new Error('User id is required');
  
  const users = await listUsers();
  const existing = users.find(item => item.id === id);
  
  await deleteUser(id);
  
  // If the deleted user was an HOD, clear the department assignment
  if (existing?.role === 'hod') {
    await prisma.departments.updateMany({
      where: { hod_id: id },
      data: {
        hod_id: null,
        hod: 'Pending Assignment',
        updated_at: new Date()
      }
    });
  }

  await insertSystemAuditLog('user-management', 'USER_DELETED', actor, {
    userId: id,
    name: existing?.name || 'Unknown',
  });
}
