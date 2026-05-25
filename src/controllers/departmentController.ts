import {
  deleteDepartment,
  listDepartments,
  upsertDepartment,
  type DepartmentRecord,
} from '@/models/departmentModel';
import { listUsers, upsertUser } from '@/models/userModel';

const fallbackDepartments: DepartmentRecord[] = [];

function normalizeStatus(value: string): DepartmentRecord['status'] {
  return value === 'inactive' ? 'inactive' : 'active';
}

export async function getDepartmentsController() {
  const [departments, users] = await Promise.all([
    listDepartments(),
    listUsers()
  ]);
  
  // Auto-sync logic: If no departments found, seed them from users table
  if (departments.length === 0) {
    const uniqueDepts = Array.from(new Set(users.map(u => u.dept).filter(Boolean)));
    
    if (uniqueDepts.length > 0) {
      const seeded: DepartmentRecord[] = [];
      for (const deptName of uniqueDepts) {
        // Find if there's an HOD for this dept
        const hod = users.find(u => u.dept === deptName && u.role === 'hod');
        const newDept: DepartmentRecord = {
          id: `d-${Math.random().toString(36).substring(2, 9)}`,
          name: deptName,
          hodName: hod?.name || 'Pending Assignment',
          hodId: hod?.id || null,
          headcount: users.filter(u => u.dept === deptName).length,
          budget: 'TBD',
          status: 'active'
        };
        await upsertDepartment(newDept);
        seeded.push(newDept);
      }
      return seeded;
    }
  }

  // Refresh headcounts dynamically based on current user assignments
  const refreshedDepartments = departments.map(dept => {
    const currentCount = users.filter(u => u.dept === dept.name).length;
    return {
      ...dept,
      headcount: currentCount
    };
  });
  
  return refreshedDepartments;
}

export async function createDepartmentController(payload: Partial<DepartmentRecord>) {
  const record: DepartmentRecord = {
    id: payload.id || `d-${Date.now()}`,
    name: (payload.name || '').trim(),
    hodName: (payload.hodName || 'Pending Assignment').trim() || 'Pending Assignment',
    hodId: payload.hodId || null,
    headcount: Number(payload.headcount || 0),
    budget: (payload.budget || 'TBD').trim() || 'TBD',
    status: normalizeStatus(String(payload.status || 'active')),
  };

  if (!record.name) {
    throw new Error('Department name is required');
  }

  await upsertDepartment(record);

  // If HOD is assigned during creation, update the user's role and link employees
  if (record.hodId) {
    const users = await listUsers();
    
    // 1. Update the HOD user record itself
    const hodUser = users.find(u => u.id === record.hodId);
    if (hodUser) {
      const nextRole = (hodUser.role === 'admin' || hodUser.role === 'director') ? hodUser.role : 'hod';
      await upsertUser({ 
        ...hodUser, 
        role: nextRole, 
        dept: record.name, 
        departmentId: record.id,
        reportsToId: null 
      });
    }

    // 2. Link existing employees in this department to report to this HOD
    const deptUsers = users.filter(u => u.dept === record.name && u.role !== 'hod' && u.id !== record.hodId);
    for (const u of deptUsers) {
      if (u.reportsToId !== record.hodId) {
        await upsertUser({ ...u, reportsToId: record.hodId, departmentId: record.id });
      }
    }
  }

  return record;
}

export async function updateDepartmentController(id: string, payload: Partial<DepartmentRecord>) {
  if (!id) throw new Error('Department id is required');
  const existing = (await listDepartments()).find(item => item.id === id);
  if (!existing) throw new Error('Department not found');

  const record: DepartmentRecord = {
    ...existing,
    ...payload,
    id,
    status: normalizeStatus(String(payload.status || existing.status)),
    headcount: Number(payload.headcount ?? existing.headcount),
    hodId: payload.hodId === undefined ? existing.hodId : payload.hodId,
  };

  await upsertDepartment(record);

  // Auto-sync HOD link to user records and employees in this department
  if (record.hodId && record.hodId !== existing.hodId) {
    const users = await listUsers();
    
    // 1. Update the NEW HOD user record
    const newHodUser = users.find(u => u.id === record.hodId);
    if (newHodUser) {
      const nextRole = (newHodUser.role === 'admin' || newHodUser.role === 'director') ? newHodUser.role : 'hod';
      await upsertUser({ 
        ...newHodUser, 
        role: nextRole, 
        dept: record.name, 
        departmentId: record.id,
        reportsToId: null 
      });
    }

    // 2. Demote OLD HOD if they aren't leading any other department
    if (existing.hodId && existing.hodId !== record.hodId) {
      const oldHodUser = users.find(u => u.id === existing.hodId);
      if (oldHodUser && oldHodUser.role === 'hod') {
        const allDepts = await listDepartments();
        // Check if they are still HOD of any other department
        const isStillHodElsewhere = allDepts.some(d => d.id !== record.id && d.hodId === existing.hodId);
        if (!isStillHodElsewhere) {
          await upsertUser({ ...oldHodUser, role: 'employee' });
        }
      }
    }

    // 3. Link existing employees in this department to the NEW HOD
    const deptUsers = users.filter(u => u.dept === record.name && u.role !== 'hod' && u.id !== record.hodId);
    for (const u of deptUsers) {
      if (u.reportsToId !== record.hodId) {
        await upsertUser({ ...u, reportsToId: record.hodId, departmentId: record.id });
      }
    }
  } else if (record.name !== existing.name) {
    // If department name changed, update all employees' dept string and departmentId
    const users = await listUsers();
    const deptUsers = users.filter(u => u.dept === existing.name || u.departmentId === record.id);
    for (const u of deptUsers) {
      await upsertUser({ ...u, dept: record.name, departmentId: record.id });
    }
  }

  return record;
}

export async function deleteDepartmentController(id: string) {
  if (!id) throw new Error('Department id is required');
  await deleteDepartment(id);
}
