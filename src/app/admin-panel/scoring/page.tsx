import React from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import { AdminPanelSectionClient } from '../components/AdminPanelClient';

export default function AdminScoringPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Admin - Scoring"
        subtitle="System Framework - 100% Rule and Scoring Categories"
        yearSelector
        showProfile={false}
      />
      <AdminPanelSectionClient fixedTab="scoring" />
    </div>
  );
}
