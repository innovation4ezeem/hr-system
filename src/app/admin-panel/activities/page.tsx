import React from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import ActivitiesCrudPanel from '@/app/admin-panel/components/ActivitiesCrudPanel';

export const metadata = {
  title: 'Activities Management | Admin Panel',
};

export default function ActivitiesAdminPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Admin - Activities Scoring"
        subtitle="Create activity records and sync category scores into performance summary"
        showProfile={false}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Activities Management</h1>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
              Create, manage, and assign activities to employees. Activities sync to their performance score records automatically.
            </p>
          </div>

          <ActivitiesCrudPanel />
        </div>
      </div>
    </div>
  );
}
