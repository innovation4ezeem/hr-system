import { NextRequest, NextResponse } from 'next/server';
import { registerUserController } from '@/controllers/authController';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await registerUserController(body);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
