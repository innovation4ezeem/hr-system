import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import PersonalPortalClient from '@/components/PersonalPortalClient';

export default function EmployeeOverviewPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Employee Portal" subtitle={`My Performance & HR Workspace — ${new Date().getFullYear()}`} />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center" style={{ color: 'rgb(var(--text-muted))' }}>Loading...</div>}>
        <PersonalPortalClient basePath="/employee-portal/overview" />
      </Suspense>
    </div>
  );
}
