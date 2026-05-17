import { NextRequest, NextResponse } from 'next/server';
import { confirmPasswordResetController } from '@/controllers/authController';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Recovery token and new password are required.' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    const result = await confirmPasswordResetController(token, newPassword);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during password reset confirmation';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
