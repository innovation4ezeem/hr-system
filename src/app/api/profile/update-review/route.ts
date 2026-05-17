import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getRequestUserId } from '@/lib/apiAuth';
import { processProfileUpdate } from '@/models/profileUpdateModel';
import { listUsers } from '@/models/userModel';
import { sendDualNotification } from '@/controllers/notificationController';

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['admin']);
    if (auth.response) return auth.response;

    const body = await request.json();
    const { requestId, decision, comment } = body;

    if (!requestId || !['approved', 'rejected'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const adminId = getRequestUserId(request);
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await processProfileUpdate(requestId, adminId, decision as any, comment);

    // Send notification to the employee
    const users = await listUsers();
    const employee = users.find(u => u.id === result.employeeId);

    if (employee && employee.email) {
      await sendDualNotification({
        recipientId: employee.id,
        recipientEmail: employee.email,
        type: 'ProfileUpdate',
        title: `Profile Update ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
        inAppMessage: `Your profile update was ${decision}.${comment ? ` Reason: ${comment}` : ''}`,
        emailMessage: `Your requested profile changes have been ${decision} by Admin.${comment ? `\n\nComment: ${comment}` : ''}`,
        relatedId: requestId,
        provider: 'smtp'
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Profile update review error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
