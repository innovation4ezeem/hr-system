'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import { buildClientAuthHeaders, readClientIdentity } from '@/lib/clientAuth';

import Icon from '@/components/ui/AppIcon';

type LeaveBalance = {
  id: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  year: number;
  openingDays: number;
  carryForwardDays: number;
  adjustedDays: number;
  usedDays: number;
  minAllowedDays: number;
  availableDays: number;
};

const TYPE_COLORS: Record<string, { color: string; dimColor: string; icon: string }> = {
  AL:          { color: 'rgb(79 127 255)',  dimColor: 'rgba(79,127,255,0.08)',  icon: 'CalendarDaysIcon' },
  MC:          { color: 'rgb(248 113 113)', dimColor: 'rgba(248,113,113,0.08)', icon: 'HeartIcon' },
  SL:          { color: 'rgb(248 113 113)', dimColor: 'rgba(248,113,113,0.08)', icon: 'HeartIcon' },

  CASUAL:      { color: 'rgb(251 191 36)',  dimColor: 'rgba(251,191,36,0.08)',  icon: 'SunIcon' },
  MATERNITY:   { color: 'rgb(236 72 153)',  dimColor: 'rgba(236,72,153,0.08)',  icon: 'HeartIcon' },
  PATERNITY:   { color: 'rgb(99 102 241)',  dimColor: 'rgba(99,102,241,0.08)',  icon: 'UserIcon' },
  BEREAVEMENT: { color: 'rgb(156 163 175)', dimColor: 'rgba(156,163,175,0.08)', icon: 'HeartIcon' },
  UNPAID:      { color: 'rgb(107 114 128)', dimColor: 'rgba(107,114,128,0.08)', icon: 'BanknotesIcon' },
  WFH:         { color: 'rgb(52 211 153)',  dimColor: 'rgba(52,211,153,0.08)',  icon: 'HomeIcon' },
  REWARD:      { color: 'rgb(251 191 36)',  dimColor: 'rgba(251,191,36,0.08)',  icon: 'StarIcon' },
  CS:          { color: 'rgb(167 139 250)', dimColor: 'rgba(167,139,250,0.08)', icon: 'ArrowPathIcon' },
  ADDITIONAL:  { color: 'rgb(79 127 255)',  dimColor: 'rgba(79,127,255,0.08)',  icon: 'PlusCircleIcon' },
  REPLACEMENT: { color: 'rgb(52 211 153)',  dimColor: 'rgba(52,211,153,0.08)',  icon: 'ArrowPathRoundedSquareIcon' },
};

const DEFAULT_STYLE = { color: 'rgb(148 163 184)', dimColor: 'rgba(148,163,184,0.08)', icon: 'CalendarDaysIcon' };

function BalanceSkeleton() {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border-subtle))' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-lg" style={{ background: 'rgb(var(--bg-surface))' }} />
            <div className="w-12 h-5 rounded" style={{ background: 'rgb(var(--bg-surface))' }} />
          </div>
          <div className="w-24 h-4 rounded mb-2" style={{ background: 'rgb(var(--bg-surface))' }} />
          <div className="w-full h-1.5 rounded-full" style={{ background: 'rgb(var(--bg-surface))' }} />
        </div>
      ))}
    </div>
  );
}

interface LeaveBalanceCardsProps {
  compact?: boolean;
  isArchive?: boolean;
  employeeId?: string;
  year?: number;
}

export default function LeaveBalanceCards({ compact = false, isArchive = false, employeeId: propEmployeeId, year: propYear }: LeaveBalanceCardsProps) {
  const router = useRouter();
  const { userId, userRole, selectedYear } = useAppContext();
  const effectiveEmployeeId = propEmployeeId || userId;
  const effectiveYear = propYear || selectedYear;

  const authHeaders = useMemo(() => {
    return buildClientAuthHeaders({
      role: userRole as any,
      userId: effectiveEmployeeId,
      userName: '', // Not strictly needed for headers
      department: '' // Not strictly needed for headers, but type requires it
    });
  }, [effectiveEmployeeId, userRole]);

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchBalances = async () => {
      if (!effectiveEmployeeId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/leave-management?mode=balances&employeeId=${encodeURIComponent(effectiveEmployeeId)}&year=${effectiveYear}`,
          { headers: authHeaders },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load balances');
        if (!cancelled) setBalances(data.balances || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchBalances();
    return () => { cancelled = true; };
  }, [effectiveEmployeeId, effectiveYear, authHeaders]);

  const alBalance = balances.find(b => b.leaveTypeCode === 'AL');
  const carryForwardCap = 5; // matches default seeded config
  const willBeClearedOnMarch = alBalance
    ? Math.max(0, alBalance.carryForwardDays - carryForwardCap)
    : 0;

  if (loading) return <BalanceSkeleton />;

  if (error) {
    return (
      <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: 'rgb(248 113 113)' }}>
        ⚠️ {error}
      </div>
    );
  }



  return (
    <div className="space-y-4">
      {/* Feb Cleanse Banner */}
      {!compact && alBalance && willBeClearedOnMarch > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-3"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <Icon name="ExclamationTriangleIcon" size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'rgb(251 191 36)' }}>
              March 1st AL Cleanse Notice
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgb(200 180 120)' }}>
              Your carry-forward balance is {alBalance.carryForwardDays} days. On March 1st, only {carryForwardCap} days carry forward —{' '}
              <span className="font-semibold">{willBeClearedOnMarch} day(s) will be cleared</span>. Consider applying leave before then.
            </p>
          </div>
        </div>
      )}

      {/* Balance Cards Grid */}
      {balances.length === 0 ? (
        <div className="rounded-xl p-8 text-sm text-center" style={{ color: 'rgb(var(--text-muted))', border: '1px dashed rgb(var(--border-subtle))' }}>
          No leave balance records found for {effectiveYear}.
        </div>
      ) : (
        <div className={`grid gap-3 ${compact ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'}`}>
          {/* Special Carry Forward Card if exists or explicitly requested */}
          {!compact && alBalance && (
            <div className="rounded-xl p-4 transition-all duration-200 hover:scale-[1.01]"
              style={{ background: 'rgba(79,127,255,0.05)', border: '1px solid rgba(79,127,255,0.3)' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgb(var(--bg-surface))' }}>
                  <Icon name="ArrowPathIcon" size={16} className="text-blue-400" />
                </div>
                <span className="text-lg font-bold font-mono text-blue-400">
                  {alBalance.carryForwardDays || 0}
                  <span className="text-xs font-normal ml-1" style={{ color: 'rgb(var(--text-muted))' }}>left</span>
                </span>
              </div>
              <p className="text-sm font-semibold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>Carry Forward Leave</p>
              <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Brought forward from previous year. Expiry: March 1st.</p>
            </div>
          )}

          {balances
            .filter(lb => ['AL', 'MC', 'SL', 'WFH', 'REWARD', 'UNPAID', 'CS', 'MATERNITY', 'PATERNITY', 'REPLACEMENT', 'ADDITIONAL', 'BEREAVEMENT'].includes(lb.leaveTypeCode))
            .map(lb => {
            
            const lbName = lb.leaveTypeCode === 'REWARD' ? 'Reward Leave' : lb.leaveTypeName;


            const style = TYPE_COLORS[lb.leaveTypeCode] || DEFAULT_STYLE;
          const entitled = lb.openingDays + lb.carryForwardDays + lb.adjustedDays;
          const pct = entitled > 0 ? Math.min(100, Math.round((lb.usedDays / entitled) * 100)) : 0;
          const remaining = lb.availableDays;
          const isNegative = remaining < (lb.minAllowedDays || 0);
          const displayColor = isNegative ? 'rgb(248 113 113)' : style.color;

          return (
            <div key={`lb-${lb.leaveTypeCode}`}
              className="rounded-xl p-4 transition-all duration-200 hover:scale-[1.01]"
              style={{ background: style.dimColor, border: `1px solid ${style.color}22` }}>

              {/* Header Row */}
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgb(var(--bg-surface))' }}>
                  <Icon name={style.icon as never} size={16} style={{ color: style.color }} />
                </div>
                <span className="text-lg font-bold font-mono" style={{ color: displayColor, fontVariantNumeric: 'tabular-nums' }}>
                  {remaining}
                  <span className="text-xs font-normal ml-1" style={{ color: 'rgb(var(--text-muted))' }}>left</span>
                </span>
              </div>

              {/* Type Name */}
              <p className="text-sm font-semibold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>
                {lbName}
              </p>

              {/* Kakitangan-style: Entitled | Used | Balance row */}
              {!compact && (
                <div className="grid grid-cols-3 gap-1 mb-2 text-center">
                  <div>
                    <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Entitled</p>
                    <p className="text-xs font-semibold" style={{ color: style.color }}>{entitled}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Used</p>
                    <p className="text-xs font-semibold" style={{ color: 'rgb(var(--text-secondary))' }}>{lb.usedDays}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Remaining</p>
                    <p className="text-xs font-semibold" style={{ color: displayColor }}>{remaining}</p>
                  </div>
                </div>
              )}

              {/* Progress bar */}
              {entitled > 0 && (
                <>
                  <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'rgb(var(--text-muted))' }}>
                    <span>{lb.usedDays} used</span>
                    <span>{entitled} total</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'rgb(var(--bg-surface))' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: displayColor }} />
                  </div>
                </>
              )}

              {/* Carry forward */}
              {lb.carryForwardDays > 0 && !compact && (
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon name="ArrowRightIcon" size={10} style={{ color: style.color }} />
                  <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Carry fwd: <span style={{ color: style.color }}>{lb.carryForwardDays} days</span>
                  </span>
                </div>
              )}

              {/* Adjusted days indicator */}
              {lb.adjustedDays !== 0 && !compact && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: lb.adjustedDays > 0 ? 'rgb(52 211 153)' : 'rgb(248 113 113)' }}>
                    Adjustment: {lb.adjustedDays > 0 ? '+' : ''}{lb.adjustedDays} days
                  </span>
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}

      {/* Apply Leave Button */}
      {!isArchive && !compact && (
        <div className="flex justify-end">
          <Link href="/employee-portal/leave/apply" className="btn-primary flex items-center gap-2 no-underline">
            <Icon name="PlusIcon" size={14} />
            Apply for Leave
          </Link>
        </div>
      )}
    </div>
  );
}