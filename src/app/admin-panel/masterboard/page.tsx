import React from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import MasterboardPanel from '../components/MasterboardPanel';

export default function MasterboardPage() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <Topbar
        title="Masterboard"
        subtitle="Enterprise Performance Ranking & Scoring Master Board"
        showProfile={false}
      />
      <div className="flex-1 p-4 md:p-6">
        <MasterboardPanel />
      </div>
    </div>
  );
}
