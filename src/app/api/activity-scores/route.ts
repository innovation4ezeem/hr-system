import { NextRequest, NextResponse } from 'next/server';
import {
  createActivityScoreController,
  deleteActivityScoreController,
  getActivityMetaController,
  getActivityScoresController,
  updateActivityScoreController,
} from '@/controllers/activityScoreController';
import { listSystemAuditLogs } from '@/models/systemAuditLogModel';
import { getRequestUserId } from '@/lib/apiAuth';

function getId(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return (searchParams.get('id') || '').trim();
}

function parseYear(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return new Date().getFullYear();
  return Math.trunc(parsed);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseYear(searchParams.get('year'));
    const employeeId = (searchParams.get('employeeId') || '').trim();
    const employeeName = (searchParams.get('employeeName') || '').trim();
    const startDate = (searchParams.get('startDate') || '').trim();
    const endDate = (searchParams.get('endDate') || '').trim();
    const periodType = (searchParams.get('periodType') || '') as 'monthly' | 'quarterly' | 'yearly';
    const periodNoValue = searchParams.get('periodNo');
    const periodNo = periodNoValue ? parseInt(periodNoValue) : undefined;
    const withMeta = searchParams.get('meta') === '1';

    const entries = await getActivityScoresController({ 
      year, 
      employeeId, 
      employeeName, 
      startDate, 
      endDate,
      periodType: periodType || undefined,
      periodNo
    });

    
    const mode = searchParams.get('mode');
    if (mode === 'audit') {
      const recordId = searchParams.get('id');
      if (!recordId) return NextResponse.json({ error: 'Record id required' }, { status: 400 });
      
      const allLogs = await listSystemAuditLogs(100, 'performance-score');
      const filtered = allLogs.filter(log => {
        const payload = log.payload as any;
        return payload?.id === recordId;
      });
      return NextResponse.json({ logs: filtered }, { status: 200 });
    }

    if (!withMeta) {
      return NextResponse.json({ entries }, { status: 200 });
    }

    const meta = await getActivityMetaController();
    return NextResponse.json({ entries, meta }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if it's a batch creation (multiple employees selected in frontend)
    if (Array.isArray(body?.assignedToIds) && body.assignedToIds.length > 0) {
      const { createActivityScoresBatchController } = await import('@/controllers/activityScoreController');
      const entries = await createActivityScoresBatchController(body);
      return NextResponse.json({ entries }, { status: 201 });
    }

    const entry = await createActivityScoreController(body || {});
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const id = getId(request);
    const body = await request.json();
    const entry = await updateActivityScoreController(id, body || {});
    return NextResponse.json({ entry }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = getId(request);
    const { searchParams } = new URL(request.url);
    const year = parseYear(searchParams.get('year'));
    const actor = request.headers.get('x-user-name') || 'Admin';

    let ids: string[] = [];
    if (id) ids.push(id);

    try {
      const clone = request.clone();
      const body = await clone.json();
      if (Array.isArray(body?.ids)) {
        ids = body.ids;
      }
    } catch (e) {}

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    await deleteActivityScoreController(ids, year, actor);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
