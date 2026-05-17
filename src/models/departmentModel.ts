import { prisma } from '@/lib/prisma';

export type DepartmentRecord = {
  id: string;
  name: string;
  hodName: string; // From joined users table
  hodId?: string | null;
  headcount: number;
  budget: string;
  status: 'active' | 'inactive';
};

export async function listDepartments(): Promise<DepartmentRecord[]> {
  // 1. Fetch departments
  const deptData = await prisma.departments.findMany({
    orderBy: { name: 'asc' }
  });

  // 2. Fetch all users who are HODs to map their names
  const userData = await prisma.users.findMany({
    where: { role: { in: ['hod', 'admin'] } },
    select: { id: true, name: true }
  });

  const hodMap = (userData ?? []).reduce((acc: Record<string, string>, user: any) => {
    acc[user.id] = user.name;
    return acc;
  }, {});

  // 3. Map results
  return (deptData ?? []).map((row: any) => ({
    id: row.id,
    name: row.name || 'Unnamed Department',
    hodId: row.hod_id || null,
    hodName: hodMap[row.hod_id!] || row.hod || 'Pending Assignment',
    headcount: Number(row.headcount || 0),
    budget: row.budget || 'TBD',
    status: row.status === 'inactive' ? 'inactive' : 'active',
  }));
}

export async function upsertDepartment(department: DepartmentRecord) {
  await prisma.departments.upsert({
    where: { id: department.id },
    update: {
      name: department.name,
      hod: department.hodName,
      hod_id: department.hodId,
      headcount: department.headcount,
      budget: department.budget,
      status: department.status as any,
      updated_at: new Date()
    },
    create: {
      id: department.id,
      name: department.name,
      hod: department.hodName,
      hod_id: department.hodId,
      headcount: department.headcount,
      budget: department.budget,
      status: department.status as any,
      created_at: new Date(),
      updated_at: new Date()
    }
  });
}

export async function deleteDepartment(id: string) {
  await prisma.departments.delete({
    where: { id }
  });
}
