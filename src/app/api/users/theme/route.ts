import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, getRequestUserId } from '@/lib/apiAuth';
import { users_preferred_theme } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const data = await prisma.users.findUnique({
      where: { id: userId },
      select: { preferred_theme: true }
    });

    return NextResponse.json({ theme: data?.preferred_theme || null }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['employee', 'director', 'hod', 'admin']);
    if (auth.response) return auth.response;

    const authenticatedUserId = getRequestUserId(request);
    const body = await request.json();
    const { userId, theme } = body;

    if (!userId || !theme) {
      return NextResponse.json({ error: 'userId and theme are required' }, { status: 400 });
    }

    if (theme !== 'light' && theme !== 'dark') {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
    }

    // Security check: user can only update their own theme unless they are admin
    if (authenticatedUserId !== userId && auth.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.users.update({
      where: { id: userId },
      data: { preferred_theme: theme as users_preferred_theme }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
