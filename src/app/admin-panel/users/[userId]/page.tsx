import React from 'react';
import { notFound } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { prisma } from '@/lib/prisma';
import UserDetailClient from './UserDetailClient';

export default async function AdminUserRecordPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  
  let realId = userId;
  try {
    // Attempt to decode Base64
    const decoded = Buffer.from(userId + '==='.slice((userId.length + 3) % 4), 'base64').toString('ascii');
    // Basic check: if it looks like our u-XXX format or similar
    if (decoded.includes('-') || decoded.length >= 3) {
      realId = decoded;
    }
  } catch (e) {
    // If decoding fails, it's probably already a raw ID (fallback)
  }

  const user = await prisma.users.findUnique({
    where: { id: realId }
  });

  if (!user) {
    notFound();
  }

  // Map DB fields to UserProfile interface
  const mappedUser = {
    id: user.id,
    name: user.name,
    preferred_name: user.preferred_name,
    email: user.email,
    phone_number: user.phone,
    address: user.address,
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
