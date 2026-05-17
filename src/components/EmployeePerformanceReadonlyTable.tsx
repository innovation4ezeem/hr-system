import React, { useEffect, useState, useMemo } from 'react';
import { PERFORMANCE_MONTHS, ScoreSection, baseSections } from '@/data/performanceScores';
import { useAppContext } from '@/context/AppContext';
import { buildClientAuthHeaders } from '@/lib/clientAuth';

function sum(values: number[]): number {
  return values.reduce((acc, val) => acc + val, 0);
}

export default function EmployeePerformanceReadonlyTable({
  userId,
  title = 'Performance Score (Read Only)',
}: {
  userId: string;
  title?: string;
}) {
  const { selectedYear, userRole, userId: requesterId, userName, userDepartment } = useAppContext();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const authHeaders = useMemo(() => {
    return buildClientAuthHeaders({
      role: (userRole || 'admin') as any,
      userId: requesterId || '',
      userName: userName || '',
      department: userDepartment || ''
    });
  }, [userRole, requesterId, userName, userDepartment]);

  useEffect(() => {
    let cancelled = false;
    const fetchWorksheet = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/performance-scores?year=${selectedYear}&employees=${userId}`, {
          headers: authHeaders
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data.cellsByEmployee && data.cellsByEmployee[userId]) {
          setActivities(data.cellsByEmployee[userId]);
        }
      } catch (err) {
        console.error('Failed to fetch performance worksheet:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchWorksheet();
    return () => { cancelled = true; };
  }, [userId, selectedYear, authHeaders]);

  const months = PERFORMANCE_MONTHS;

  const sections = useMemo(() => {
    // Start with a clean template
    const template: ScoreSection[] = JSON.parse(JSON.stringify(baseSections));
    
    // If activities is an object (map from cellsByEmployee[userId])
    if (activities && typeof activities === 'object' && !Array.isArray(activities)) {
      const cellMap = activities as Record<string, number>;
      
      template.forEach(section => {
        section.rows.forEach(row => {
          months.forEach((month, monthIdx) => {
            const key = `${row.label}::${month}`;
            if (cellMap[key] !== undefined) {
              row.monthly[monthIdx] = Number(cellMap[key] || 0);
            }
          });
        });
      });
    }

    return template;
  }, [activities]);
  const monthTotals = months.map((_, monthIdx) =>
    sum(sections.flatMap(section => section.rows.map(row => row.monthly[monthIdx] || 0))),
  );
  const firstHalfTotal = sum(monthTotals.slice(0, 6));
  const secondHalfTotal = sum(monthTotals.slice(6, 12));
  const grandTotal = sum(monthTotals);

  if (loading) {
    return (
      <div className="rounded-xl p-8 flex flex-col items-center justify-center gap-3" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <p className="text-xs text-slate-500">Syncing performance data...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{title}</h3>
        <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>Monthly score sheet view. Editing is disabled.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 1260 }}>
          <thead>
            <tr style={{ background: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
              <th className="px-3 py-2 text-left sticky left-0 z-10" style={{ background: 'rgb(var(--bg-elevated))', minWidth: 260, color: 'rgb(var(--text-muted))' }}>Category / Item</th>
              {months.map(month => (
                <th key={month} className="px-2 py-2 text-center" style={{ minWidth: 74, color: 'rgb(var(--text-muted))' }}>{month}</th>
              ))}
              <th className="px-2 py-2 text-center" style={{ minWidth: 72, color: 'rgb(var(--text-muted))' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sections.map(section => {
              const sectionMonthTotals = months.map((_, monthIdx) => sum(section.rows.map(row => row.monthly[monthIdx] || 0)));
              const sectionTotal = sum(sectionMonthTotals);
              return (
                <React.Fragment key={section.title}>
                  <tr style={{ background: 'rgba(79,127,255,0.07)', borderTop: '1px solid rgb(var(--border-subtle))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                    <td className="px-3 py-2 font-semibold sticky left-0 z-10" style={{ background: 'rgba(79,127,255,0.07)', color: 'rgb(var(--text-primary))' }}>{section.title}</td>
                    {months.map(month => <td key={`${section.title}-${month}`} className="px-2 py-2 text-center" style={{ color: 'rgb(var(--text-muted))' }}>-</td>)}
                    <td className="px-2 py-2 text-center" style={{ color: 'rgb(var(--text-muted))' }}>-</td>
                  </tr>

                  {section.rows.map((row, idx) => (
                    <tr key={`${section.title}-${row.label}`} style={{ borderBottom: '1px solid rgb(var(--border))', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td className="px-3 py-2 sticky left-0 z-10" style={{ color: 'rgb(var(--text-secondary))', background: idx % 2 === 0 ? 'rgb(var(--bg-card))' : 'rgb(var(--bg-surface))' }}>{row.label}</td>
                      {row.monthly.map((val, monthIdx) => (
                        <td key={`${row.label}-${monthIdx}`} className="px-2 py-2 text-center font-mono" style={{ color: 'rgb(var(--text-primary))', fontVariantNumeric: 'tabular-nums' }}>{val}</td>
                      ))}
                      <td className="px-2 py-2 text-center font-semibold font-mono" style={{ color: 'rgb(var(--text-primary))', fontVariantNumeric: 'tabular-nums' }}>{sum(row.monthly)}</td>
                    </tr>
                  ))}

                  <tr style={{ background: 'rgba(250,204,21,0.16)', borderTop: '1px solid rgba(250,204,21,0.35)', borderBottom: '1px solid rgba(250,204,21,0.35)' }}>
                    <td className="px-3 py-2 font-semibold sticky left-0 z-10" style={{ background: 'rgba(250,204,21,0.16)', color: 'rgb(var(--text-primary))' }}>{section.title} Subtotal</td>
                    {sectionMonthTotals.map((val, monthIdx) => (
                      <td key={`${section.title}-subtotal-${monthIdx}`} className="px-2 py-2 text-center font-mono" style={{ color: 'rgb(var(--text-primary))', fontVariantNumeric: 'tabular-nums' }}>{val}</td>
                    ))}
                    <td className="px-2 py-2 text-center font-semibold font-mono" style={{ color: 'rgb(var(--text-primary))', fontVariantNumeric: 'tabular-nums' }}>{sectionTotal}</td>
                  </tr>
                </React.Fragment>
              );
            })}

            <tr style={{ background: 'rgba(79,127,255,0.1)', borderTop: '2px solid rgba(79,127,255,0.35)' }}>
              <td className="px-3 py-2 font-semibold sticky left-0 z-10" style={{ background: 'rgba(79,127,255,0.1)', color: 'rgb(var(--text-primary))' }}>Individual - Total Month</td>
              {monthTotals.map((val, idx) => (
                <td key={`month-total-${idx}`} className="px-2 py-2 text-center font-semibold font-mono" style={{ color: 'rgb(79 127 255)', fontVariantNumeric: 'tabular-nums' }}>{val}</td>
              ))}
              <td className="px-2 py-2 text-center font-bold font-mono" style={{ color: 'rgb(79 127 255)', fontVariantNumeric: 'tabular-nums' }}>{grandTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border-t" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
        <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)' }}>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>(Jan - June)</p>
          <p className="text-lg font-bold font-mono" style={{ color: 'rgb(248 113 113)', fontVariantNumeric: 'tabular-nums' }}>{firstHalfTotal}</p>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.35)' }}>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>(July - Dec)</p>
          <p className="text-lg font-bold font-mono" style={{ color: 'rgb(6 182 212)', fontVariantNumeric: 'tabular-nums' }}>{secondHalfTotal}</p>
        </div>
      </div>
    </div>
  );
}
