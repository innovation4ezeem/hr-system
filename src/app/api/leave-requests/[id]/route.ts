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

    if (action === 'approve') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;
      const resolvedActor = resolveActorForMutation(request, auth.role, actor);
      if (resolvedActor.response) return resolvedActor.response;
      const updatedRequest = await approveLeaveRequestController(requestId, resolvedActor.actor, parsed.data.comment);
      return NextResponse.json({ request: updatedRequest }, { status: 200 });
    }

    if (action === 'reject') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;
      const resolvedActor = resolveActorForMutation(request, auth.role, actor);
      if (resolvedActor.response) return resolvedActor.response;
      const reason = parsed.data.reason || 'No reason provided';
      const updatedRequest = await rejectLeaveRequestController(requestId, resolvedActor.actor, reason, parsed.data.comment);
      return NextResponse.json({ request: updatedRequest }, { status: 200 });
    }

    if (action === 'inquire') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;
      const resolvedActor = resolveActorForMutation(request, auth.role, actor);
      if (resolvedActor.response) return resolvedActor.response;
      const question = parsed.data.reason || body?.question || '';
      const updatedRequest = await inquireLeaveRequestController(requestId, resolvedActor.actor, question);
      return NextResponse.json({ request: updatedRequest }, { status: 200 });
    }

    if (action === 'respond-to-inquiry') {
      const auth = requireRole(request, ['employee', 'hod', 'admin']);
      if (auth.response) return auth.response;
      const requesterId = getRequestUserId(request);
      if (!requesterId) return NextResponse.json({ error: 'Missing user identity' }, { status: 401 });
      const response = parsed.data.reason || body?.response || '';
      const updatedRequest = await respondToInquiryController(requestId, requesterId, response);
      return NextResponse.json({ request: updatedRequest }, { status: 200 });
    }

    if (action === 'cancel') {
      const auth = requireRole(request, ['employee', 'hod', 'admin']);
      if (auth.response) return auth.response;
      const resolvedActor = resolveActorForMutation(request, auth.role, actor);
      if (resolvedActor.response) return resolvedActor.response;
      const reason = parsed.data.reason || 'Cancelled by employee';
      const updatedRequest = await cancelLeaveRequestController(requestId, resolvedActor.actor, reason);
      return NextResponse.json({ request: updatedRequest }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
