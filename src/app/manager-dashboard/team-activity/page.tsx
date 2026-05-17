'use client';
import React, { useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import ActivitiesCrudPanel from '@/app/admin-panel/components/ActivitiesCrudPanel';
import { readClientIdentity } from '@/lib/clientAuth';

export default function ManagerTeamActivityPage() {
  const identity = useMemo(() => readClientIdentity('hod'), []);
  const departmentScope = identity.department;

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Manager Dashboard - Team Activity Report"
        subtitle="Monthly breakdown of team member activities and scoring"
        showProfile={false}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-6 py-6">
          <ActivitiesCrudPanel 
            departmentScope={departmentScope} 
            showAddButton={true}
            canEdit={true}
            canDelete={true}
          />
        </div>
      </div>
    </div>
  );
}
