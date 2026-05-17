import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import PersonalPortalClient from '@/components/PersonalPortalClient';

export default function EmployeeProfilePage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Employee Portal - Unified Profile" subtitle="Leave history, performance score, penalties, and profile summary" />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center" style={{ color: 'rgb(var(--text-muted))' }}>Loading...</div>}>
        <PersonalPortalClient basePath="/employee-portal/profile" />
      </Suspense>
    </div>
  );
}
