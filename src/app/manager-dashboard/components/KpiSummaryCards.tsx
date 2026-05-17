'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { useAppContext } from '@/context/AppContext';
import { buildClientAuthHeaders } from '@/lib/clientAuth';
import { useRouter } from 'next/navigation';

interface KpiSummaryCardsProps {
  departmentScope?: string | null;
}

export default function KpiSummaryCards({ departmentScope = null }: KpiSummaryCardsProps) {
  const { selectedYear, userRole, userDepartment, userId, userName } = useAppContext();
  const [pendingLeaveCount, setPendingLeaveCount] = useState<number | string>('...');
  const [activePenaltyCount, setActivePenaltyCount] = useState<number | string>('...');
  const [urgentLeaveCount, setUrgentLeaveCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [penaltyTrend, setPenaltyTrend] = useState<number[]>(new Array(12).fill(0));
  const [leaveTrend, setLeaveTrend] = useState<number[]>(new Array(12).fill(0));

  useEffect(() => {
    setMounted(true);
  }, []);

  const authHeaders = useMemo(() => buildClientAuthHeaders({
    role: userRole,
    userId: userId || 'admin-001',
    userName: userName || 'Manager',
    department: userDepartment || departmentScope || 'Operations',
  }), [departmentScope, userDepartment, userId, userName, userRole]);

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Fetch Leave Requests
        const leaveParams = new URLSearchParams({
          mode: 'team-history',
          year: String(selectedYear),
          status: 'all',
        });
        if (departmentScope) leaveParams.set('department', departmentScope);

        const leaveRes = await fetch(`/api/leave-requests?${leaveParams.toString()}`, { headers: authHeaders });
        const leaveContentType = leaveRes.headers.get('content-type');
        let leaveData: any = {};
        if (leaveContentType && leaveContentType.includes('application/json')) {
          leaveData = await leaveRes.json();
        }
        
        let lTrend: number[] = new Array(12).fill(0);
        if (leaveRes.ok && Array.isArray(leaveData.requests)) {
          const pending = leaveData.requests.filter((r: any) => {
            const s = String(r.status || '').toLowerCase();
            return s === 'applied' || s === 'pending';
          });
          setPendingLeaveCount(pending.length);
          
          leaveData.requests.forEach((r: any) => {
            const dateStr = r.startDate || r.start_date;
            if (dateStr) {
              const month = new Date(dateStr).getMonth();
              if (month >= 0 && month < 12) lTrend[month]++;
            }
          });
          
          const today = new Date();
          const in3Days = new Date();
          in3Days.setDate(today.getDate() + 3);
          const urgent = pending.filter((r: any) => {
            const start = new Date(r.startDate || r.start_date);
            return start <= in3Days;
          });
          setUrgentLeaveCount(urgent.length);
        } else {
          setPendingLeaveCount(0);
        }
        setLeaveTrend(lTrend);

        // 2. Fetch Penalties
        const penaltyParams = new URLSearchParams({
          mode: 'penalties',
          year: String(selectedYear),
          status: 'all',
          includeResolved: '1',
        });
        if (departmentScope) penaltyParams.set('department', departmentScope);

        const penaltyRes = await fetch(`/api/performance-management?${penaltyParams.toString()}`, { headers: authHeaders });
        const penaltyContentType = penaltyRes.headers.get('content-type');
        let penaltyData: any = {};
        if (penaltyContentType && penaltyContentType.includes('application/json')) {
          penaltyData = await penaltyRes.json();
        }

        let pTrend: number[] = new Array(12).fill(0);
        if (penaltyRes.ok && Array.isArray(penaltyData.penalties)) {
          setActivePenaltyCount(penaltyData.penalties.length);
          penaltyData.penalties.forEach((p: any) => {
            const dateStr = p.penaltyDate || p.penalty_date;
            if (dateStr) {
              const month = new Date(dateStr).getMonth();
              if (month >= 0 && month < 12) pTrend[month]++;
            }
          });
        } else {
          setActivePenaltyCount(0);
        }
        setPenaltyTrend(pTrend);

      } catch (err) {
        console.error('Error fetching KPI data:', err);
        setPendingLeaveCount(0);
        setActivePenaltyCount(0);
      }
    }

    void fetchData();
  }, [departmentScope, selectedYear, authHeaders]);

  const cards = [
    {
      id: 'card-leave-pending',
      label: 'Pending Leave Requests',
      value: String(pendingLeaveCount),
      delta: `${urgentLeaveCount} urgent`,
      positive: null,
      sub: 'awaiting approval',
      color: 'rgb(251 191 36)',
      dimColor: 'rgba(251,191,36,0.06)',
      borderColor: 'rgba(251,191,36,0.15)',
      icon: 'CalendarDaysIcon' as const,
      sparkColor: '#FBBF24',
      trend: leaveTrend
    },
    {
      id: 'card-penalties-active',
      label: 'Active Penalties',
      value: String(activePenaltyCount),
      delta: activePenaltyCount === 0 ? 'All good' : `${activePenaltyCount} active`,
      positive: activePenaltyCount === 0,
      sub: 'this period',
      color: 'rgb(167 139 250)',
      dimColor: 'rgba(167,139,250,0.06)',
      borderColor: 'rgba(167,139,250,0.15)',
      icon: 'ShieldExclamationIcon' as const,
      sparkColor: '#A78BFA',
      trend: penaltyTrend
    },
  ];

  const router = useRouter();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cards.map((card) => (
        <div
          key={card.id}
          onClick={() => {
            if (card.id === 'card-leave-pending') {
              router.push('/manager-dashboard/leave');
            } else if (card.id === 'card-penalties-active') {
              router.push('/manager-dashboard/penalty');
            }
          }}
          className="rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 hover:scale-[1.01] cursor-pointer hover:shadow-xl hover:shadow-black/20"
          style={{ background: card.dimColor, border: `1px solid ${card.borderColor}` }}
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
            <div className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <Icon name={card.icon} size={18} style={{ color: card.color }} />
            </div>
          </div>

          <div className="h-12 -mx-5 mb-1">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={card.trend.map((v, i) => ({ i, v }))}>
                  <defs>
                    <linearGradient id={`grad-${card.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={card.sparkColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={card.sparkColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => active && payload?.length ? (
                      <div className="text-[10px] px-2 py-1 rounded shadow-lg" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border))', color: 'rgb(var(--text-primary))' }}>
                        Count: {payload[0].value}
                      </div>
                    ) : null}
                  />
                  <Area type="monotone" dataKey="v" stroke={card.sparkColor} strokeWidth={1.5}
                    fill={`url(#grad-${card.id})`} dot={false} />
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