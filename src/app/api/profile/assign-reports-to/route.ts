import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/apiAuth';
import { listUsers } from '@/models/userModel';
import { sendDualNotification } from '@/controllers/notificationController';

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['admin']);
    if (auth.response) return auth.response;

    const body = await request.json();
    const { employeeId, newReportsToId } = body;
    const isSilent = request.headers.get('x-silent-mode') === 'true';

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    const { prisma } = await import('@/lib/prisma');
    const { insertSystemAuditLog } = await import('@/models/systemAuditLogModel');

    // Get existing structure to notify old HOD
    const oldUserRow = await prisma.users.findUnique({
      where: { id: employeeId },
      select: { name: true, reports_to_id: true }
    });

    if (!oldUserRow) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    const oldReportsToId = oldUserRow.reports_to_id;
    const employeeName = oldUserRow.name;

    // Update DB
    await prisma.users.update({
      where: { id: employeeId },
      data: {
        reports_to_id: newReportsToId || null,
        updated_at: new Date()
      }
    });

    // Log Activity
    await insertSystemAuditLog(
      'user-management',
      'REASSIGN_REPORTS_TO',
      auth.role === 'admin' ? 'admin' : 'system',
      {
        employeeId,
        oldReportsToId,
        newReportsToId: newReportsToId || null,
      }
    );

    // Notify parties
    const users = await listUsers();
    const employee = users.find(u => u.id === employeeId);
    if (!employee) return NextResponse.json({ success: true }, { status: 200 }); // Should exist

    const oldHOD = oldReportsToId ? users.find(u => u.id === oldReportsToId) : null;
    const newHOD = newReportsToId ? users.find(u => u.id === newReportsToId) : null;

    if (!isSilent) {
      // Notify Employee
      if (employee.email) {
        await sendDualNotification({
          recipientId: employee.id,
          recipientEmail: employee.email,
          type: 'ProfileUpdate',
          title: 'Reporting Line Updated',
          inAppMessage: `Your reporting manager has been updated to ${newHOD ? newHOD.name : 'None'}.`,
          emailMessage: `Your organizational reporting structure was updated by HR. You now report to ${newHOD ? newHOD.name : 'None'}.`,
          relatedId: employee.id,
          provider: 'smtp'
        });
      }

      // Notify New HOD
      if (newHOD && newHOD.email && newHOD.id !== employee.id) {
        await sendDualNotification({
          recipientId: newHOD.id,
          recipientEmail: newHOD.email,
          type: 'ProfileUpdate',
          title: 'New Team Member Assigned',
          inAppMessage: `${employeeName} has been assigned to report directly to you.`,
          emailMessage: `${employeeName} has been administratively assigned to your team. Please review their profile and tasks.`,
          relatedId: employee.id,
          provider: 'smtp'
        });
      }

      // Notify Old HOD (Optional)
      if (oldHOD && oldHOD.email && oldHOD.id !== employee.id && oldHOD.id !== newReportsToId) {
        await sendDualNotification({
          recipientId: oldHOD.id,
          recipientEmail: oldHOD.email,
          type: 'ProfileUpdate',
          title: 'Team Member Reassigned',
          inAppMessage: `${employeeName} is no longer reporting to you.`,
          emailMessage: `${employeeName} has been reassigned to a different manager. You no longer need to manage their approvals.`,
          relatedId: employee.id,
          provider: 'smtp'
        });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Assign reports-to error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
