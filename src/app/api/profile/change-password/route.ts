import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getRequestUserId } from '@/lib/apiAuth';
import { changeUserPasswordController } from '@/controllers/authController';

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['employee', 'hod', 'admin', 'intern', 'probation']);
    if (auth.response) return auth.response;

    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const requesterId = getRequestUserId(request);
    if (!requesterId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await changeUserPasswordController(requesterId, newPassword);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
