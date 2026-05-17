import React from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import SystemSettingsPanel from '../components/SystemSettingsPanel';

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Admin - System Settings"
        subtitle="Editable leave policies, 60/25/15 scoring weights, and year-end archive trigger"
        showProfile={false}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-6 py-6">
          <SystemSettingsPanel />
        </div>
      </div>
    </div>
  );
}
