import { NextRequest, NextResponse } from 'next/server';
import { getRequestDepartment, getRequestUserId, requireRole, resolveActorForMutation, ApiRole } from '@/lib/apiAuth';
import {
  approvePerformanceScoreController,
  autoCalculatePerformancePeriodController,
  calculatePerformanceScoreController,
  createPenaltyController,
  getPenaltiesController,
  getPenaltyTypesController,
  getPerformanceActivitiesController,
  getPerformanceConfigController,

  getPerformanceReportController,
  getPerformanceScoresController,
  getPerformanceStandardMarksController,
  getPerformanceThresholdsController,
  getUnifiedEmployeeProfileController,
  overridePerformanceScoreController,
  savePerformanceConfigController,
  savePerformanceStandardMarksController,
  savePerformanceThresholdsController,
  syncEmployeeServiceYearsController,
  upsertEmployeeServiceYearController,
  upsertPenaltyTypeController,
  upsertPerformanceInputController,
  updatePenaltyController,
} from '@/controllers/performanceManagementController';
import {
  getPerformanceSheetController,
  savePerformanceSheetController,
} from '@/controllers/performanceScoreController';
import { listPerformanceYears } from '@/models/performanceScoreModel';
import {
  approveScoreActionSchema,
  autoCalculateActionSchema,
  calculateScoreActionSchema,
  createPenaltyActionSchema,
  getUnifiedProfileActionSchema,
  overrideScoreActionSchema,
  performanceConfigQuerySchema,
  performancePenaltiesQuerySchema,
  performancePenaltyTypesQuerySchema,
  performanceProfileQuerySchema,
  performanceReportQuerySchema,
  performanceScoresQuerySchema,
  performanceStandardMarksQuerySchema,
  saveStandardMarksActionSchema,
  saveThresholdsActionSchema,
  serviceYearsQuerySchema,
  syncServiceYearsActionSchema,
  toObject,
  updatePenaltyActionSchema,
  upsertConfigActionSchema,
  upsertInputActionSchema,
  upsertPenaltyTypeActionSchema,
  upsertServiceYearActionSchema,
} from '@/lib/validators/performanceManagementSchemas';
// XLSX and PDFKit moved to dynamic imports inside the handler to reduce cold-start time and memory usage


function mapErrorStatus(message: string) {
  const normalized = String(message || '').toLowerCase();
  if (normalized.includes('not found')) return 404;
  if (normalized.includes('must') || normalized.includes('cannot')) return 400;
  return 500;
}

function resolveEmployeeScope(request: NextRequest, role: ApiRole | null, employeeId?: string) {
  const requestedEmployeeId = String(employeeId || '').trim();
  if (role === 'admin' || role === 'hod') {
    return {
      employeeId: requestedEmployeeId || undefined,
      response: null,
    };
  }

  const identityUserId = getRequestUserId(request);
  if (!identityUserId) {
    return {
      employeeId: undefined,
      response: NextResponse.json({ error: 'Missing user identity' }, { status: 401 }),
    };
  }

  if (requestedEmployeeId && requestedEmployeeId !== identityUserId) {
    return {
      employeeId: undefined,
      response: NextResponse.json({ error: 'employeeId does not match authenticated user' }, { status: 403 }),
    };
  }

  return {
    employeeId: identityUserId,
    response: null,
  };
}

async function renderPdfBuffer(title: string, rows: any[]): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {

    const chunks: Buffer[] = [];
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 32, size: 'A4' });


    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(14).text(title, { underline: true });
    doc.moveDown(0.8);
    doc.fontSize(9);

    if (rows.length === 0) {
      doc.text('No data available.');
      doc.end();
      return;
    }

    rows.slice(0, 300).forEach((row, index) => {
      doc.text(`${index + 1}. ${JSON.stringify(row)}`);
      if (doc.y > 760) {
        doc.addPage();
      }
    });

    doc.end();
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'scores';

    if (mode === 'config') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;

      const parsed = performanceConfigQuerySchema.safeParse(toObject(searchParams));
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const config = await getPerformanceConfigController();
      return NextResponse.json({ config }, { status: 200 });
    }

    if (mode === 'scores') {
      const auth = requireRole(request, ['employee', 'hod', 'admin', 'intern', 'probation']);
      if (auth.response) return auth.response;

      const parsed = performanceScoresQuerySchema.safeParse(toObject(searchParams));
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const scope = resolveEmployeeScope(request, auth.role, parsed.data.employeeId);
      if (scope.response) {
        return scope.response;
      }

      let departmentScope = parsed.data.department;
      if (auth.role === 'hod') {
        const department = getRequestDepartment(request);
        if (!department) {
          return NextResponse.json({ error: 'Missing user department' }, { status: 401 });
        }
        if (departmentScope && departmentScope !== department) {
          return NextResponse.json({ error: 'Department scope mismatch' }, { status: 403 });
        }
        departmentScope = department;
      }

      const scores = await getPerformanceScoresController({
        employeeId: scope.employeeId,
        periodType: parsed.data.periodType,
        periodYear: parsed.data.periodYear,
        periodNo: parsed.data.periodNo,
        department: departmentScope,
        status: parsed.data.status || 'all',
      });

      return NextResponse.json({ scores }, { status: 200 });
    }

    if (mode === 'penalty-types') {
      const auth = requireRole(request, ['employee', 'hod', 'admin', 'intern', 'probation']);
      if (auth.response) return auth.response;

      const parsed = performancePenaltyTypesQuerySchema.safeParse(toObject(searchParams));
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const types = await getPenaltyTypesController(parsed.data.activeOnly !== 0);
      return NextResponse.json({ penaltyTypes: types }, { status: 200 });
    }

    if (mode === 'penalties') {
      const auth = requireRole(request, ['employee', 'hod', 'admin', 'intern', 'probation']);
      if (auth.response) return auth.response;

      const parsed = performancePenaltiesQuerySchema.safeParse(toObject(searchParams));
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const scope = resolveEmployeeScope(request, auth.role, parsed.data.employeeId);
      if (scope.response) {
        return scope.response;
      }

      let departmentScope = parsed.data.department;
      if (auth.role === 'hod') {
        const department = getRequestDepartment(request);
        if (!department) {
          return NextResponse.json({ error: 'Missing user department' }, { status: 401 });
        }
        if (departmentScope && departmentScope !== department) {
          return NextResponse.json({ error: 'Department scope mismatch' }, { status: 403 });
        }
        departmentScope = department;
      }

      const penalties = await getPenaltiesController({
        employeeId: scope.employeeId,
        year: parsed.data.year,
        department: departmentScope,
        penaltyTypeCode: parsed.data.penaltyTypeCode,
      });
      return NextResponse.json({ penalties }, { status: 200 });
    }

    if (mode === 'report') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;

      const parsed = performanceReportQuerySchema.safeParse(toObject(searchParams));
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      let departmentScope = parsed.data.department;
      if (auth.role === 'hod') {
        const department = getRequestDepartment(request);
        if (!department) {
          return NextResponse.json({ error: 'Missing user department' }, { status: 401 });
        }
        if (departmentScope && departmentScope !== department) {
          return NextResponse.json({ error: 'Department scope mismatch' }, { status: 403 });
        }
        departmentScope = department;
      }

      const report = await getPerformanceReportController({
        reportMode: parsed.data.reportMode,
        year: parsed.data.year || new Date().getFullYear(),
        periodType: parsed.data.periodType,
        periodNo: parsed.data.periodNo,
        department: departmentScope,
        employeeId: parsed.data.employeeId,
        actor: getRequestUserId(request) || auth.role || 'system',
      });

      const exportFormat = (searchParams.get('export') || '').toLowerCase();
      if (exportFormat === 'excel') {
        const rows = Array.isArray(report) ? report : [report];
        const XLSX = await import('xlsx');
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'report');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;


        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${parsed.data.reportMode}-${parsed.data.year || new Date().getFullYear()}.xlsx"`,
          },
        });
      }

      if (exportFormat === 'pdf') {
        const rows = Array.isArray(report) ? report : [report];
        const pdfBuffer = await renderPdfBuffer(`Performance Report: ${parsed.data.reportMode}`, rows);
        return new NextResponse(new Uint8Array(pdfBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${parsed.data.reportMode}-${parsed.data.year || new Date().getFullYear()}.pdf"`,
          },
        });
      }

      return NextResponse.json({ report }, { status: 200 });
    }

    if (mode === 'profile') {
      const auth = requireRole(request, ['employee', 'hod', 'admin', 'intern', 'probation']);
      if (auth.response) return auth.response;

      const parsed = performanceProfileQuerySchema.safeParse(toObject(searchParams));
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const scope = resolveEmployeeScope(request, auth.role, parsed.data.employeeId);
      if (scope.response) {
        return scope.response;
      }

      const profile = await getUnifiedEmployeeProfileController({
        employeeId: scope.employeeId || parsed.data.employeeId,
        year: parsed.data.year || new Date().getFullYear(),
        periodType: parsed.data.periodType,
        actor: getRequestUserId(request) || auth.role || 'system',
      });

      return NextResponse.json({ profile }, { status: 200 });
    }

    if (mode === 'activities') {
      const auth = requireRole(request, ['employee', 'hod', 'admin', 'intern', 'probation']);
      if (auth.response) return auth.response;

      const employeeId = searchParams.get('employeeId');
      if (!employeeId) {
        return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
      }

      const scope = resolveEmployeeScope(request, auth.role, employeeId);
      if (scope.response) return scope.response;

      const pillar = (searchParams.get('pillar') as any) || 'All';
      const yearStr = searchParams.get('year');
      const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();

      const activities = await getPerformanceActivitiesController({
        employeeId: scope.employeeId || employeeId,
        pillar,
        year: isNaN(year) ? undefined : year,
      });

      return NextResponse.json({ activities }, { status: 200 });
    }

    if (mode === 'service-years') {

      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;

      const parsed = serviceYearsQuerySchema.safeParse(toObject(searchParams));
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const rows = await syncEmployeeServiceYearsController(parsed.data.employeeId, getRequestUserId(request) || auth.role || 'system');
      return NextResponse.json({ serviceYears: rows }, { status: 200 });
    }

    if (mode === 'thresholds') {
      const thresholds = await getPerformanceThresholdsController();
      return NextResponse.json({ thresholds }, { status: 200 });
    }

    if (mode === 'years') {
      const years = await listPerformanceYears();
      return NextResponse.json({ years }, { status: 200 });
    }

    if (mode === 'standard-marks') {
      const data = await getPerformanceStandardMarksController();
      return NextResponse.json(data, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: mapErrorStatus(message) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body?.action;

    if (action === 'upsert-config') {
      const auth = requireRole(request, ['admin']);
      if (auth.response) return auth.response;

      const parsed = upsertConfigActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const actor = resolveActorForMutation(request, auth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const config = await savePerformanceConfigController(parsed.data.config as any, actor.actor);
      return NextResponse.json({ config }, { status: 200 });
    }

    if (action === 'upsert-input') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;

      const parsed = upsertInputActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const actor = resolveActorForMutation(request, auth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const input = await upsertPerformanceInputController({
        ...parsed.data,
        actor: actor.actor,
      });
      return NextResponse.json({ input }, { status: 200 });
    }

    if (action === 'calculate-score') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;

      const parsed = calculateScoreActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const actor = resolveActorForMutation(request, auth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const score = await calculatePerformanceScoreController({
        ...parsed.data,
        actor: actor.actor,
      });
      return NextResponse.json({ score }, { status: 200 });
    }

    if (action === 'auto-calculate-period') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;

      const parsed = autoCalculateActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const actor = resolveActorForMutation(request, auth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const results = await autoCalculatePerformancePeriodController({
        ...parsed.data,
        actor: actor.actor,
      });
      return NextResponse.json({ results }, { status: 200 });
    }

    if (action === 'approve-score') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;

      const parsed = approveScoreActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const actor = resolveActorForMutation(request, auth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const score = await approvePerformanceScoreController({
        employeeId: parsed.data.employeeId,
        periodType: parsed.data.periodType,
        periodYear: parsed.data.periodYear,
        periodNo: parsed.data.periodNo,
        actor: actor.actor,
      });

      return NextResponse.json({ score }, { status: 200 });
    }

    if (action === 'override-score') {
      const auth = requireRole(request, ['admin']);
      if (auth.response) return auth.response;

      const parsed = overrideScoreActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const actor = resolveActorForMutation(request, auth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const score = await overridePerformanceScoreController({
        ...parsed.data,
        actor: actor.actor,
      });
      return NextResponse.json({ score }, { status: 200 });
    }

    if (action === 'create-penalty') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;

      const parsed = createPenaltyActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const actor = resolveActorForMutation(request, auth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const penalty = await createPenaltyController({
        employeeId: parsed.data.employeeId,
        employeeName: parsed.data.employeeName,
        department: parsed.data.department,
        penaltyTypeCode: parsed.data.penaltyTypeCode,
        penaltyDate: parsed.data.penaltyDate,
        reason: parsed.data.reason,
        status: 'active',
        attachment: parsed.data.attachment || '',
        linkedLeaveRequestId: parsed.data.linkedLeaveRequestId || '',
      }, actor.actor);

      return NextResponse.json({ penalty }, { status: 201 });
    }

    if (action === 'update-penalty') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;

      const parsed = updatePenaltyActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const actor = resolveActorForMutation(request, auth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const penalty = await updatePenaltyController(parsed.data.id, parsed.data.patch as any, actor.actor);
      if (!penalty) {
        return NextResponse.json({ error: 'Penalty not found' }, { status: 404 });
      }
      return NextResponse.json({ penalty });
    }

    if (action === 'upsert-penalty-type') {
      const auth = requireRole(request, ['admin']);
      if (auth.response) return auth.response;

      const parsed = upsertPenaltyTypeActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const actor = resolveActorForMutation(request, auth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const payload = await upsertPenaltyTypeController(parsed.data.payload, actor.actor);
      return NextResponse.json({ penaltyType: payload }, { status: 200 });
    }

    if (action === 'sync-service-years') {
      const auth = requireRole(request, ['admin']);
      if (auth.response) return auth.response;

      const parsed = syncServiceYearsActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const actor = resolveActorForMutation(request, auth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const rows = await syncEmployeeServiceYearsController(parsed.data.employeeId, actor.actor || auth.role || 'system');
      return NextResponse.json({ serviceYears: rows }, { status: 200 });
    }

    if (action === 'upsert-service-year') {
      const auth = requireRole(request, ['admin']);
      if (auth.response) return auth.response;

      const parsed = upsertServiceYearActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const actor = resolveActorForMutation(request, auth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const record = await upsertEmployeeServiceYearController(parsed.data.payload, actor.actor);
      return NextResponse.json({ serviceYear: record }, { status: 200 });
    }

    if (action === 'get-profile') {
      const auth = requireRole(request, ['employee', 'hod', 'admin', 'intern', 'probation']);
      if (auth.response) return auth.response;

      const parsed = getUnifiedProfileActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const scope = resolveEmployeeScope(request, auth.role, parsed.data.employeeId);
      if (scope.response) {
        return scope.response;
      }

      const actor = resolveActorForMutation(request, auth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const profile = await getUnifiedEmployeeProfileController({
        employeeId: scope.employeeId || parsed.data.employeeId,
        year: parsed.data.year || new Date().getFullYear(),
        periodType: parsed.data.periodType,
        actor: actor.actor || auth.role || 'system',
      });

      return NextResponse.json({ profile }, { status: 200 });
    }

    if (action === 'save-thresholds') {
      const auth = requireRole(request, ['admin']);
      if (auth.response) return auth.response;

      const parsed = saveThresholdsActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const actor = resolveActorForMutation(request, auth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const thresholds = await savePerformanceThresholdsController(parsed.data.thresholds, actor.actor);
      return NextResponse.json({ thresholds }, { status: 200 });
    }

    if (action === 'save-standard-marks') {
      const auth = requireRole(request, ['admin']);
      if (auth.response) return auth.response;

      const parsed = saveStandardMarksActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const actor = resolveActorForMutation(request, auth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const marks = await savePerformanceStandardMarksController({
        marks: parsed.data.marks,
        bucketCategories: parsed.data.bucketCategories || {}
      }, actor.actor);
      return NextResponse.json({ standardMarks: marks }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: mapErrorStatus(message) });
  }
}
