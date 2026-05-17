import React from 'react';
import AppLayout from '@/components/AppLayout';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout role="employee">
      {children}
    </AppLayout>
  );
}
