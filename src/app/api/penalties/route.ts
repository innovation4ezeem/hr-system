import { NextRequest, NextResponse } from 'next/server';
import {
  createPenaltyController,
  deletePenaltyController,
  getPenaltiesController,
  getPenaltyTypesController,
  updatePenaltyController,
} from '@/controllers/performanceManagementController';
import { requireRole } from '@/lib/apiAuth';
import { listUsers } from '@/models/userModel';

function getId(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return (searchParams.get('id') || '').trim();
}

function parseYear(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.trunc(parsed);
}


function normalizePenaltyTypeCode(raw?: string, category?: string) {
  const direct = String(raw || '').trim().toUpperCase();
  if (direct) return direct;

  const normalizedCategory = String(category || '').trim();
  const lower = normalizedCategory.toLowerCase();
  if (lower.includes('attendance')) return 'ABSENT_NO_LEAVE';
  if (lower.includes('policy') || lower.includes('conduct') || lower.includes('safety')) {
    return 'POLICY';
  }
  if (lower.includes('late')) return 'LATE';
  if (normalizedCategory) return normalizedCategory.toUpperCase().replace(/\s+/g, '_');
  return 'POLICY';
}

async function resolveEmployeeId(employeeId: unknown, employeeName: unknown) {
  const direct = String(employeeId || '').trim();
  if (direct) return direct;

  const name = String(employeeName || '').trim();
  if (!name) return '';

  const users = await listUsers();
  const found = users.find(item => item.name.toLowerCase() === name.toLowerCase());
  return found?.id || `emp-${name.toLowerCase().replace(/\s+/g, '-')}`;
}

function toLegacyRecord(row: any, penaltyTypeLookup?: Map<string, string>) {
  const year = Number(String(row.penaltyDate || '').slice(0, 4)) || new Date().getFullYear();

  // Resolve category display name from penaltyTypeCode
  const rawTypeCode = row.penaltyTypeCode || '';
  const category = penaltyTypeLookup?.get(rawTypeCode) || rawTypeCode || 'Unknown';

  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    dept: row.department,
    date: row.penaltyDate,
    year,
    mistake: row.reason,
    category,
    notes: row.notes || '',
    penaltyCategory: row.penaltyCategory || (Number(row.cashAmount || 0) > 0 ? 'cash' : 'standard'),
    points: row.points,
    attachment: row.attachment,
    linkedLeaveRequestId: row.linkedLeaveRequestId,
    cashAmount: row.cashAmount,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['employee', 'director', 'hod', 'admin', 'intern', 'probation']);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const year = parseYear(searchParams.get('year'));
    const employeeId = (searchParams.get('employeeId') || '').trim();
    const department = (searchParams.get('department') || '').trim() || undefined;

    // Load penalties and penalty types in parallel for fast category resolution
    const [penalties, penaltyTypes] = await Promise.all([
      getPenaltiesController({
        employeeId: employeeId || undefined,
        year,
        department,
      }),
      getPenaltyTypesController(),
    ]);

    // Build lookup: typeCode → typeName for display
    const penaltyTypeLookup = new Map<string, string>();
    if (Array.isArray(penaltyTypes)) {
      penaltyTypes.forEach((pt: any) => {
        if (pt.typeCode && pt.typeName) {
          penaltyTypeLookup.set(pt.typeCode, pt.typeName);
        }
      });
    }

    const records = penalties.map(p => toLegacyRecord(p, penaltyTypeLookup));
    return NextResponse.json({ records, penalties, penaltyTypes }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['director', 'hod', 'admin']);
    if (auth.response) return auth.response;

    const body = await request.json();
    const actor = String(body?.actor || auth.role || 'system');

    const employeeName = String(body?.employeeName || '').trim();
    const resolvedEmployeeId = await resolveEmployeeId(body?.employeeId, employeeName);

    const penaltyDate = String(body?.penaltyDate || body?.date || '').trim() || new Date().toISOString().slice(0, 10);
    const reason = String(body?.reason || body?.mistake || '').trim();

    if (!employeeName || !reason) {
      return NextResponse.json({ error: 'employeeName and reason are required' }, { status: 400 });
    }

    const penalty = await createPenaltyController({
      employeeId: resolvedEmployeeId,
      employeeName,
      department: String(body?.department || body?.dept || 'Operations').trim() || 'Operations',
      penaltyTypeCode: normalizePenaltyTypeCode(body?.penaltyTypeCode, body?.category),
      penaltyDate,
      reason,
      attachment: body?.attachment,
      status: (body?.status as any) || 'active',
      linkedLeaveRequestId: body?.linkedLeaveRequestId,
      penaltyCategory: body?.penaltyCategory || (Number(body?.cashAmount || 0) > 0 ? 'cash' : 'standard'),
      cashAmount: Number(body?.cashAmount || 0),
    }, actor);

    return NextResponse.json({ record: toLegacyRecord(penalty), penalty }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireRole(request, ['director', 'hod', 'admin']);
    if (auth.response) return auth.response;

    const id = getId(request);
    const body = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const employeeName = String(body?.employeeName || '').trim();
    const resolvedEmployeeId = await resolveEmployeeId(body?.employeeId, employeeName);

    const actor = String(body?.actor || auth.role || 'system');
    const patch: Record<string, unknown> = {};

    if (resolvedEmployeeId) patch.employeeId = resolvedEmployeeId;
    if (employeeName) patch.employeeName = employeeName;

    const department = String(body?.department || body?.dept || '').trim();
    if (department) patch.department = department;

    if (body?.penaltyTypeCode || body?.category) {
      patch.penaltyTypeCode = normalizePenaltyTypeCode(body?.penaltyTypeCode, body?.category);
    }

    if (body?.penaltyDate || body?.date) {
      patch.penaltyDate = body?.penaltyDate || body?.date;
    }



    if (body?.reason !== undefined || body?.mistake !== undefined) {
      patch.reason = String(body?.reason || body?.mistake || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(body || {}, 'attachment')) {
      patch.attachment = body?.attachment;
    }

    if (body?.penaltyCategory) {
      patch.penaltyCategory = body.penaltyCategory;
    }

    if (Object.prototype.hasOwnProperty.call(body || {}, 'linkedLeaveRequestId')) {
      patch.linkedLeaveRequestId = body?.linkedLeaveRequestId;
    }
    
    if (body?.cashAmount !== undefined) {
      patch.cashAmount = Number(body.cashAmount);
    }

    const penalty = await updatePenaltyController(id, patch as any, actor);
    if (!penalty) {
      return NextResponse.json({ error: 'Penalty not found' }, { status: 404 });
    }
    return NextResponse.json({ record: penalty ? toLegacyRecord(penalty) : null, penalty }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = requireRole(request, ['director', 'hod', 'admin']);
    if (auth.response) return auth.response;

    const id = getId(request);
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await deletePenaltyController(id, auth.role || 'system');
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
