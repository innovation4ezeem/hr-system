import { NextRequest, NextResponse } from 'next/server';
import { loginUserController } from '@/controllers/authController';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, user } = await loginUserController(body);

    const response = NextResponse.json({ user, message: 'Login successful' }, { status: 200 });

    if (token) {
      const role = user?.db_role || 'employee';
      const name = user?.db_name || user?.email;
      const dept = user?.db_dept || 'Operations';
      const id = user?.db_user_id || user?.id;
      const rememberMe = body.rememberMe === true;
      const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 86400;

      // Set the main JWT token cookie
      response.cookies.set('ezeem_token', token, { 
        path: '/', 
        maxAge,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      // Set UI helper cookies (metadata only)
      response.cookies.set('ezeem_role', role, { path: '/', maxAge });
      response.cookies.set('ezeem_user_id', id, { path: '/', maxAge });
      response.cookies.set('ezeem_user_name', encodeURIComponent(name), { path: '/', maxAge });
      response.cookies.set('ezeem_department', dept, { path: '/', maxAge });
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
