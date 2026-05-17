import { NextRequest, NextResponse } from 'next/server';
import { runFebCleanseController } from '@/controllers/leaveControlController';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const asOfDate = body?.asOfDate ? String(body.asOfDate) : undefined;

    const result = await runFebCleanseController({
      force: false,
      asOfDate,
      triggeredBy: 'system-scheduler',
    });

    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await runFebCleanseController({ force: false, triggeredBy: 'system-scheduler' });
    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
