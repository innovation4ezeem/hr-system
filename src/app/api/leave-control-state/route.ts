import { NextRequest, NextResponse } from 'next/server';
import {
  getLeaveControlStateController,
  saveLeaveControlStateController,
} from '@/controllers/leaveControlController';

export async function GET() {
  try {
    const state = await getLeaveControlStateController();
    return NextResponse.json({ state }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || typeof body.state !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    await saveLeaveControlStateController(body.state as Record<string, unknown>);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const { runFebCleanseController } = await import('@/controllers/leaveControlController');
    const body = await request.json();
    const result = await runFebCleanseController({
      force: body?.force === true,
      asOfDate: body?.asOfDate,
      triggeredBy: body?.triggeredBy || 'admin',
    });
    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
