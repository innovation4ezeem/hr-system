import React from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import SelfEvaluationSection from '@/app/employee-portal/components/SelfEvaluationSection';

export default function ManagerEvaluationPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Manager Dashboard - Self Evaluation Attachments" subtitle="Upload and share employee evaluation attachments" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-6 py-6">
          <SelfEvaluationSection isArchive={false} />
        </div>
      </div>
    </div>
  );
}
