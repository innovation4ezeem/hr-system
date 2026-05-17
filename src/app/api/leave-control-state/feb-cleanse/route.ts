import { NextRequest, NextResponse } from 'next/server';
import { runFebCleanseController } from '@/controllers/leaveControlController';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = Boolean(body?.force);
    const asOfDate = body?.asOfDate ? String(body.asOfDate) : undefined;
    const triggeredBy = body?.triggeredBy ? String(body.triggeredBy) : 'admin';

    const result = await runFebCleanseController({ force, asOfDate, triggeredBy });
    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
