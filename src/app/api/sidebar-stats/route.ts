
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestDepartment, getRequestUserId, requireRole } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['employee', 'hod', 'admin', 'intern', 'probation']);
    if (auth.response) return auth.response;

    const userId = getRequestUserId(request);
    const department = getRequestDepartment(request);

    let pendingLeaveCount = 0;

    if (auth.role === 'admin') {
      pendingLeaveCount = await prisma.leave_requests.count({
        where: { status: 'pending' }
      });
    } else if (auth.role === 'hod' && department) {
      pendingLeaveCount = await prisma.leave_requests.count({
        where: { 
          status: 'pending',
          dept: department
        }
      });
    }

    return NextResponse.json({
      pendingLeaveCount,
    }, { status: 200 });

  } catch (error) {
    console.error('Sidebar Stats API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
