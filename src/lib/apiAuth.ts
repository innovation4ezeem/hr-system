import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';

export type ApiRole = 'admin' | 'hod' | 'employee' | 'intern' | 'probation';

const VALID_ROLES: ApiRole[] = ['admin', 'hod', 'employee', 'intern', 'probation'];

function readIdentity(request: NextRequest, headers: string[], cookies: string[]) {
  for (const key of headers) {
    const value = (request.headers.get(key) || '').trim();
    if (value) {
      return value;
    }
  }

  for (const key of cookies) {
    const value = (request.cookies.get(key)?.value || '').trim();
    if (value) {
      return value;
    }
  }

  return null;
}

export function getRequestRole(request: NextRequest): ApiRole | null {
  const fromHeader = request.headers.get('x-user-role');
  if (fromHeader && VALID_ROLES.includes(fromHeader as ApiRole)) {
    return fromHeader as ApiRole;
  }

  const fromCookie = request.cookies.get('ezeem_role')?.value;
  if (fromCookie && VALID_ROLES.includes(fromCookie as ApiRole)) {
    return fromCookie as ApiRole;
  }

  return null;
}

export function getRequestUserId(request: NextRequest): string | null {
  return readIdentity(
    request,
    ['x-user-id', 'x-actor-id', 'x-userid'],
    ['ezeem_user_id', 'ezeem_userid', 'ezeem_user'],
  );
}

export function getRequestDepartment(request: NextRequest): string | null {
  return readIdentity(
    request,
    ['x-user-department', 'x-user-dept'],
    ['ezeem_department', 'ezeem_dept'],
  );
}

export function requireUserIdentity(request: NextRequest) {
  const userId = getRequestUserId(request);
  if (!userId) {
    return {
      userId: null,
      response: NextResponse.json({ error: 'Missing user identity' }, { status: 401 }),
    };
  }

  return {
    userId,
    response: null,
  };
}

export function resolveActorForMutation(
  request: NextRequest,
  role: ApiRole | null,
  actorFromPayload?: string,
  options?: { allowAdminImpersonation?: boolean },
) {
  const payloadActor = String(actorFromPayload || '').trim();
  const identity = getRequestUserId(request);

  if (role === 'admin' && options?.allowAdminImpersonation !== false) {
    return {
      actor: payloadActor || identity || 'admin',
      identityUserId: identity,
      response: null,
    };
  }

  if (!identity) {
    return {
      actor: '',
      identityUserId: null,
      response: NextResponse.json({ error: 'Missing user identity' }, { status: 401 }),
    };
  }

  if (payloadActor && payloadActor !== identity) {
    return {
      actor: '',
      identityUserId: identity,
      response: NextResponse.json({ error: 'Actor does not match authenticated user' }, { status: 403 }),
    };
  }

  return {
    actor: identity,
    identityUserId: identity,
    response: null,
  };
}

export function requireRole(request: NextRequest, allowed: ApiRole[]) {
  const role = getRequestRole(request);
  
  // Expand 'employee' to include 'intern' and 'probation' if needed
  const effectiveAllowed = [...allowed];
  if (allowed.includes('employee')) {
    if (!effectiveAllowed.includes('intern')) effectiveAllowed.push('intern');
    if (!effectiveAllowed.includes('probation')) effectiveAllowed.push('probation');
  }

  if (!role || !effectiveAllowed.includes(role)) {
    return {
      role,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return {
    role,
    response: null,
  };
}
