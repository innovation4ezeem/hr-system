import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import EmployeeLeaveHistoryPanel from '../components/EmployeeLeaveHistoryPanel';

export default function EmployeeLeaveHistoryPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="My Leave History" subtitle="View all your leave requests and status" showProfile={false} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-6 py-6">
          <Suspense fallback={<div className="text-sm">Loading leave history...</div>}>
            <EmployeeLeaveHistoryPanel />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
