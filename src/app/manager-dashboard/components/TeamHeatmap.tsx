"use client";
import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { normalizeCategory, round2 } from '@/data/activityScoreRules';
import { useAppContext } from '@/context/AppContext';

interface Employee {
  id: string;
  name: string;
  role: string;
  dept: string;
  kpiScore: number;
  taskRate: number;
  quality: number;
  participation: number;
  popularity: number;
  overall: number;
  isProvisional?: boolean;
  performance60?: number;
  status: 'active' | 'probation' | 'intern';
  tenure: string;
  labels?: {
    performance: string;
    participation: string;
    popularity: string;
    kpi: string;
    task: string;
    quality: string;
    weights: { perf: number; part: number; pop: number };
  };
}

interface TeamHeatmapProps {
  compact?: boolean;
  onCellClick?: () => void;
  onRankingClick?: () => void;
  departmentScope?: string | null;
  thresholds?: { high: number; mid: number };
  excludeHod?: boolean;
  periodType?: 'monthly' | 'quarterly' | 'yearly';
  periodNo?: number;
}


export default function TeamHeatmap({ 
  compact = false, 
  onCellClick, 
  onRankingClick, 
  departmentScope = null, 
  thresholds: customThresholds, 
  excludeHod = false,
  periodType = 'yearly',
  periodNo = 1
}: TeamHeatmapProps) {
  const { selectedYear, userRole, userDepartment, buildAuthHeaders, userId } = useAppContext();
  const [filterDept, setFilterDept] = useState('All');

  const [filterRole, setFilterRole] = useState<'All' | 'Employee' | 'HOD'>('All');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [selectedActivityMonth, setSelectedActivityMonth] = useState<string>('All');
  const [pillarFilter, setPillarFilter] = useState<'All' | 'Performance' | 'Participation' | 'Popularity'>('All');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [systemWeights, setSystemWeights] = useState<any>(null);
  const systemWeightsRef = React.useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const thresholds = customThresholds || { high: 80, mid: 50 };

  const getHeatBg = (score: number) => {
    if (score >= thresholds.high) return { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', text: 'rgb(52 211 153)' };
    if (score >= thresholds.mid) return { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', text: 'rgb(251 191 36)' };
    return { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', text: 'rgb(248 113 113)' };
  };

  // Fetch Employees, Scores, and all activities for the year
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const authHeaders = buildAuthHeaders();
        const [scoresRes, usersRes, activitiesRes, settingsRes] = await Promise.all([
          fetch(`/api/performance-management?mode=scores&periodYear=${selectedYear}&periodType=${periodType}&periodNo=${periodNo}`, { headers: authHeaders }),
          fetch('/api/users', { headers: authHeaders }),
          fetch(`/api/activity-scores?year=${selectedYear}&periodType=${periodType}&periodNo=${periodNo}`, { headers: authHeaders }),
          fetch('/api/system-settings?mode=weights', { headers: authHeaders })
        ]);

        const scoresData = await scoresRes.json();
        const usersData = await usersRes.json();
        const activitiesData = await activitiesRes.json();
        const settingsData = await settingsRes.json();

        setSystemWeights(settingsData.weights);
        systemWeightsRef.current = settingsData.weights;
        const liveWeights = settingsData.weights;

        if (!scoresData.scores || !usersData.users) {
          setEmployees([]);
          return;
        }

        const scoresMap = new Map(scoresData.scores.map((s: any) => [s.employeeId, s]));
        const allActivities = Array.isArray(activitiesData?.entries) ? activitiesData.entries : [];

        // Group activities by employee and pillar for fallback
        const activitySummaryMap = new Map();
        allActivities.forEach((a: any) => {
          if (!a.assignedToId) return;

          const key = a.assignedToId;
          const current = activitySummaryMap.get(key) || { Performance: 0, Participation: 0, Popularity: 0 };

          // Use normalizeCategory for robust pillar mapping
          const pillar = normalizeCategory(a.category || a.pillar || 'Performance');
          const score = Number(a.score || a.score_value || 0);

          if (current.hasOwnProperty(pillar)) {
            current[pillar] += score;
            activitySummaryMap.set(key, current);
          }
        });

        const mapped: Employee[] = usersData.users
          .filter((u: any) => {
            const uRole = u.role?.toLowerCase() || '';
            const isAdmin = uRole === 'admin';
            const isDirector = uRole === 'director';
            const isHod = uRole === 'hod';
            
            if (isAdmin) return false;
            if (isDirector) return false;
            if (u.id === userId) return false;
            
            if (excludeHod && isHod) return false;
            if (userRole === 'hod') return u.dept === userDepartment;
            return true;
          })
          .map((u: any) => {
            const s: any = scoresMap.get(u.id) || {};
            const details = s.formulaSnapshot?.detail || {};
            const userActivities = allActivities.filter((a: any) => a.assignedToId === u.id);

            const weights = s.performanceWeights || liveWeights || {
              performanceWeight: 60,
              competencyWeight: 25,
              attitudeWeight: 15,
              kpiWithinPerformanceWeight: 40,
              taskWithinPerformanceWeight: 30,
              qualityWithinPerformanceWeight: 30,
              performanceLabel: 'Performance',
              participationLabel: 'Participation',
              popularityLabel: 'Popularity',
              kpiLabel: 'KPI',
              taskLabel: 'Tasks',
              qualityLabel: 'Quality',
              kpiParent: 'Performance',
              taskParent: 'Performance',
              qualityParent: 'Performance'
            };

            const kpiP = weights.kpiParent || 'Performance';
            const taskP = weights.taskParent || 'Performance';
            const qualityP = weights.qualityParent || 'Performance';

            let perfBase = 0;
            let rawPart = 0;
            let rawPop = 0;
            let weightedTotal = 0;

            userActivities.forEach((a: any) => {
              const cat = String(a.category || '').toLowerCase();
              const score = Number(a.score || 0);
              const bucket = String(a.scoreBucket || '').toLowerCase();

              // Check Participation
              if (cat.includes('participation') || cat.includes('activities') || cat.includes('play') || cat.includes('learn') || cat.includes(String(weights.participationLabel || '').toLowerCase())) {
                rawPart += score;
                weightedTotal += score * (weights.competencyWeight / 100);
              } 
              // Check Popularity
              else if (cat.includes('popularity') || cat.includes('sticker') || cat.includes('voting') || cat.includes(String(weights.popularityLabel || '').toLowerCase())) {
                rawPop += score;
                weightedTotal += score * (weights.attitudeWeight / 100);
              } 
              // Performance Subcategories
              else {
                let bW = 0;
                let isPerf = false;

                if (bucket.includes('kpi') || bucket.includes(String(weights.kpiLabel || '').toLowerCase())) {
                    bW = weights.kpiWithinPerformanceWeight;
                    if (kpiP === weights.performanceLabel) isPerf = true;
                } else if (bucket.includes('task') || bucket.includes(String(weights.taskLabel || '').toLowerCase())) {
                    bW = weights.taskWithinPerformanceWeight;
                    if (taskP === weights.performanceLabel) isPerf = true;
                } else if (bucket.includes('quality') || bucket.includes(String(weights.qualityLabel || '').toLowerCase())) {
                    bW = weights.qualityWithinPerformanceWeight;
                    if (qualityP === weights.performanceLabel) isPerf = true;
                } else {
                    bW = 100;
                    isPerf = true;
                }

                const pComp = score * (bW / 100);
                if (isPerf) perfBase += pComp;
                
                // Add to weighted total based on parent
                const parent = isPerf ? weights.performanceLabel : (bucket.includes('kpi') ? kpiP : (bucket.includes('task') ? taskP : qualityP));
                if (parent === weights.performanceLabel) weightedTotal += pComp * (weights.performanceWeight / 100);
                else if (parent === weights.participationLabel) weightedTotal += pComp * (weights.competencyWeight / 100);
                else if (parent === weights.popularityLabel) weightedTotal += pComp * (weights.attitudeWeight / 100);
              }
            });

            // A record is "saved" if any pillar score was stored (finalScore may still be 0 if not recalculated)
            const hasSavedScore = !!(s.performance60 > 0 || s.participation25 > 0 || s.popularity15 > 0 || s.finalScore > 0);

            // Compute the outer-card total from saved pillar components, or fallback to activity aggregation
            const savedOverall = s.finalScore > 0
              ? s.finalScore
              : round2((s.performance60 || 0) + (s.participation25 || 0) + (s.popularity15 || 0));

            // Fallback: use the pre-computed activity summary map (from activity-scores API)
            const actSummary = activitySummaryMap.get(u.id) || { Performance: 0, Participation: 0, Popularity: 0 };
            const fallbackPerf = actSummary.Performance;
            const fallbackPart = actSummary.Participation;
            const fallbackPop = actSummary.Popularity;
            const fallbackOverall = round2(
              (fallbackPerf * (weights.performanceWeight || 60) / 100) +
              (fallbackPart * (weights.competencyWeight || 25) / 100) +
              (fallbackPop * (weights.attitudeWeight || 15) / 100)
            );

            let tenure = 'New';
            if (u.join_date) {
              const join = new Date(u.join_date);
              if (!Number.isNaN(join.getTime())) {
                const now = new Date();
                let yrs = now.getFullYear() - join.getFullYear();
                let mos = now.getMonth() - join.getMonth();
                if (mos < 0) { yrs--; mos += 12; }
                tenure = `${yrs}y ${mos}m`;
              }
            }

            return {
              id: u.id,
              name: u.name,
              role: u.role || 'Staff',
              dept: u.dept || 'General',
              kpiScore: hasSavedScore ? Math.min(100, round2((s.performance60 || 0) / 0.6)) : fallbackPerf,
              taskRate: hasSavedScore ? (details.tasksScore || 0) : 0,
              quality: hasSavedScore ? (details.qualityScore || 0) : 0,
              participation: hasSavedScore ? Math.min(100, round2((s.participation25 || 0) / 0.25)) : fallbackPart,
              popularity: hasSavedScore ? Math.min(100, round2((s.popularity15 || 0) / 0.15)) : fallbackPop,
              overall: hasSavedScore ? savedOverall : fallbackOverall,
              isProvisional: !hasSavedScore,
              performance60: hasSavedScore ? (s.performance60 || 0) : round2(fallbackPerf * (weights.performanceWeight || 60) / 100),
              participation25: hasSavedScore ? (s.participation25 || 0) : round2(fallbackPart * (weights.competencyWeight || 25) / 100),
              popularity15: hasSavedScore ? (s.popularity15 || 0) : round2(fallbackPop * (weights.attitudeWeight || 15) / 100),
              status: u.status === 'Intern' ? 'intern' : u.status === 'Probation' ? 'probation' : 'active',
              tenure,
              labels: {
                performance: weights.performanceLabel,
                participation: weights.participationLabel,
                popularity: weights.popularityLabel,
                kpi: weights.kpiLabel,
                task: weights.taskLabel,
                quality: weights.qualityLabel,
                weights: { perf: weights.performanceWeight, part: weights.competencyWeight, pop: weights.attitudeWeight }
              }
            } as any;
          });

        setEmployees(mapped);
      } catch (err) {
        console.error('Heatmap fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedYear, periodType, periodNo]);

  useEffect(() => {
    if (!selectedEmp) { setActivities([]); return; }
    const fetchActivities = async () => {
      try {
        const authHeaders = buildAuthHeaders();
        const res = await fetch(`/api/performance-management?mode=activities&employeeId=${encodeURIComponent(selectedEmp.id)}&year=${selectedYear}`, { headers: authHeaders });
        const data = await res.json();
        if (data.activities) {
          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          setActivities(data.activities.map((a: any) => ({ activity: a.activityName, category: a.category, score: a.score, scoreBucket: a.scoreBucket, date: new Date(a.activityDate).toLocaleDateString(), month: monthNames[new Date(a.activityDate).getMonth()], pillar: a.pillar })));
        }
      } catch (err) { console.error('Activities fetch error:', err); }
    };
    fetchActivities();
  }, [selectedEmp, selectedYear]);

  const depts = ['All', 'Operations', 'HR', 'Finance', 'IT'];
  const roles = excludeHod ? ['All', 'Employee'] : ['All', 'Employee', 'HOD'];
  const allowedEmployees = departmentScope ? employees.filter(e => e.dept === departmentScope) : employees;
  const filtered = allowedEmployees.filter(e => filterDept === 'All' || e.dept === filterDept).filter(e => filterRole === 'All' || e.role.toLowerCase() === filterRole.toLowerCase());
  const displayed = compact ? filtered.slice(0, 6) : filtered;
  const greenCount = filtered.filter(e => e.overall >= thresholds.high).length;
  const amberCount = filtered.filter(e => e.overall >= thresholds.mid && e.overall < thresholds.high).length;
  const redCount = filtered.filter(e => e.overall < thresholds.mid).length;

  const handleCellClick = (emp: Employee) => {
    if (compact && onCellClick) { onCellClick(); return; }
    setSelectedEmp(emp);
    setPillarFilter('All');
  };

  return (
    <>
      <div className="rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Team Performance Heatmap</h2>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs flex items-center gap-1" style={{ color: 'rgb(52 211 153)' }}><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> {greenCount} Green ≥{thresholds.high}%</span>
              <span className="text-xs flex items-center gap-1" style={{ color: 'rgb(251 191 36)' }}><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {amberCount} Amber {thresholds.mid}–{thresholds.high - 1}%</span>
              <span className="text-xs flex items-center gap-1" style={{ color: 'rgb(248 113 113)' }}><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> {redCount} Red &lt;{thresholds.mid}%</span>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            <p className="text-sm font-medium animate-pulse" style={{ color: 'rgb(var(--text-muted))' }}>Loading Performance Data...</p>
          </div>
        )}

        {!isLoading && displayed.length === 0 && (
          <div className="p-20 text-center">
            <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>No performance records found for {selectedYear}.</p>
          </div>
        )}

        {!isLoading && displayed.length > 0 && (
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
            {displayed.map(emp => {
              const heat = getHeatBg(emp.overall);
              return (
                <div key={emp.id} className="rounded-xl p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg relative" style={{ background: heat.bg, border: `1px solid ${heat.border}` }} onClick={() => handleCellClick(emp)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'rgba(var(--bg-page), 0.2)', color: heat.text }}>{emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: emp.status === 'probation' ? 'rgba(248,113,113,0.15)' : emp.status === 'intern' ? 'rgba(167,139,250,0.15)' : 'rgba(var(--text-muted), 0.1)', color: emp.status === 'probation' ? 'rgb(248 113 113)' : emp.status === 'intern' ? 'rgb(167 139 250)' : 'rgb(var(--text-secondary))' }}>{emp.status === 'probation' ? 'Prob' : emp.status === 'intern' ? 'Intern' : emp.tenure}</span>
                      {emp.isProvisional && (
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-600/10 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-600/20 dark:border-blue-500/20 uppercase tracking-tighter">Provisional</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold truncate mb-0.5" style={{ color: 'rgb(var(--text-primary))' }}>{emp.name}</p>
                  <p className="text-xs truncate mb-3" style={{ color: 'rgb(var(--text-muted))' }}>{emp.role}</p>
                  <div className="text-2xl font-bold font-mono mb-2" style={{ color: heat.text, fontVariantNumeric: 'tabular-nums' }}>{emp.overall}%</div>
                  <div className="space-y-1.5">
                    <MetricBar label={emp.labels?.performance?.toUpperCase() || "PERF"} val={emp.kpiScore} color={heat.text} />
                    <MetricBar label={emp.labels?.participation?.toUpperCase() || "PART"} val={emp.participation} color={heat.text} />
                    <MetricBar label={emp.labels?.popularity?.toUpperCase() || "POP"} val={emp.popularity} color={heat.text} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in max-h-[85vh] flex flex-col" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border))' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgb(var(--border-subtle))', background: 'rgb(var(--bg-elevated))' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: `${getHeatBg(selectedEmp.overall).bg}`, color: getHeatBg(selectedEmp.overall).text, border: `1px solid ${getHeatBg(selectedEmp.overall).border}` }}>{selectedEmp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{selectedEmp.name}</p>
                  <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{selectedEmp.role} · {selectedEmp.dept}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold font-mono" style={{ color: getHeatBg(selectedEmp.overall).text }}>
                  {selectedEmp.overall}%
                </span>
                <button onClick={() => setSelectedEmp(null)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'rgb(var(--text-secondary))' }}>
                  <Icon name="XMarkIcon" size={18} />
                </button>
              </div>
            </div>

            {/* Score Summary Grid */}
            <div className="grid grid-cols-3 gap-3 px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
              <StatCard 
                label={`${selectedEmp.labels?.performance || 'PERFORMANCE'} (${selectedEmp.labels?.weights?.perf || 60}%)`} 
                val={round2((selectedEmp as any).performance60 || 0)} 
                sub={(() => {
                  const w = systemWeightsRef.current || systemWeights;
                  if (!w) return `${selectedEmp.labels?.kpi || 'KPI'} 50% / ${selectedEmp.labels?.task || 'Tasks'} 25% / ${selectedEmp.labels?.quality || 'Quality'} 25%`;
                  const parts = [];
                  if (!w.kpiParent || w.kpiParent === (w.performanceLabel || 'Performance')) parts.push(`${w.kpiLabel || 'KPI'} ${w.kpiWithinPerformanceWeight || 50}%`);
                  if (!w.taskParent || w.taskParent === (w.performanceLabel || 'Performance')) parts.push(`${w.taskLabel || 'Tasks'} ${w.taskWithinPerformanceWeight || 25}%`);
                  if (!w.qualityParent || w.qualityParent === (w.performanceLabel || 'Performance')) parts.push(`${w.qualityLabel || 'Quality'} ${w.qualityWithinPerformanceWeight || 25}%`);
                  return parts.length > 0 ? parts.join(' / ') : 'KPI 50% / Tasks 25% / Quality 25%';
                })()}
                color={getHeatBg(selectedEmp.overall).text}
                type="Performance"
                isActive={pillarFilter === 'Performance'}
                onClick={() => setPillarFilter(pillarFilter === 'Performance' ? 'All' : 'Performance')}
              />
              <StatCard 
                label={`${selectedEmp.labels?.participation || 'PARTICIPATION'} (${selectedEmp.labels?.weights?.part || 25}%)`} 
                val={round2((selectedEmp as any).participation25 || 0)} 
                sub={(() => {
                  const w = systemWeightsRef.current || systemWeights;
                  if (!w) return 'Engagement';
                  const parts = [];
                  if (w.kpiParent === (w.participationLabel || 'Participation')) parts.push(`${w.kpiLabel || 'KPI'} ${w.kpiWithinPerformanceWeight || 50}%`);
                  if (w.taskParent === (w.participationLabel || 'Participation')) parts.push(`${w.taskLabel || 'Tasks'} ${w.taskWithinPerformanceWeight || 25}%`);
                  if (w.qualityParent === (w.participationLabel || 'Participation')) parts.push(`${w.qualityLabel || 'Quality'} ${w.qualityWithinPerformanceWeight || 25}%`);
                  return parts.length > 0 ? parts.join(' / ') : 'Engagement';
                })()}
                color={getHeatBg(selectedEmp.overall).text}
                type="Participation"
                isActive={pillarFilter === 'Participation'}
                onClick={() => setPillarFilter(pillarFilter === 'Participation' ? 'All' : 'Participation')}
              />
              <StatCard 
                label={`${selectedEmp.labels?.popularity || 'POPULARITY'} (${selectedEmp.labels?.weights?.pop || 15}%)`} 
                val={round2((selectedEmp as any).popularity15 || 0)} 
                sub={(() => {
                  const w = systemWeightsRef.current || systemWeights;
                  if (!w) return 'Peer Vote';
                  const parts = [];
                  if (w.kpiParent === (w.popularityLabel || 'Popularity')) parts.push(`${w.kpiLabel || 'KPI'} ${w.kpiWithinPerformanceWeight || 50}%`);
                  if (w.taskParent === (w.popularityLabel || 'Popularity')) parts.push(`${w.taskLabel || 'Tasks'} ${w.taskWithinPerformanceWeight || 25}%`);
                  if (w.qualityParent === (w.popularityLabel || 'Popularity')) parts.push(`${w.qualityLabel || 'Quality'} ${w.qualityWithinPerformanceWeight || 25}%`);
                  return parts.length > 0 ? parts.join(' / ') : 'Peer Vote';
                })()}
                color={getHeatBg(selectedEmp.overall).text}
                type="Popularity"
                isActive={pillarFilter === 'Popularity'}
                onClick={() => setPillarFilter(pillarFilter === 'Popularity' ? 'All' : 'Popularity')}
              />
            </div>

            {/* Details */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'rgb(var(--text-primary))' }}>
                  {pillarFilter === 'All' ? 'Recent Activities & Subtasks' : `${pillarFilter} Activities`}
                  {pillarFilter !== 'All' && (
                    <button onClick={() => setPillarFilter('All')} className="text-[10px] font-bold text-blue-400 hover:underline">Show All</button>
                  )}
                </h4>
                {selectedEmp && (
                  <select
                    value={selectedActivityMonth}
                    onChange={e => setSelectedActivityMonth(e.target.value)}
                    className="input-base text-xs"
                    style={{ width: 100 }}
                  >
                    <option value="All">All Months</option>
                    {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-2">
                {activities
                  .filter(activity => selectedActivityMonth === 'All' || activity.month === selectedActivityMonth)
                  .filter(activity => pillarFilter === 'All' || activity.pillar === pillarFilter)
                  .length === 0 ? (
                  <div className="py-10 text-center">
                    <p style={{ color: 'rgb(var(--text-muted))' }} className="text-xs italic">
                      No {pillarFilter === 'All' ? '' : `${pillarFilter.toLowerCase()} `}activities found for the selected filters.
                    </p>
                  </div>
                ) : (
                  activities
                    .filter(activity => selectedActivityMonth === 'All' || activity.month === selectedActivityMonth)
                    .filter(activity => pillarFilter === 'All' || activity.pillar === pillarFilter)
                    .map((activity, idx) => (
                      <div key={idx} className="rounded-lg p-3 text-xs animate-slide-up" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border))' }}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1">
                            <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{activity.activity}</p>
                            <p style={{ color: 'rgb(var(--text-muted))' }}>{activity.date} · {activity.month}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="px-2 py-1 rounded font-bold uppercase tracking-tighter"
                              style={{
                                background: activity.pillar === 'Performance' ? 'rgba(79, 127, 255, 0.1)' : activity.pillar === 'Participation' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(167, 139, 250, 0.1)',
                                color: activity.pillar === 'Performance' ? 'rgb(79 127 255)' : activity.pillar === 'Participation' ? 'rgb(52 211 153)' : 'rgb(167 139 250)',
                                fontSize: '9px'
                              }}>
                              {activity.category}
                            </span>
                            {activity.score > 0 && (
                              <span className="font-mono font-bold text-blue-400">+{activity.score}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MetricBar({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium w-24 flex-shrink-0" style={{ color: 'rgb(var(--text-muted))' }}>{label}</span>
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, val)}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono w-8 text-right" style={{ color, fontVariantNumeric: 'tabular-nums' }}>{Math.round(val)}</span>
    </div>
  );
}

function StatCard({ label, val, sub, color, isActive, onClick, type }: any) {
  const heat = color ? { text: color, bg: `${color}15`, border: `${color}30` } : { text: 'white', bg: 'white/5', border: 'white/10' };
  
  return (
    <button
      onClick={onClick}
      className={`rounded-xl p-3 text-center transition-all duration-200 border-2 ${isActive ? 'scale-[1.05] shadow-lg' : 'opacity-70 hover:opacity-100'}`}
      style={{
        background: heat.bg,
        borderColor: isActive ? heat.text : heat.border,
      }}
    >
      <p className="text-lg font-bold font-mono" style={{ color: heat.text }}>{val}%</p>
      <p className="text-[10px] font-bold uppercase tracking-tight" style={{ color: 'rgb(var(--text-primary))' }}>{label}</p>
      <p className="text-[9px]" style={{ color: 'rgb(var(--text-muted))' }}>{sub}</p>
      {isActive && (
        <div className="mt-1 flex justify-center">
          <div className="w-1 h-1 rounded-full bg-current" style={{ color: heat.text }} />
        </div>
      )}
    </button>
  );
}

