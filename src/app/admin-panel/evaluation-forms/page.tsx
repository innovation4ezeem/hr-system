import React from 'react';
import Topbar from '@/components/Topbar';
import { AdminPanelSectionClient } from '../components/AdminPanelClient';

export default function AdminEvaluationFormsPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Admin - Evaluation Forms"
        subtitle="System Framework - Evaluation attributes & template builder"
        showProfile={false}
      />
      <AdminPanelSectionClient fixedTab="attributes" />
    </div>
  );
}
