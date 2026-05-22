import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createToken, verifyToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('ezeem_token')?.value;
    if (!token) {
      return NextResponse.json({ updated: false }, { status: 200 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ updated: false }, { status: 200 });
    }

    // Check database for latest user role and department
    const dbUser = await prisma.users.findUnique({
      where: { id: String(payload.userId) }
    });

    if (!dbUser || dbUser.status !== 'active') {
      return NextResponse.json({ updated: false }, { status: 200 });
    }

    // Check if role, department or name changed
    if (
      dbUser.role !== payload.role || 
      dbUser.dept !== payload.department ||
      dbUser.name !== payload.name
    ) {
      // Create fresh token with new details
      const newToken = await createToken({
        userId: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        name: dbUser.name
      });

      const response = NextResponse.json({ 
        updated: true, 
        role: dbUser.role, 
        department: dbUser.dept,
        name: dbUser.name
      }, { status: 200 });

      // Calculate max age based on whether they had a long-lived cookie or session cookie
      // For simplicity, default to 24 hours, but ideally we'd preserve their previous choice.
      const maxAge = 86400;

      response.cookies.set('ezeem_token', newToken, { 
        path: '/', 
        maxAge,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      response.cookies.set('ezeem_role', dbUser.role, { path: '/', maxAge });
      response.cookies.set('ezeem_user_name', encodeURIComponent(dbUser.name), { path: '/', maxAge });
      response.cookies.set('ezeem_department', dbUser.dept, { path: '/', maxAge });

      return response;
    }

    return NextResponse.json({ updated: false }, { status: 200 });
  } catch (error) {
    console.error('Session sync error:', error);
    return NextResponse.json({ updated: false }, { status: 200 });
  }
}
