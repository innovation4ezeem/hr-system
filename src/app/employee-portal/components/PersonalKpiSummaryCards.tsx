'use client';
import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface PersonalKpiSummaryCardsProps {
  summary?: {
    latestFinalScore: number;
    latestScoreStatus: string;
    approvedLeaveUnits: number;
    totalPenalties: number;
  };
  performanceHistory?: any[];
  penaltiesHistory?: any[];
  leaveHistory?: any[];
  wfhUsed?: number;
  wfhLimit?: number;
  onCardClick?: (tab: 'activities' | 'leave' | 'penalties' | 'evaluation') => void;
}

export default function PersonalKpiSummaryCards({ 
  summary, 
  performanceHistory = [], 
  penaltiesHistory = [], 
  leaveHistory = [],
  wfhUsed = 0, 
  wfhLimit = 4,
  onCardClick
}: PersonalKpiSummaryCardsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  
  // Helper to generate sparkline data
  const getSparklineData = (type: string, currentVal: number) => {
    if (type === 'score') {
      const history = [...performanceHistory].reverse();
      if (history.length === 0) return [0, 1, 2, 3, 4, 5, 6].map((i) => ({ i, v: currentVal }));
      if (history.length === 1) return [0, 1, 2, 3, 4, 5, 6].map((i) => ({ i, v: currentVal }));
      return history.map((h, i) => ({ i, v: h.finalScore || h.final_score || 0 }));
    }
    if (type === 'leave') {
      // Show monthly usage for current year
      const months = Array(12).fill(0);
      leaveHistory.filter(l => l.status === 'approved').forEach(l => {
        const d = new Date(l.startDate || l.start_date);
        months[d.getMonth()] += Number(l.units || 0);
      });
      return months.map((v, i) => ({ i, v }));
    }
    if (type === 'penalties') {
      const months = Array(12).fill(0);
      penaltiesHistory.forEach(p => {
        const d = new Date(p.date || p.penalty_date);
        months[d.getMonth()] += 1;
      });
      return months.map((v, i) => ({ i, v }));
    }
    return [0, 0, 0, 0, 0, 0, 0].map((v, i) => ({ i, v: 0 }));
  };

  const cards = [
    {
      id: 'personal-score',
      label: 'Performance Score',
      value: String(summary?.latestFinalScore ?? 0),
      delta: summary?.latestScoreStatus || 'N/A',
      positive: (summary?.latestFinalScore ?? 0) >= 80,
      sub: 'latest evaluation',
      color: 'rgb(79 127 255)',
      dimColor: 'rgba(79,127,255,0.06)',
      borderColor: 'rgba(79,127,255,0.15)',
      icon: 'ChartBarIcon' as const,
      sparkColor: '#4F7FFF',
      data: getSparklineData('score', summary?.latestFinalScore ?? 0),
      tab: 'activities' as const
    },
    {
      id: 'personal-leave',
      label: 'Approved Leave',
      value: String(summary?.approvedLeaveUnits ?? 0),
      delta: `WFH: ${wfhUsed}/${wfhLimit}`,
      positive: null,
      sub: 'units this year',
      color: 'rgb(251 191 36)',
      dimColor: 'rgba(251,191,36,0.06)',
      borderColor: 'rgba(251,191,36,0.15)',
      icon: 'CalendarDaysIcon' as const,
      sparkColor: '#FBBF24',
      data: getSparklineData('leave', summary?.approvedLeaveUnits ?? 0),
      tab: 'leave' as const
    },
    {
      id: 'personal-penalties',
      label: 'Active Penalties',
      value: String(summary?.totalPenalties ?? 0),
      delta: (summary?.totalPenalties ?? 0) === 0 ? 'Clear Record' : `${summary?.totalPenalties} active`,
      positive: (summary?.totalPenalties ?? 0) === 0,
      sub: 'this period',
      color: 'rgb(167 139 250)',
      dimColor: 'rgba(167,139,250,0.06)',
      borderColor: 'rgba(167,139,250,0.15)',
      icon: 'ShieldExclamationIcon' as const,
      sparkColor: '#A78BFA',
      data: getSparklineData('penalties', summary?.totalPenalties ?? 0),
      tab: 'penalties' as const
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.id}
          onClick={() => onCardClick?.(card.tab)}
          className={`rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 hover:scale-[1.01] ${onCardClick ? 'cursor-pointer hover:brightness-110 active:scale-95' : ''}`}
          style={{ background: card.dimColor, border: `1px solid ${card.borderColor}` }}
          title={onCardClick ? `Click to view full ${card.tab} details` : undefined}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide uppercase mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>
                {card.label}
              </p>
              <p className="text-3xl font-bold font-mono" style={{ color: card.color, fontVariantNumeric: 'tabular-nums' }}>
                {card.value}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <Icon name={card.icon} size={18} style={{ color: card.color }} />
            </div>
          </div>

          <div className="h-12 -mx-5 mb-1">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={card.data}>
                  <defs>
                    <linearGradient id={`grad-${card.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={card.sparkColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={card.sparkColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke={card.sparkColor} strokeWidth={1.5}
                    fill={`url(#grad-${card.id})`} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: card.positive === true ? 'rgba(52,211,153,0.15)' : card.positive === false ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.15)',
                color: card.positive === true ? 'rgb(52 211 153)' : card.positive === false ? 'rgb(248 113 113)' : 'rgb(251 191 36)',
              }}>
              {card.delta}
            </span>
            <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{card.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
