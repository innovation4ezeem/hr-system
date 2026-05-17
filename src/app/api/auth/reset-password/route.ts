import { NextRequest, NextResponse } from 'next/server';
import { requestPasswordResetController } from '@/controllers/authController';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const result = await requestPasswordResetController(email);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during password reset request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
