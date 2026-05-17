import { NextRequest, NextResponse } from 'next/server';
import { listSystemAuditLogs } from '@/models/systemAuditLogModel';
import { requireRole } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['admin']);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || '50');
    const module = searchParams.get('module') || undefined;

    const logs = await listSystemAuditLogs(limit, module);

    return NextResponse.json({ logs }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
