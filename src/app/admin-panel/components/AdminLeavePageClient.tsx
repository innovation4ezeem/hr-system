'use client';
import React, { useState } from 'react';
import { AdminPanelSectionClient } from './AdminPanelClient';
import LeaveReportsPanel from './LeaveReportsPanel';

const TABS = [
  { key: 'control', label: 'Leave Control', icon: '⚙️' },
  { key: 'reports', label: 'Reports & Analytics', icon: '📊' },
] as const;

type Tab = typeof TABS[number]['key'];

export default function AdminLeavePageClient() {
  const [activeTab, setActiveTab] = useState<Tab>('control');

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-5">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))', width: 'fit-content' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: activeTab === tab.key ? 'rgb(79 127 255)' : 'transparent',
                color: activeTab === tab.key ? 'white' : 'rgb(var(--text-secondary))',
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'control' && <AdminPanelSectionClient fixedTab="leave" />}
        {activeTab === 'reports' && <LeaveReportsPanel />}
      </div>
    </div>
  );
}
