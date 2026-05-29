
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestDepartment, getRequestUserId, requireRole } from '@/lib/apiAuth';
import { getCache, setCache } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['employee', 'director', 'hod', 'admin', 'intern', 'probation']);
    if (auth.response) return auth.response;

    const userId = getRequestUserId(request);
    const department = getRequestDepartment(request);

    let pendingLeaveCount = 0;

    const cacheKey = `sidebar-stats:leave:${auth.role}:${department || 'all'}`;
    const cachedCount = await getCache<number>(cacheKey);

    if (cachedCount !== null) {
      pendingLeaveCount = cachedCount;
    } else {
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
      // Cache for 60 seconds
      await setCache(cacheKey, pendingLeaveCount, 60);
    }

    return NextResponse.json({
      pendingLeaveCount,
    }, { status: 200 });

  } catch (error) {
    console.error('Sidebar Stats API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
