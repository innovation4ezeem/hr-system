import React from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import { AdminPanelSectionClient } from '../components/AdminPanelClient';

export default function AdminPerformancePage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Admin - Performance"
        subtitle="System Framework - Company Performance Sheets"
        yearSelector
        showProfile={false}
      />
      <AdminPanelSectionClient fixedTab="performance" />
    </div>
  );
}
