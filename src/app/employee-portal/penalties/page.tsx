import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import PersonalPortalClient from '@/components/PersonalPortalClient';

export default function EmployeePenaltiesPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Employee Portal - Penalty History" subtitle="Compliance and penalty records" />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center" style={{ color: 'rgb(var(--text-muted))' }}>Loading...</div>}>
        <PersonalPortalClient basePath="/employee-portal/penalties" />
      </Suspense>
    </div>
  );
}
