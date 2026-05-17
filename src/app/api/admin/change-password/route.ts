import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/apiAuth';
import { changeUserPasswordController } from '@/controllers/authController';

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['admin']);
    if (auth.response) return auth.response;

    const body = await request.json();
    const { userId, newPassword } = body;

    if (!userId || !newPassword) {
      return NextResponse.json({ error: 'userId and newPassword are required' }, { status: 400 });
    }

    const { insertSystemAuditLog } = await import('@/models/systemAuditLogModel');

    // Change password in local database
    await changeUserPasswordController(userId, newPassword);

    // Log activity
    await insertSystemAuditLog(
      'user-management',
      'ADMIN_FORCE_PASSWORD_CHANGE',
      'admin',
      { userId }
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
