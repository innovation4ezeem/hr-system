import React from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import PenaltiesCrudPanel from '@/app/admin-panel/components/PenaltiesCrudPanel';

export const metadata = {
  title: 'Penalties Management | Admin Panel',
};

export default function PenaltiesAdminPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Admin - Penalties History"
        subtitle="Create and update employee penalty history records"
        showProfile={false}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Penalties Management</h1>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
              Create, review, and manage employee penalty records.
            </p>
          </div>

          <PenaltiesCrudPanel />
        </div>
      </div>
    </div>
  );
}
