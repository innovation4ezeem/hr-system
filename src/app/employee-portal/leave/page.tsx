import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import PersonalPortalClient from '@/components/PersonalPortalClient';

export default function EmployeeLeavePage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Employee Portal - Leave" subtitle="Leave balance and leave applications" />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center" style={{ color: 'rgb(var(--text-muted))' }}>Loading...</div>}>
        <PersonalPortalClient basePath="/employee-portal/leave" />
      </Suspense>
    </div>
  );
}
