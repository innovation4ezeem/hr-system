import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getRequestUserId } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { insertSystemAuditLog } from '@/models/systemAuditLogModel';

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['employee', 'hod', 'admin']);
    if (auth.response) return auth.response;

    const body = await request.json();
    const { requestedChanges, employeeId: employeeIdFromBody } = body;

    if (!requestedChanges || Object.keys(requestedChanges).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    const requesterId = getRequestUserId(request);
    if (!requesterId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const requestedTargetId = String(employeeIdFromBody || '').trim();
    const employeeId = auth.role === 'admin' && requestedTargetId ? requestedTargetId : requesterId;

    if (auth.role !== 'admin' && requestedTargetId && requestedTargetId !== requesterId) {
      return NextResponse.json({ error: 'Forbidden: cannot update another user profile' }, { status: 403 });
    }

    const now = new Date();

    const updatePayload: any = {
      updated_at: now,
    };

    if (Object.prototype.hasOwnProperty.call(requestedChanges, 'name')) updatePayload.name = requestedChanges.name;
    if (Object.prototype.hasOwnProperty.call(requestedChanges, 'phone')) updatePayload.phone = requestedChanges.phone;
    if (Object.prototype.hasOwnProperty.call(requestedChanges, 'address')) updatePayload.address = requestedChanges.address;
    if (Object.prototype.hasOwnProperty.call(requestedChanges, 'mailingAddress')) updatePayload.mailing_address = requestedChanges.mailingAddress;
    if (Object.prototype.hasOwnProperty.call(requestedChanges, 'emergencyContact')) updatePayload.emergency_contact = requestedChanges.emergencyContact;
    if (Object.prototype.hasOwnProperty.call(requestedChanges, 'preferredName')) updatePayload.preferred_name = requestedChanges.preferredName;
    if (Object.prototype.hasOwnProperty.call(requestedChanges, 'bankDetails')) updatePayload.bank_details = requestedChanges.bankDetails;
    if (Object.prototype.hasOwnProperty.call(requestedChanges, 'rewards')) updatePayload.rewards = Array.isArray(requestedChanges.rewards) ? requestedChanges.rewards : [];
    if (Object.prototype.hasOwnProperty.call(requestedChanges, 'achievements')) updatePayload.achievements = Array.isArray(requestedChanges.achievements) ? requestedChanges.achievements : [];
    if (Object.prototype.hasOwnProperty.call(requestedChanges, 'experienceInOffice')) updatePayload.experience_in_office = Array.isArray(requestedChanges.experienceInOffice) ? requestedChanges.experienceInOffice : [];

    await prisma.users.update({
      where: { id: employeeId },
      data: updatePayload
    });

    // Log Activity
    await insertSystemAuditLog(
      'employee-profile',
      'PROFILE_DIRECT_UPDATE',
      'system',
      {
        employeeId,
        fields: Object.keys(requestedChanges),
      }
    );

    return NextResponse.json({ success: true, updatedAt: now.toISOString() }, { status: 200 });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
