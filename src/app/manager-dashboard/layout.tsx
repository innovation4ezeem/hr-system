import React from 'react';
import AppLayout from '@/components/AppLayout';

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout role="hod">
      {children}
    </AppLayout>
  );
}
