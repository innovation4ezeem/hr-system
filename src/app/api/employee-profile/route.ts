import { NextRequest, NextResponse } from 'next/server';
import { getRequestUserId, requireRole } from '@/lib/apiAuth';
import { getUnifiedEmployeeProfileController } from '@/controllers/performanceManagementController';
import { periodTypeSchema } from '@/lib/validators/performanceManagementSchemas';

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['employee', 'hod', 'admin', 'intern', 'probation']);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const employeeId = (searchParams.get('employeeId') || '').trim();
    const yearParam = searchParams.get('year');
    const periodTypeRaw = searchParams.get('periodType');

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    if (auth.role === 'employee') {
      const requesterId = getRequestUserId(request);
      if (!requesterId) {
        return NextResponse.json({ error: 'Missing user identity' }, { status: 401 });
      }
      if (employeeId !== requesterId) {
        return NextResponse.json({ error: 'employeeId does not match authenticated user' }, { status: 403 });
      }
    }

    let periodType: 'monthly' | 'quarterly' | 'yearly' | undefined;
    if (periodTypeRaw) {
      const parsed = periodTypeSchema.safeParse(periodTypeRaw);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      periodType = parsed.data;
    }

    const year = yearParam ? Number(yearParam) : new Date().getFullYear();

    const profile = await getUnifiedEmployeeProfileController({
      employeeId,
      year,
      periodType,
      actor: getRequestUserId(request) || auth.role || 'system',
    });

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
