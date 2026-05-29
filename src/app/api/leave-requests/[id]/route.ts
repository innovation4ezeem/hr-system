import { NextRequest, NextResponse } from 'next/server';
import {
  approveLeaveRequestController,
  cancelLeaveRequestController,
  rejectLeaveRequestController,
  inquireLeaveRequestController,
  respondToInquiryController,
} from '@/controllers/leaveRequestController';
import { getRequestUserId, requireRole, resolveActorForMutation } from '@/lib/apiAuth';
import { requestActionSchema } from '@/lib/validators/leaveSchemas';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestId } = await params;
    const body = await request.json();
    const parsed = requestActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const action = parsed.data.action;
    const actor = parsed.data.actor;

    if (!actor) {
      return NextResponse.json({ error: 'actor is required' }, { status: 400 });
    }

    let updatedRequest: any = null;

    if (action === 'approve') {
      const auth = requireRole(request, ['director', 'hod', 'admin']);
      if (auth.response) return auth.response;
      const resolvedActor = resolveActorForMutation(request, auth.role, actor);
      if (resolvedActor.response) return resolvedActor.response;
      updatedRequest = await approveLeaveRequestController(requestId, resolvedActor.actor, parsed.data.comment);
    } else if (action === 'reject') {
      const auth = requireRole(request, ['director', 'hod', 'admin']);
      if (auth.response) return auth.response;
      const resolvedActor = resolveActorForMutation(request, auth.role, actor);
      if (resolvedActor.response) return resolvedActor.response;
      const reason = parsed.data.reason || 'No reason provided';
      updatedRequest = await rejectLeaveRequestController(requestId, resolvedActor.actor, reason, parsed.data.comment);
    } else if (action === 'inquire') {
      const auth = requireRole(request, ['director', 'hod', 'admin']);
      if (auth.response) return auth.response;
      const resolvedActor = resolveActorForMutation(request, auth.role, actor);
      if (resolvedActor.response) return resolvedActor.response;
      const question = parsed.data.reason || body?.question || '';
      updatedRequest = await inquireLeaveRequestController(requestId, resolvedActor.actor, question);
    } else if (action === 'respond-to-inquiry') {
      const auth = requireRole(request, ['employee', 'director', 'hod', 'admin']);
      if (auth.response) return auth.response;
      const requesterId = getRequestUserId(request);
      if (!requesterId) return NextResponse.json({ error: 'Missing user identity' }, { status: 401 });
      const response = parsed.data.reason || body?.response || '';
      updatedRequest = await respondToInquiryController(requestId, requesterId, response);
    } else if (action === 'cancel') {
      const auth = requireRole(request, ['employee', 'director', 'hod', 'admin']);
      if (auth.response) return auth.response;
      const resolvedActor = resolveActorForMutation(request, auth.role, actor);
      if (resolvedActor.response) return resolvedActor.response;
      const reason = parsed.data.reason || 'Cancelled by employee';
      updatedRequest = await cancelLeaveRequestController(requestId, resolvedActor.actor, reason);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (updatedRequest) {
      const { enrichLeaveRequestsWithCarryForward } = await import('@/models/leaveRequestModel');
      const enriched = await enrichLeaveRequestsWithCarryForward([updatedRequest]);
      return NextResponse.json({ request: enriched[0] }, { status: 200 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
