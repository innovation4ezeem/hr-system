import { NextRequest, NextResponse } from 'next/server';
import {
  getPerformanceSheetController,
  savePerformanceSheetController,
} from '@/controllers/performanceScoreController';
import { 
  syncActivitiesIntoPerformanceSheet, 
  syncSheetIntoActivities, 
  cleanupSystemAdjustments 
} from '@/controllers/activityScoreController';
import { assertWritableYear } from '@/lib/archivePolicy';

function parseYear(value: string | null) {
  const year = Number(value);
  if (!Number.isFinite(year)) return new Date().getFullYear();
  return Math.trunc(year);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseYear(searchParams.get('year'));
    const employeesRaw = searchParams.get('employees') || '';
    const employeeIds = employeesRaw
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    const sync = searchParams.get('sync') === '1';

    if (sync) {
      await cleanupSystemAdjustments(year);
      await syncActivitiesIntoPerformanceSheet(year);
    }

    const data = await getPerformanceSheetController(year, employeeIds);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const year = parseYear(String(body?.year || ''));
    const sheet = body?.sheet;
    console.log(`[API] Saving performance sheet for year ${year}. Employees in payload: ${Object.keys(sheet?.cellsByEmployee || {}).length}`);

    if (!sheet || !Array.isArray(sheet.columns) || !Array.isArray(sheet.sections) || typeof sheet.cellsByEmployee !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    assertWritableYear(year);

    await savePerformanceSheetController(year, sheet);
    // Enforce Activities List as Master: worksheet cells will be overwritten by activity sums
    await syncActivitiesIntoPerformanceSheet(year);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
