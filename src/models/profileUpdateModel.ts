import { prisma } from '@/lib/prisma';
import { randomId } from '@/lib/utils';

export type ProfileUpdateRequest = {
  id: string;
  employeeId: string;
  requestedChanges: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  createdAt: string;
};

export async function createProfileUpdateRequest(payload: {
  employeeId: string;
  requestedChanges: Record<string, any>;
}) {
  const id = randomId('PRQ');
  const now = new Date();

  await prisma.profile_update_requests.create({
    data: {
      id,
      employee_id: payload.employeeId,
      requested_changes: payload.requestedChanges,
      status: 'pending',
      created_at: now,
      updated_at: now,
    }
  });

  // Tag user as pending
  await prisma.users.update({
    where: { id: payload.employeeId },
    data: { profile_update_status: 'pending' }
  });

  return id;
}

export async function listPendingProfileUpdates(): Promise<ProfileUpdateRequest[]> {
  const data = await prisma.profile_update_requests.findMany({
    where: { status: 'pending' },
    orderBy: { created_at: 'desc' }
  });

  return (data ?? []).map(row => ({
    id: row.id,
    employeeId: row.employee_id,
    requestedChanges: row.requested_changes as Record<string, any>,
    status: row.status as 'pending' | 'approved' | 'rejected',
    createdAt: row.created_at.toISOString(),
  }));
}

export async function processProfileUpdate(
  requestId: string,
  reviewerId: string,
  decision: 'approved' | 'rejected',
  comment?: string
) {
  const now = new Date();

  // Get request to apply changes if approved
  const requestRow = await prisma.profile_update_requests.findUnique({
    where: { id: requestId }
  });
  if (!requestRow) throw new Error('Request not found');

  // Update request status
  await prisma.profile_update_requests.update({
    where: { id: requestId },
    data: {
      status: decision,
      reviewed_by: reviewerId,
      reviewed_at: now,
      review_comment: comment || '',
      updated_at: now,
    }
  });

  // Determine user profile_update_status
  // If there are no other pending requests, set user to approved
  const count = await prisma.profile_update_requests.count({
    where: {
      employee_id: requestRow.employee_id,
      status: 'pending',
      id: { not: requestId }
    }
  });

  const newUserStatus = (count === 0) ? 'approved' : 'pending';
  const userUpdatePayload: any = { profile_update_status: newUserStatus };

  if (decision === 'approved') {
    const changes = requestRow.requested_changes as Record<string, any>;
    if (changes.phone !== undefined) userUpdatePayload.phone = changes.phone;
    if (changes.name) userUpdatePayload.name = changes.name;
    // Map other fields as necessary based on schema
  }

  await prisma.users.update({
    where: { id: requestRow.employee_id },
    data: userUpdatePayload
  });

  return { employeeId: requestRow.employee_id, requestedChanges: requestRow.requested_changes };
}
