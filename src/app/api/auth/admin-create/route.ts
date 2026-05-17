import { NextRequest, NextResponse } from 'next/server';
import { adminCreateUserController } from '@/controllers/authController';
import { requireRole } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    // Only admins can use this endpoint
    const auth = requireRole(request, ['admin']);
    if (auth.response) return auth.response;

    const body = await request.json();
    const { email, password, fullName, employeeId, dept, role } = body;

    // Validate required fields
    if (!email || !fullName) {
      return NextResponse.json({ error: 'Email and Full Name are required.' }, { status: 400 });
    }

    const result = await adminCreateUserController({
      email,
      password,
      fullName,
      employeeId,
      dept: dept || 'Operations',
      role: role || 'employee',
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during admin user creation';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
