import { NextRequest, NextResponse } from 'next/server';
import {
  createUserController,
  deleteUserController,
  getUsersController,
  updateUserController,
} from '@/controllers/userController';
import { getRequestDepartment, getRequestUserId, requireRole } from '@/lib/apiAuth';

function getId(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return (searchParams.get('id') || '').trim();
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['hod', 'admin']);
    if (auth.response) return auth.response;

    const users = await getUsersController();

    if (auth.role === 'hod') {
      const department = getRequestDepartment(request);
      if (!department) {
        return NextResponse.json({ error: 'Missing user department' }, { status: 401 });
      }

      const scopedUsers = users.filter(user => user.dept === department);
      return NextResponse.json({ users: scopedUsers }, { status: 200 });
    }

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['admin']);
    if (auth.response) return auth.response;

    const body = await request.json();
    const actor = getRequestUserId(request) || auth.role || 'system';
    const silentMode = request.headers.get('x-silent-mode') === 'true';
    
    const user = await createUserController({ ...(body || {}), sendNotification: silentMode ? false : body?.sendNotification }, actor);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireRole(request, ['admin']);
    if (auth.response) return auth.response;

    const id = getId(request);
    const body = await request.json();
    const actor = getRequestUserId(request) || auth.role || 'system';
    const silentMode = request.headers.get('x-silent-mode') === 'true';
    const user = await updateUserController(id, { ...(body || {}), sendNotification: silentMode ? false : body?.sendNotification }, actor);
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = requireRole(request, ['admin']);
    if (auth.response) return auth.response;

    const id = getId(request);
    const actor = getRequestUserId(request) || auth.role || 'system';

    await deleteUserController(id, actor);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
