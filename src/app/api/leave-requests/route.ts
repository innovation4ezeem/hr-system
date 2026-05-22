import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import {
  bulkDecisionLeaveRequestsController,
  validateLeaveRequestController,
  submitLeaveRequestController,
  approveLeaveRequestController,
  rejectLeaveRequestController,
  getHodApprovalQueueController,
  getEmployeeLeaveHistoryController,
  getTeamLeaveHistoryController,
} from '@/controllers/leaveRequestController';
import { getRequestDepartment, getRequestUserId, requireRole, resolveActorForMutation } from '@/lib/apiAuth';
import {
  bulkDecisionSchema,
  historyQuerySchema,
  queueQuerySchema,
  submitLeaveRequestSchema,
  teamHistoryQuerySchema,
  toObject,
  validateLeaveRequestSchema,
} from '@/lib/validators/leaveSchemas';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'list';

    if (mode === 'queue') {
      const auth = requireRole(request, ['director', 'hod', 'admin']);
      if (auth.response) return auth.response;

      const parsed = queueQuerySchema.safeParse(toObject(searchParams));
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const payload = parsed.data;

      if (auth.role === 'hod') {
        const requesterId = getRequestUserId(request);
        if (!requesterId) {
          return NextResponse.json({ error: 'Missing user identity' }, { status: 401 });
        }
        if (payload.hodId !== requesterId && payload.hodId !== 'ALL') {
          return NextResponse.json({ error: 'hodId does not match authenticated user' }, { status: 403 });
        }
      }

      // HOD approval queue
      const requests = await getHodApprovalQueueController({
        hodId: payload.hodId,
        status: (payload.status as any) || 'all',
        leaveType: payload.leaveType as any,
        employmentType: payload.employmentType as any,
        dateRangeStart: payload.dateRangeStart,
        dateRangeEnd: payload.dateRangeEnd,
        employeeNameSearch: payload.employeeNameSearch,
        department: (payload.hodId === 'ALL' && auth.role !== 'admin') ? getRequestDepartment(request) : undefined,
      });

      return NextResponse.json({ requests }, { status: 200 });
    }

    if (mode === 'available-years') {
      const auth = requireRole(request, ['employee', 'director', 'hod', 'admin', 'intern', 'probation']);
      if (auth.response) return auth.response;

      const employeeId = searchParams.get('employeeId') || undefined;
      const { prisma } = await import('@/lib/prisma');
      
      // Get unique years from leave requests
      const yearsData = await prisma.leave_requests.findMany({
        where: { employee_id: employeeId || undefined },
        select: { start_date: true },
        distinct: ['start_date'],
      });

      const yearsSet = new Set<number>([new Date().getFullYear()]);
      yearsData.forEach(row => {
        if (row.start_date) {
          const year = parseInt(row.start_date.split('-')[0]);
          if (!isNaN(year)) yearsSet.add(year);
        }
      });

      return NextResponse.json({ years: Array.from(yearsSet).sort((a, b) => b - a) }, { status: 200 });
    }

    if (mode === 'history') {
      const auth = requireRole(request, ['employee', 'director', 'hod', 'admin', 'intern', 'probation']);
      if (auth.response) return auth.response;

      const parsed = historyQuerySchema.safeParse(toObject(searchParams));
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const payload = parsed.data;

      if (auth.role === 'employee') {
        const requesterId = getRequestUserId(request);
        if (!requesterId) {
          return NextResponse.json({ error: 'Missing user identity' }, { status: 401 });
        }
        if (payload.employeeId !== requesterId) {
          return NextResponse.json({ error: 'employeeId does not match authenticated user' }, { status: 403 });
        }
      }

      // Employee leave history
      const requests = await getEmployeeLeaveHistoryController({
        employeeId: payload.employeeId,
        year: payload.year,
        status: payload.status as any,
      });

      return NextResponse.json({ requests }, { status: 200 });
    }

    if (mode === 'team-history') {
      const auth = requireRole(request, ['director', 'hod', 'admin']);
      if (auth.response) return auth.response;

      const parsed = teamHistoryQuerySchema.safeParse(toObject(searchParams));
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

      const requests = await getTeamLeaveHistoryController({
        department: departmentScope,
        year: parsed.data.year,
        status: parsed.data.status as any,
        leaveType: parsed.data.leaveType,
        employmentType: parsed.data.employmentType as any,
        dateRangeStart: parsed.data.dateRangeStart,
        dateRangeEnd: parsed.data.dateRangeEnd,
        employeeNameSearch: parsed.data.employeeNameSearch,
      });

      return NextResponse.json({ requests }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('leave-requests GET error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['employee', 'director', 'hod', 'admin', 'intern', 'probation']);
    if (auth.response) return auth.response;

    const body = await request.json();
    const action = body?.action || 'submit';

    if (action === 'validate') {
      const parsed = validateLeaveRequestSchema.safeParse(body);
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

      const validation = await validateLeaveRequestController({
        employeeId: parsed.data.employeeId,
        leaveType: parsed.data.leaveType as any,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        session: parsed.data.session,
        fromHalf: parsed.data.fromHalf,
        toHalf: parsed.data.toHalf,
      });

      return NextResponse.json({ validation }, { status: 200 });
    }

    if (action === 'submit') {
      const parsed = submitLeaveRequestSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const payload = parsed.data;

      if (auth.role === 'employee') {
        const requesterId = getRequestUserId(request);
        if (!requesterId) {
          return NextResponse.json({ error: 'Missing user identity' }, { status: 401 });
        }
        if (payload.employeeId !== requesterId) {
          return NextResponse.json({ error: 'employeeId does not match authenticated user' }, { status: 403 });
        }
      }

      // Check if the requestor is the reporting officer (manager self-approval)
      const isManagerSubmittingOwnRequest = auth.role !== 'employee' && payload.reportingOfficer === payload.employeeId;

      const leaveRequest = await submitLeaveRequestController({
        employeeId: payload.employeeId,
        employeeName: payload.employeeName,
        dept: payload.dept,
        leaveType: payload.leaveType as any,
        employmentType: payload.employmentType as any,
        startDate: payload.startDate,
        endDate: payload.endDate,
        session: payload.session,
        units: payload.units || 1,
        reason: payload.reason,
        attachment: payload.attachment,
        reportingOfficer: payload.reportingOfficer,
        isManagerSubmittingOwnRequest,
        fromHalf: payload.fromHalf,
        toHalf: payload.toHalf,
      });

      return NextResponse.json({ request: leaveRequest }, { status: 201 });
    }

    if (action === 'bulk-decision') {
      const managerAuth = requireRole(request, ['director', 'hod', 'admin']);
      if (managerAuth.response) return managerAuth.response;

      const parsed = bulkDecisionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const actor = resolveActorForMutation(request, managerAuth.role, parsed.data.actor);
      if (actor.response) {
        return actor.response;
      }

      const result = await bulkDecisionLeaveRequestsController({
        actor: actor.actor,
        action: parsed.data.action,
        reason: parsed.data.reason,
        comment: parsed.data.comment,
        requestIds: parsed.data.requestIds,
      });

      return NextResponse.json({ results: result }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('leave-requests POST error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
