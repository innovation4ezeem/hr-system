import { NextRequest, NextResponse } from 'next/server';
import { getSystemAuditLogsController } from '@/controllers/systemAuditLogController';

function parseLimit(value: string | null) {
  const n = Number(value);
  if (!Number.isInteger(n)) return 50;
  return Math.max(1, Math.min(200, n));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const eventType = (searchParams.get('eventType') || '').trim() || undefined;
    const logs = await getSystemAuditLogsController(limit, eventType);
    return NextResponse.json({ logs }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const logIdStr = searchParams.get('logId');
    const clearAll = searchParams.get('clearAll') === 'true';

    const { deleteSystemAuditLogController, clearAllSystemAuditLogsController } = await import('@/controllers/systemAuditLogController');

    if (clearAll) {
      await clearAllSystemAuditLogsController();
      return NextResponse.json({ success: true, message: 'All logs cleared' }, { status: 200 });
    }

    if (logIdStr) {
      await deleteSystemAuditLogController(Number(logIdStr));
      return NextResponse.json({ success: true, message: 'Log deleted' }, { status: 200 });
    }

    return NextResponse.json({ error: 'Missing logId or clearAll parameter' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
