'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface PersonalLeaveStatusPanelProps {
  leaveHistory?: Array<{
    id: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    units: number;
    status: string;
  }>;
  onViewFullHistory?: () => void;
}

export default function PersonalLeaveStatusPanel({ leaveHistory = [], onViewFullHistory }: PersonalLeaveStatusPanelProps) {
  const displayed = (leaveHistory || []).slice(0, 4);

  const getStatusStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'approved') return { bg: 'rgba(52,211,153,0.1)', text: 'rgb(52 211 153)' };
    if (s === 'rejected' || s === 'cancelled') return { bg: 'rgba(248,113,113,0.1)', text: 'rgb(248 113 113)' };
    return { bg: 'rgba(251,191,36,0.1)', text: 'rgb(251 191 36)' };
  };

  return (
    <div className="rounded-xl overflow-hidden h-full flex flex-col" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
        <h2 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Recent Leave Status</h2>
      </div>

      <div className="flex-1 divide-y" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
        {displayed.length > 0 ? (
          displayed.map((item) => {
            const style = getStatusStyle(item.status);
            return (
              <div key={item.id} className="px-5 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'rgb(var(--text-primary))' }}>
                      {item.leaveType}
                    </p>
                    <p className="text-[10px] font-mono mt-0.5 opacity-60">
                      {item.startDate} {item.startDate !== item.endDate ? `→ ${item.endDate}` : ''}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter shrink-0"
                    style={{ background: style.bg, color: style.text }}>
                    {item.status}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center">
            <Icon name="CalendarIcon" size={32} className="opacity-20 mb-2 mx-auto" />
            <p className="text-xs opacity-50">No recent leave records</p>
          </div>
        )}
      </div>

      <div className="p-3 border-t text-center" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
        <button 
          onClick={onViewFullHistory}
          className="text-[10px] font-bold text-blue-400 hover:underline uppercase tracking-widest transition-opacity hover:opacity-80 active:scale-95"
        >
          View Full History
        </button>
      </div>
    </div>
  );
}
