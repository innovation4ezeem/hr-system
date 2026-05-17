import React from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import ApplyLeaveRequestForm from '@/app/employee-portal/components/ApplyLeaveRequestForm';

export default function EmployeeLeaveApplyPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Apply for Leave"
        subtitle="Submit a leave request for manager approval"
        showProfile={false}
        showBack={true}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Leave Application</h1>
            <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
              Fill in your leave details and submit for approval.
            </p>
          </div>

          <ApplyLeaveRequestForm />
        </div>
      </div>
    </div>
  );
}