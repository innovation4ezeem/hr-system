import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import ManagerDashboardClient from '../components/ManagerDashboardClient';

export default function ManagerPenaltyPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Manager Dashboard - Penalty Log" subtitle="Compliance and disciplinary tracking" />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center" style={{ color: 'rgb(var(--text-muted))' }}>Loading...</div>}>
        <ManagerDashboardClient />
      </Suspense>
    </div>
  );
}
