'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { ACTIVITY_CATEGORIES, ACTIVITY_SCORE_BUCKETS, bucketSectionTitle, normalizeCategory, normalizeScoreBucket, round2 } from '@/data/activityScoreRules';
import { useAppContext } from '@/context/AppContext';

const sum = (values: number[]) => values.reduce((acc, val) => acc + val, 0);

const RANKING_FILTER_MAP: Record<string, string> = {
  'Accountability': 'Voting Form - Accountability (being responsible towards own responsibility)',
  'Sharpen The Saw (Continuous Learner)': 'Voting Form - Continuous learner (sharpen the saw)',
  'Innovative & Creativity': 'Voting Form - Innovative & Creativity',
  'Collaboration (Effective Collaborator)': 'Voting Form - Effective Collaborator',
  'Initiative': 'Voting Form - Attitude (Initiative, Proactive, Voluntary)',
};

type Employee = {
  id: string;
  name: string;
  dept: string;
  role?: string;
};

type ActivityEntry = {
  id: string;
  assignedToId: string;
  assignedToName: string;
  category: string;
  scoreBucket: string;
  score: number;
  date: string;
  performanceWeights?: any;
};

type ViewMode = 'ranking';

type EmployeeScore = Employee & {
  categoryScores: Record<string, number>;
  bucketScores: Record<string, number>;
  total: number;
  perfBase: number;
  h1: number;
  h2: number;
  rank?: number;
};

interface MasterboardPanelProps {
  externalSearch?: string;
  externalStartDate?: string;
  externalEndDate?: string;
  externalRankingFilter?: string;
  hideFilters?: boolean;
  periodType?: 'monthly' | 'quarterly' | 'yearly';
  periodNo?: number;
}

export default function MasterboardPanel({
  externalSearch,
  externalStartDate,
  externalEndDate,
  externalRankingFilter,
  hideFilters = false,
  periodType = 'yearly',
  periodNo = 1
}: MasterboardPanelProps) {
  const { selectedYear, buildAuthHeaders } = useAppContext();

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [officialScores, setOfficialScores] = useState<any[]>([]);
  const [users, setUsers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('ranking');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedBucket, setSelectedBucket] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [weights, setWeights] = useState<any>(null);
  const [dynamicBuckets, setDynamicBuckets] = useState<string[]>([]);
  const [bucketToCategory, setBucketToCategory] = useState<Record<string, string>>({});
  const [localRankingFilter, setLocalRankingFilter] = useState('All Categories (Total)');

  useEffect(() => {
    const currentStartDate = externalStartDate !== undefined ? externalStartDate : startDate;
    const currentEndDate = externalEndDate !== undefined ? externalEndDate : endDate;

    const fetchData = async () => {
      setLoading(true);
      try {
        const authHeaders = buildAuthHeaders();
        const queryParams = new URLSearchParams();
        queryParams.append('year', String(selectedYear));
        queryParams.append('periodType', periodType);
        queryParams.append('periodNo', String(periodNo));
        if (currentStartDate) queryParams.append('startDate', currentStartDate);
        if (currentEndDate) queryParams.append('endDate', currentEndDate);
        
        const [entriesRes, scoresRes, usersRes, settingsRes, marksRes] = await Promise.all([
          fetch(`/api/activity-scores?${queryParams.toString()}`, { headers: authHeaders }),
          fetch(`/api/performance-management?mode=scores&periodYear=${selectedYear}&periodType=${periodType}&periodNo=${periodNo}`, { headers: authHeaders }),
          fetch('/api/users', { headers: authHeaders }),
          fetch('/api/system-settings?mode=weights', { headers: authHeaders }),
          fetch('/api/performance-management?mode=standard-marks', { headers: authHeaders }),
        ]);

        const entriesData = await entriesRes.json();
        const scoresData = await scoresRes.json();
        const usersData = await usersRes.json();
        const settingsData = await settingsRes.json();
        const marksData = await marksRes.json();

        const customBuckets = Object.keys(marksData.standardMarks || {});
        setDynamicBuckets(Array.from(new Set([...ACTIVITY_SCORE_BUCKETS, ...customBuckets])));
        
        const mapping: Record<string, string> = { ...marksData.bucketCategories };
        ACTIVITY_SCORE_BUCKETS.forEach(b => {
            if (!mapping[b]) mapping[b] = bucketSectionTitle(b);
        });
        setBucketToCategory(mapping);

        setEntries(entriesData.entries || []);
        setOfficialScores(scoresData.scores || []);
        setUsers(
          (usersData.users || [])
            .filter((u: any) => u.role !== 'admin')
            .map((u: any) => ({ 
              id: u.id, 
              name: u.name ? decodeURIComponent(u.name) : 'Unknown', 
              dept: u.dept,
              role: u.role 
            }))
        );
        if (settingsData.weights) {
          setWeights(settingsData.weights);
        }
      } catch (error) {
        toast.error('Failed to load masterboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate, externalStartDate, externalEndDate, selectedYear, periodType, periodNo]);

  const scores = useMemo(() => {
    const map: Record<string, EmployeeScore> = {};

    users.forEach(user => {
      map[user.id] = {
        ...user,
        categoryScores: {},
        bucketScores: {},
        total: 0,
        perfBase: 0,
        h1: 0,
        h2: 0,
      };
    });

    entries.forEach(entry => {
      const empId = entry.assignedToId;
      if (!empId || !map[empId]) return;

      const cat = normalizeCategory(entry.category);
      const bucket = normalizeScoreBucket(entry.scoreBucket, cat);
      const score = Number(entry.score) || 0;
      
      const defaultWeights = {
        performanceWeight: 60,
        competencyWeight: 25,
        attitudeWeight: 15,
        kpiWithinPerformanceWeight: 50,
        taskWithinPerformanceWeight: 25,
        qualityWithinPerformanceWeight: 25,
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

      const entryWeights = entry.performanceWeights || weights || defaultWeights;
      const perfLabel = entryWeights.performanceLabel || 'Performance';
      const partLabel = entryWeights.participationLabel || 'Participation';
      const popLabel = entryWeights.popularityLabel || 'Popularity';
      
      const kpiParent = entryWeights.kpiParent || 'Performance';
      const taskParent = entryWeights.taskParent || 'Performance';
      const qualParent = entryWeights.qualityParent || 'Performance';

      const bucketLower = bucket.toLowerCase();
      
      // Calculate contributions just like Heatmap fallback
      if (cat === partLabel || cat === 'Participation') {
        const contrib = score * (entryWeights.competencyWeight / 100);
        map[empId].categoryScores['Participation'] = (map[empId].categoryScores['Participation'] || 0) + contrib;
        map[empId].total += contrib;
      } else if (cat === popLabel || cat === 'Popularity') {
        const contrib = score * (entryWeights.attitudeWeight / 100);
        map[empId].categoryScores['Popularity'] = (map[empId].categoryScores['Popularity'] || 0) + contrib;
        map[empId].total += contrib;
      } else {
        // Performance or others
        let bW = 100;
        let parent = perfLabel;

        if (bucketLower.includes('kpi') || bucketLower.includes(String(entryWeights.kpiLabel || 'kpi').toLowerCase())) {
          bW = entryWeights.kpiWithinPerformanceWeight || 50;
          parent = kpiParent;
        } else if (bucketLower.includes('task') || bucketLower.includes(String(entryWeights.taskLabel || 'task').toLowerCase())) {
          bW = entryWeights.taskWithinPerformanceWeight || 25;
          parent = taskParent;
        } else if (bucketLower.includes('quality') || bucketLower.includes(String(entryWeights.qualityLabel || 'quality').toLowerCase())) {
          bW = entryWeights.qualityWithinPerformanceWeight || 25;
          parent = qualParent;
        }

        const pComp = score; // Do not multiply by sub-weight to match Heatmap card logic
        const mainWeight = parent === partLabel ? (entryWeights.competencyWeight || 25) :
                          parent === popLabel ? (entryWeights.attitudeWeight || 15) :
                          (entryWeights.performanceWeight || 60);
        
        const contrib = pComp * (mainWeight / 100);
        
        if (parent === perfLabel) map[empId].perfBase += contrib;
        else if (parent === partLabel) map[empId].categoryScores['Participation'] = (map[empId].categoryScores['Participation'] || 0) + contrib;
        else if (parent === popLabel) map[empId].categoryScores['Popularity'] = (map[empId].categoryScores['Popularity'] || 0) + contrib;
        
        map[empId].total += contrib;
      }

      map[empId].bucketScores[bucket] = (map[empId].bucketScores[bucket] || 0) + score;
    });

    let list = Object.values(map);

    // Merge official scores
    list = list.map(emp => {
      const official = officialScores.find(s => s.employeeId === emp.id);
      if (official) {
        return {
          ...emp,
          perfBase: official.performance60 || 0,
          categoryScores: {
            ...emp.categoryScores,
            Participation: official.participation25 || 0,
            Popularity: official.popularity15 || 0
          },
          total: official.finalScore || round2((official.performance60 || 0) + (official.participation25 || 0) + (official.popularity15 || 0))
        };
      }
      return emp;
    });

    const currentSearch = externalSearch !== undefined ? externalSearch : searchTerm;

    // Filter by search
    if (currentSearch) {
      const s = currentSearch.toLowerCase();
      list = list.filter(u => 
        u.name.toLowerCase().includes(s) || 
        u.dept.toLowerCase().includes(s)
      );
    }

    // Sort by selected category descending
    return list.sort((a, b) => {
      const currentRankFilter = externalRankingFilter !== undefined ? externalRankingFilter : localRankingFilter;
      const mappedKey = RANKING_FILTER_MAP[currentRankFilter] || currentRankFilter;
      
      // Check for specific buckets first
      if ((ACTIVITY_SCORE_BUCKETS as unknown as string[]).includes(mappedKey)) {
        return (b.bucketScores[mappedKey] || 0) - (a.bucketScores[mappedKey] || 0);
      }

      if (currentRankFilter === 'Performance Only') return b.perfBase - a.perfBase;
      if (currentRankFilter === 'Participation Only') return (b.categoryScores['Participation'] || 0) - (a.categoryScores['Participation'] || 0);
      if (currentRankFilter === 'Popularity Only') return (b.categoryScores['Popularity'] || 0) - (a.categoryScores['Popularity'] || 0);
      
      return b.total - a.total;
    });
  }, [entries, users, weights, externalSearch, searchTerm, externalRankingFilter, localRankingFilter]);

  const activeRankingFilter = externalRankingFilter !== undefined ? externalRankingFilter : localRankingFilter;
  const mappedRankFilter = RANKING_FILTER_MAP[activeRankingFilter] || activeRankingFilter;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        <p className="text-sm font-medium animate-pulse" style={{ color: 'rgb(var(--text-muted))' }}>
          Preparing Masterboard Rankings...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className={`rounded-2xl shadow-sm border ${hideFilters ? 'p-0 border-none bg-transparent' : 'p-5'}`} style={{ background: hideFilters ? 'transparent' : 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border-subtle))' }}>
        {!hideFilters && (
          <>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>Masterboard Views</h2>
            <p className="text-xs mb-6" style={{ color: 'rgb(var(--text-muted))' }}>Comprehensive employee scoring and rankings.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Search Employee</label>
                <div className="relative">
                  <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="input-base pl-9 text-xs py-2.5" 
                    placeholder="Search name or dept..." 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Date From</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-base text-xs py-2" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Date To</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-base text-xs py-2" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filter by Ranking</label>
                <select 
                  className="input-base text-xs py-2.5"
                  value={activeRankingFilter}
                  onChange={e => setLocalRankingFilter(e.target.value)}
                >
                  <option>All Categories (Total)</option>
                  <option>Performance Only</option>
                  <option>Participation Only</option>
                  <option>Popularity Only</option>
                  {ACTIVITY_SCORE_BUCKETS.map(bucket => (
                    <option key={bucket} value={bucket}>{bucket}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'rgb(var(--border))' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgb(var(--bg-elevated))' }}>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Rank</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Employee</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Dept</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgb(249 115 22)' }}>Performance</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgb(34 197 94)' }}>Participation</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgb(168 85 247)' }}>Popularity</th>
                {activeRankingFilter && !['All Categories (Total)', 'Performance Only', 'Participation Only', 'Popularity Only'].includes(activeRankingFilter) && (
                  <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider animate-in fade-in whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]" style={{ color: 'rgb(251 191 36)' }} title={activeRankingFilter}>
                    {activeRankingFilter}
                  </th>
                )}
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgb(79 127 255)' }}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
              {scores.map((row, idx) => (
                <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-500">#{idx + 1}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{row.name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{row.dept}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold" style={{ color: 'rgb(249 115 22)' }}>{round2(row.perfBase)}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold" style={{ color: 'rgb(34 197 94)' }}>{round2(row.categoryScores['Participation'] || 0)}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold" style={{ color: 'rgb(168 85 247)' }}>{round2(row.categoryScores['Popularity'] || 0)}</td>
                  {activeRankingFilter && !['All Categories (Total)', 'Performance Only', 'Participation Only', 'Popularity Only'].includes(activeRankingFilter) && (
                    <td className="px-4 py-3 text-center font-mono font-bold animate-in fade-in" style={{ color: 'rgb(251 191 36)' }}>{round2(row.bucketScores[mappedRankFilter] || 0)}</td>
                  )}
                  <td className="px-4 py-3 text-center font-mono font-bold" style={{ color: 'rgb(79 127 255)' }}>{round2(row.total)}</td>
                </tr>
              ))}
              <tr className="font-bold" style={{ background: 'rgba(79,127,255,0.05)' }}>
                <td colSpan={3} className="px-4 py-4 uppercase tracking-widest text-xs">Grand Total (All Employees)</td>
                <td className="px-4 py-4 text-center font-mono" style={{ color: 'rgb(249 115 22)' }}>{round2(sum(scores.map(s => s.perfBase)))}</td>
                <td className="px-4 py-4 text-center font-mono" style={{ color: 'rgb(34 197 94)' }}>{round2(sum(scores.map(s => s.categoryScores['Participation'] || 0)))}</td>
                <td className="px-4 py-4 text-center font-mono" style={{ color: 'rgb(168 85 247)' }}>{round2(sum(scores.map(s => s.categoryScores['Popularity'] || 0)))}</td>
                {activeRankingFilter && !['All Categories (Total)', 'Performance Only', 'Participation Only', 'Popularity Only'].includes(activeRankingFilter) && (
                  <td className="px-4 py-4 text-center font-mono" style={{ color: 'rgb(251 191 36)' }}>{round2(sum(scores.map(s => s.bucketScores[mappedRankFilter] || 0)))}</td>
                )}
                <td className="px-4 py-4 text-center font-mono text-lg" style={{ color: 'rgb(79 127 255)' }}>{round2(sum(scores.map(s => s.total)))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
