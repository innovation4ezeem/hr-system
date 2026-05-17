import React from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import AdminLeavePageClient from '../components/AdminLeavePageClient';

export default function AdminLeavePage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Admin — Leave Control & Reports"
        subtitle="Policy, Quota Override, Feb Cleanse, Audit and Analytics"
        showProfile={false}
      />
      <AdminLeavePageClient />
    </div>
  );
}
