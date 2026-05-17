import { NextRequest, NextResponse } from 'next/server';
import { changeUserPasswordController } from '@/controllers/authController';
import { requireUserIdentity } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const auth = requireUserIdentity(request);
    if (auth.response) return auth.response;

    const authId = auth.userId;
    if (!authId) {
      return NextResponse.json({ error: 'Auth session expired. Please log out and back in to change your password.' }, { status: 401 });
    }

    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    const result = await changeUserPasswordController(authId, newPassword);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during password reset';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
