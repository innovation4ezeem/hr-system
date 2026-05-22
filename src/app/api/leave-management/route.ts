import { NextRequest, NextResponse } from 'next/server';
import {
  getLeaveReports,
  deleteLeaveEntitlementOverride,
  clearAllLeaveEntitlementOverrides,
  listEligibleLeaveTypes,
  listLeaveEntitlementOverrides,
  listHolidays,
  listLeaveBalances,
  listLeaveTypes,
  listTeamLeaveCalendar,
  listWorkflowConfigs,
  seedDefaultLeaveSetup,
  softDeleteHoliday,
  softDeleteLeaveType,
  softDeleteWorkflowConfig,
  upsertHoliday,
  upsertLeaveEntitlementOverride,
  upsertLeaveType,
  upsertWorkflowConfig,
  listLeaveRequestStatuses,
} from '@/models/leaveManagementModel';
import { insertSystemAuditLog } from '@/models/systemAuditLogModel';
import { getRequestDepartment, getRequestUserId, requireRole } from '@/lib/apiAuth';
import {
  balancesQuerySchema,
  calendarQuerySchema,
  leaveEntitlementOverrideSchema,
  eligibleLeaveTypesQuerySchema,
  holidayUpsertSchema,
  leaveTypeUpsertSchema,
  reportQuerySchema,
  toObject,
  workflowUpsertSchema,
} from '@/lib/validators/leaveSchemas';

export async function GET(request: NextRequest) {
  console.log('--- API GET leave-management start ---');
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'eligible-types';

    if (mode === 'ping') {
      return NextResponse.json({ pong: true }, { status: 200 });
    }

    if (mode === 'leave-types') {
      const auth = requireRole(request, ['employee', 'director', 'hod', 'admin', 'intern', 'probation']);
      if (auth.response) return auth.response;

      const includeInactive = searchParams.get('includeInactive') === '1';
      const leaveTypes = await listLeaveTypes(!includeInactive);
      return NextResponse.json({ leaveTypes }, { status: 200 });
    }

    if (mode === 'eligible-types') {
      const auth = requireRole(request, ['employee', 'director', 'hod', 'admin', 'intern', 'probation']);
      if (auth.response) return auth.response;

      const parsed = eligibleLeaveTypesQuerySchema.safeParse(toObject(searchParams));
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      if (auth.role === 'employee') {
        const requesterId = getRequestUserId(request);
        if (!requesterId) {
          return NextResponse.json({ error: 'Missing user identity' }, { status: 401 });
        }
        if (parsed.data.employeeId !== requesterId) {
          return NextResponse.json({ error: 'employeeId does not match authenticated user' }, { status: 403 });
        }
      }

      const year = parsed.data.year || new Date().getFullYear();
      const leaveTypes = await listEligibleLeaveTypes(parsed.data.employeeId, year);
      return NextResponse.json({ leaveTypes, year }, { status: 200 });
    }

    if (mode === 'balances') {
      const auth = requireRole(request, ['employee', 'director', 'hod', 'admin', 'intern', 'probation']);
      if (auth.response) return auth.response;

      const parsed = balancesQuerySchema.safeParse(toObject(searchParams));
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      if (auth.role === 'employee') {
        const requesterId = getRequestUserId(request);
        if (!requesterId) {
          return NextResponse.json({ error: 'Missing user identity' }, { status: 401 });
        }
        if (parsed.data.employeeId !== requesterId) {
          return NextResponse.json({ error: 'employeeId does not match authenticated user' }, { status: 403 });
        }
      }

      const year = parsed.data.year || new Date().getFullYear();
      const balances = await listLeaveBalances(parsed.data.employeeId, year);
      return NextResponse.json({ balances, year }, { status: 200 });
    }

    if (mode === 'batch-balances') {
      const auth = requireRole(request, ['director', 'hod', 'admin']);
      if (auth.response) return auth.response;

      const year = Number(searchParams.get('year') || new Date().getFullYear());
      const { listAllTeamBalances } = await import('@/models/leaveManagementModel');
      const balances = await listAllTeamBalances(year);
      return NextResponse.json({ balances, year }, { status: 200 });
    }

    if (mode === 'entitlement-overrides') {
      const auth = requireRole(request, ['admin']);
      if (auth.response) return auth.response;

      const employeeId = searchParams.get('employeeId') || undefined;
      const yearParam = searchParams.get('year');
      const year = yearParam ? Number(yearParam) : undefined;
      const overrides = await listLeaveEntitlementOverrides(employeeId, Number.isFinite(year) ? year : undefined);
      return NextResponse.json({ overrides }, { status: 200 });
    }

    if (mode === 'workflows') {
      const auth = requireRole(request, ['director', 'hod', 'admin']);
      if (auth.response) return auth.response;

      const workflows = await listWorkflowConfigs();
      return NextResponse.json({ workflows }, { status: 200 });
    }

    if (mode === 'holidays') {
      const auth = requireRole(request, ['employee', 'director', 'hod', 'admin', 'intern', 'probation']);
      if (auth.response) return auth.response;

      const yearParam = searchParams.get('year');
      const year = yearParam ? Number(yearParam) : undefined;
      const region = searchParams.get('region') || 'DEFAULT';
      const holidays = await listHolidays(year, region);
      return NextResponse.json({ holidays }, { status: 200 });
    }

    if (mode === 'calendar') {
      const auth = requireRole(request, ['employee', 'director', 'hod', 'admin', 'intern', 'probation']);
      if (auth.response) return auth.response;

      const parsed = calendarQuerySchema.safeParse(toObject(searchParams));
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const calendar = await listTeamLeaveCalendar({
        month: parsed.data.month,
        department: parsed.data.department,
      });
      return NextResponse.json({ calendar }, { status: 200 });
    }

    if (mode === 'reports') {
      const auth = requireRole(request, ['director', 'hod', 'admin']);
      if (auth.response) return auth.response;

      const parsed = reportQuerySchema.safeParse({
        ...toObject(searchParams),
        reportMode: searchParams.get('reportMode') || 'monthly',
      });
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      if (auth.role === 'hod') {
        const department = getRequestDepartment(request);
        if (!department) {
          return NextResponse.json({ error: 'Missing user department' }, { status: 401 });
        }
        if (parsed.data.department && parsed.data.department !== department) {
          return NextResponse.json({ error: 'Department scope mismatch' }, { status: 403 });
        }
      }

      const departmentScope = auth.role === 'hod'
        ? getRequestDepartment(request) || undefined
        : parsed.data.department;

      const report = await getLeaveReports(parsed.data.reportMode, {
        year: parsed.data.year,
        month: parsed.data.month,
        department: departmentScope,
        employeeId: parsed.data.employeeId,
      });
      return NextResponse.json({ report }, { status: 200 });
    }

    if (mode === 'statuses') {
      const auth = requireRole(request, ['director', 'hod', 'admin']);
      if (auth.response) return auth.response;
      
      const statuses = await listLeaveRequestStatuses();
      return NextResponse.json({ statuses }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('API ERROR [leave-management GET]:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['admin']);
    if (auth.response) return auth.response;

    const body = await request.json();
    const action = body?.action;

    if (action === 'upsert-leave-type') {
      const parsed = leaveTypeUpsertSchema.safeParse(body?.payload);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      await upsertLeaveType(parsed.data);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === 'delete-leave-type') {
      const code = body?.code as string | undefined;
      if (!code) {
        return NextResponse.json({ error: 'code is required' }, { status: 400 });
      }
      await softDeleteLeaveType(code);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === 'upsert-workflow') {
      const parsed = workflowUpsertSchema.safeParse(body?.payload);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      await upsertWorkflowConfig({
        id: parsed.data.id || `WF-${Date.now()}`,
        departmentId: parsed.data.departmentId,
        leaveTypeCode: parsed.data.leaveTypeCode,
        levelCount: parsed.data.levelCount,
        hrApproverId: parsed.data.hrApproverId,
        active: parsed.data.active,
      });
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === 'delete-workflow') {
      const id = body?.id as string | undefined;
      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }
      await softDeleteWorkflowConfig(id);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === 'upsert-holiday') {
      const parsed = holidayUpsertSchema.safeParse(body?.payload);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      await upsertHoliday({
        id: parsed.data.id || `HOL-${Date.now()}`,
        holidayDate: parsed.data.holidayDate,
        name: parsed.data.name,
        region: parsed.data.region,
        optional: parsed.data.optional,
      });
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === 'delete-holiday') {
      const id = body?.id as string | undefined;
      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }
      await softDeleteHoliday(id);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === 'upsert-entitlement-override') {
      const parsed = leaveEntitlementOverrideSchema.safeParse(body?.payload);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      await upsertLeaveEntitlementOverride({
        employeeId: parsed.data.employeeId,
        leaveTypeCode: parsed.data.leaveTypeCode,
        year: parsed.data.year,
        overrideDays: parsed.data.overrideDays,
        overrideReason: parsed.data.overrideReason,
        overriddenBy: parsed.data.overriddenBy || auth.role,
      });

      await insertSystemAuditLog('manual-override', 'LEAVE_ENTITLEMENT_OVERRIDE', parsed.data.overriddenBy || auth.role, {
        employeeId: parsed.data.employeeId,
        leaveTypeCode: parsed.data.leaveTypeCode,
        year: parsed.data.year,
        overrideDays: parsed.data.overrideDays,
        overrideReason: parsed.data.overrideReason,
      });

      // Notify Employee
      try {
        const { listUsers } = await import('@/models/userModel');
        const users = await listUsers();
        const employee = users.find(u => u.id === parsed.data.employeeId);
        const { HRNotificationService } = await import('@/lib/notifications/hrNotificationService');
        await HRNotificationService.notifyLeaveBalanceUpdate({
          employeeId: parsed.data.employeeId,
          employeeName: employee?.name || 'Employee',
          leaveType: parsed.data.leaveTypeCode,
          newBalance: parsed.data.overrideDays,
          year: parsed.data.year,
          actorName: parsed.data.overriddenBy || auth.role,
        });
      } catch (notifError) {
        console.error('Failed to send balance update notification:', notifError);
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === 'batch-upsert-entitlement-overrides') {
      const payload = body?.payload as any[];
      if (!Array.isArray(payload)) {
        return NextResponse.json({ error: 'payload must be an array' }, { status: 400 });
      }

      const { upsertManyLeaveEntitlementOverrides } = await import('@/models/leaveManagementModel');
      await upsertManyLeaveEntitlementOverrides(payload);

      await insertSystemAuditLog('manual-override', 'LEAVE_ENTITLEMENT_OVERRIDE', auth.role, {
        count: payload.length,
        employeeId: payload[0]?.employeeId,
        year: payload[0]?.year,
      });

      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === 'delete-entitlement-override') {
      const employeeId = String(body?.employeeId || '').trim();
      const leaveTypeCode = String(body?.leaveTypeCode || '').trim() as 'AL' | 'SL' | 'WFH' | 'REWARD';
      const year = Number(body?.year);

      if (!employeeId || !leaveTypeCode || !Number.isInteger(year)) {
        return NextResponse.json({ error: 'employeeId, leaveTypeCode and year are required' }, { status: 400 });
      }

      await deleteLeaveEntitlementOverride(employeeId, leaveTypeCode, year);
      await insertSystemAuditLog('manual-override', 'LEAVE_ENTITLEMENT_OVERRIDE_DELETE', auth.role, {
        employeeId,
        leaveTypeCode,
        year,
      });

      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === 'clear-all-overrides') {
      const year = body?.year || new Date().getFullYear();
      await clearAllLeaveEntitlementOverrides(year);
      await insertSystemAuditLog('manual-override', 'LEAVE_ENTITLEMENT_CLEAR_ALL', auth.role, {
        year,
        actor: getRequestUserId(request) || auth.role
      });
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === 'resync-all-balances') {
      console.log('API POST: Starting resyncAllEmployeeBalances...');
      const { resyncAllEmployeeBalances } = await import('@/models/leaveManagementModel');
      await resyncAllEmployeeBalances();
      console.log('API POST: resyncAllEmployeeBalances completed successfully.');
      
      await insertSystemAuditLog('system-maintenance', 'RESYNC_ALL_LEAVE_BALANCES', auth.role, {
        actor: getRequestUserId(request) || auth.role
      });

      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
