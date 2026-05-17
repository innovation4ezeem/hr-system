import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import PersonalPortalClient from '@/components/PersonalPortalClient';

export default function EmployeeEvaluationPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Employee Portal - Self Evaluation" subtitle="Quarterly reflection and achievements" />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center" style={{ color: 'rgb(var(--text-muted))' }}>Loading...</div>}>
        <PersonalPortalClient basePath="/employee-portal/evaluation" />
      </Suspense>
    </div>
  );
}
