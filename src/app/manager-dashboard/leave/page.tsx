import React from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import ManagerLeavePageClient from '../components/ManagerLeavePageClient';

export default function ManagerLeaveApprovalPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Manager Dashboard — Leave"
        subtitle="Approval queue and team shared calendar"
        showProfile={false}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-6 py-6">
          <ManagerLeavePageClient />
        </div>
      </div>
    </div>
  );
}
