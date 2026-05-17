'use client';
import React, { useState } from 'react';
import LeaveApprovalQueuePanel from '../components/LeaveApprovalQueuePanel';
import TeamLeaveCalendarPanel from '../components/TeamLeaveCalendarPanel';

const TABS = [
  { key: 'queue', label: 'Approval Queue', icon: '📋' },
  { key: 'calendar', label: 'Team Calendar', icon: '📅' },
] as const;

type Tab = typeof TABS[number]['key'];

export default function ManagerLeavePageClient() {
  const [activeTab, setActiveTab] = useState<Tab>('queue');

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))', width: 'fit-content' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: activeTab === tab.key ? 'rgb(79 127 255)' : 'transparent',
              color: activeTab === tab.key ? 'rgb(255 255 255)' : 'rgb(var(--text-secondary))',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      {activeTab === 'queue' && <LeaveApprovalQueuePanel />}
      {activeTab === 'calendar' && <TeamLeaveCalendarPanel />}
    </div>
  );
}
