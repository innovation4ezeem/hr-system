'use client';
'use client';
import React, { useState, useMemo, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAppContext } from '@/context/AppContext';
import { buildClientAuthHeaders } from '@/lib/clientAuth';

interface PenaltyRecord {
  id: string;
  date: string;
  year: number;
  mistake: string;
  level: 'Warning' | 'Minor' | 'Major';
  category: string;
  resolved: boolean;
}

const levelStyle: Record<string, { bg: string; text: string }> = {
  'Warning': { bg: 'rgba(251,191,36,0.1)', text: 'rgb(251 191 36)' },
  'Minor': { bg: 'rgba(248,113,113,0.1)', text: 'rgb(248 113 113)' },
  'Major': { bg: 'rgba(248,113,113,0.2)', text: 'rgb(240 80 80)' },
};

export default function MyPenaltyHistory() {
  const { userId, userRole, userName, userDepartment } = useAppContext();
  const [selectedYear, setSelectedYear] = useState<number | 'All'>(new Date().getFullYear());
  const [penalties, setPenalties] = useState<PenaltyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPenalties = async () => {
      if (!userId) return;
      try {
        setLoading(true);
        const authHeaders = buildClientAuthHeaders({
          role: userRole as any,
          userId,
          userName,
          department: userDepartment
        });
        
        const res = await fetch(`/api/performance-management?mode=penalties&employeeId=${encodeURIComponent(userId)}`, {
          headers: authHeaders
        });
        const data = await res.json();
        
        if (res.ok && data.penalties) {
          const mapped: PenaltyRecord[] = data.penalties.map((p: any) => ({
            id: p.id,
            date: p.penaltyDate,
            year: p.penaltyDate ? new Date(p.penaltyDate).getFullYear() : new Date().getFullYear(),
            mistake: p.reason,
            level: p.severity === 'warning' ? 'Warning' : p.severity === 'minor' ? 'Minor' : 'Major',
            category: p.penaltyTypeCode,
            resolved: p.status === 'resolved'
          }));
          setPenalties(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch penalties:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPenalties();
  }, [userId]);

  const availableYears = useMemo(() => {
    return Array.from(new Set(penalties.map(p => p.year))).sort((a, b) => b - a);
  }, [penalties]);
  
  const filteredPenalties = useMemo(() => {
    return selectedYear === 'All' 
      ? penalties 
      : penalties.filter(p => p.year === selectedYear);
  }, [penalties, selectedYear]);


  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>My Penalty History</h3>
            <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
              View only — contact your HOD to dispute any record
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select 
              className="input-base text-xs px-2.5 py-1" 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'All' ? 'All' : Number(e.target.value))}
            >
              <option value="All">All Years</option>
              {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
        </div>
      </div>

      {filteredPenalties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Icon name="ShieldCheckIcon" size={40} className="text-emerald-400 mb-3 opacity-50" />
          <p className="text-base font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>No penalty records</p>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>Your conduct record is clean. Keep it up!</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
          {filteredPenalties.map(pen => {
            const ls = levelStyle[pen.level] || levelStyle['Warning'];
            return (
              <div key={pen.id} className="px-5 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono" style={{ color: 'rgb(var(--text-secondary))', fontVariantNumeric: 'tabular-nums' }}>{pen.date}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: ls.bg, color: ls.text }}>
                        {pen.level}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(167,139,250,0.1)', color: 'rgb(167 139 250)' }}>
                        {pen.category}
                      </span>
                      {pen.resolved && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'rgb(52 211 153)' }}>
                          <Icon name="CheckCircleIcon" size={12} /> Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{pen.mistake}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="px-5 py-3 border-t" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
        <div className="flex items-center gap-4 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
          <span>Total records: <span style={{ color: 'rgb(var(--text-secondary))' }}>{filteredPenalties.length}</span></span>
        </div>
      </div>
    </div>
  );
}
