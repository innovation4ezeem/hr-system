'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface PersonalPerformanceHeatmapCardProps {
  summary?: {
    latestFinalScore: number;
    latestScoreStatus: string;
    provisionalMetrics?: any;
  };
  metrics?: {
    performance: number;
    participation: number;
    popularity: number;
  };
}

export default function PersonalPerformanceHeatmapCard({ summary, metrics }: PersonalPerformanceHeatmapCardProps) {
  const score = summary?.latestFinalScore ?? 0;
  
  const getHeatBg = (val: number) => {
    if (val >= 80) return { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', text: 'rgb(52 211 153)' };
    if (val >= 50) return { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', text: 'rgb(251 191 36)' };
    return { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', text: 'rgb(248 113 113)' };
  };

  const heat = getHeatBg(score);
  const labels = summary?.provisionalMetrics?.labels || {
    performance: 'Performance',
    participation: 'Participation',
    popularity: 'Popularity'
  };
  const weights = summary?.provisionalMetrics?.weights || {
    performance: 60,
    participation: 25,
    popularity: 15
  };

  return (
    <div className="rounded-xl overflow-hidden h-full" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
        <h2 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Personal Performance Insights</h2>
        <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-white/5" style={{ color: heat.text }}>
           {summary?.latestScoreStatus || 'Current Period'}
        </span>
      </div>

      <div className="p-8 flex flex-col md:flex-row items-center gap-10">
        {/* Large Score Circle */}
        <div className="relative w-48 h-48 rounded-full flex items-center justify-center flex-shrink-0 border-8" 
          style={{ borderColor: heat.border, background: heat.bg }}>
          <div className="text-center">
            <p className="text-5xl font-black font-mono leading-none" style={{ color: heat.text }}>{score}%</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">Overall Score</p>
          </div>
          {/* Animated Glow */}
          <div className="absolute inset-0 rounded-full animate-pulse opacity-20" style={{ boxShadow: `0 0 40px ${heat.text}` }} />
        </div>

        {/* Detailed Metrics */}
        <div className="flex-1 w-full space-y-6">
          <MetricRow label={`${labels.performance} (${weights.performance}%)`} val={metrics?.performance ?? 0} color="rgb(79 127 255)" icon="ChartBarIcon" />
          <MetricRow label={`${labels.participation} (${weights.participation}%)`} val={metrics?.participation ?? 0} color="rgb(52 211 153)" icon="BoltIcon" />
          <MetricRow label={`${labels.popularity} (${weights.popularity}%)`} val={metrics?.popularity ?? 0} color="rgb(167 139 250)" icon="StarIcon" />
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, val, color, icon }: { label: string; val: number; color: string; icon: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name={icon as any} size={14} style={{ color }} />
          <span className="text-xs font-semibold uppercase tracking-tight" style={{ color: 'rgb(var(--text-secondary))' }}>{label}</span>
        </div>
        <span className="text-sm font-bold font-mono" style={{ color }}>{val}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-white/5 border border-white/5">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${val}%`, background: color }} />
      </div>
    </div>
  );
}
