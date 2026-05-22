import React from 'react';
import { notFound } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { prisma } from '@/lib/prisma';
import UserDetailClient from './UserDetailClient';

function decodeUserId(encoded: string): string {
  try {
    // Re-add Base64 padding that was stripped
    const paddingNeeded = (4 - (encoded.length % 4)) % 4;
    const padded = encoded + '='.repeat(paddingNeeded);
    const decoded = Buffer.from(padded, 'base64').toString('utf-8');
    // Validate: should look like a user ID (contains alphanumeric, dashes, underscores)
    if (/^[\w-]+$/.test(decoded) && decoded.length >= 2) {
      return decoded;
    }
  } catch (e) {
    // Decoding failed, fall through to raw ID
  }
  return encoded;
}

export default async function AdminUserRecordPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  
  const realId = decodeUserId(userId);

  let user;
  try {
    user = await prisma.users.findUnique({
      where: { id: realId }
    });
  } catch (e) {
    console.error('Failed to fetch user:', e);
    notFound();
  }

  if (!user) {
    notFound();
  }

  // Map DB fields to UserProfile interface
  const mappedUser = {
    id: user.id,
    name: user.name,
    preferred_name: user.preferred_name,
    email: user.email,
    phone_number: user.phone || user.phone_number,
    address: user.address,
    mailing_address: user.mailing_address,
    emergency_contact: user.emergency_contact,
    bank_details: user.bank_details,
    join_date: user.join_date,
    reportsToId: user.reports_to_id,
    role: user.role,
    dept: user.dept,
  };

  return (
    <UserDetailClient user={mappedUser} />
  );
}

