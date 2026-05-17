import { NextRequest, NextResponse } from 'next/server';
import {
  getArchiveRunsController,
  runYearEndArchiveController,
} from '@/controllers/yearEndArchiveController';

function parseYear(value: string | null) {
  const y = Number(value);
  if (!Number.isInteger(y)) return new Date().getFullYear();
  return y;
}

export async function GET() {
  try {
    const runs = await getArchiveRunsController();
    return NextResponse.json({ runs }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fromYear = parseYear(String(body?.fromYear || ''));
    const triggeredBy = String(body?.triggeredBy || 'admin');
    const clearActive = body?.clearActive === true;
    
    const result = await runYearEndArchiveController(fromYear, triggeredBy, { clearActive });
    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
