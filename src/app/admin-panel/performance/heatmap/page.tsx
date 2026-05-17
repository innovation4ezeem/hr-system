"use client";
import React from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import TeamHeatmap from '@/app/manager-dashboard/components/TeamHeatmap';
import MasterboardPanel from '@/app/admin-panel/components/MasterboardPanel';
import ScoringFormulaCard from '@/app/admin-panel/components/ScoringFormulaCard';
import Icon from '@/components/ui/AppIcon';
import { useAppContext } from '@/context/AppContext';
import { usePerformanceThresholds } from '@/hooks/usePerformanceThresholds';
import { usePerformanceWeights, parseFormulaExpression, generateFormulaString } from '@/hooks/usePerformanceWeights';

export default function AdminPerformanceHeatmapPage() {
  const { selectedYear, setSelectedYear, availableYears } = useAppContext();
  const { thresholds, setThresholds } = usePerformanceThresholds();
  const { weights, setWeights, formula, setFormula, saveWeights } = usePerformanceWeights();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSavingWeights, setIsSavingWeights] = React.useState(false);
  const [formulaCollapsed, setFormulaCollapsed] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<'heatmap' | 'ranking'>('heatmap');
  const [refreshKey, setRefreshKey] = React.useState(0);
  
  // Period Filters
  const [periodType, setPeriodType] = React.useState<'monthly' | 'quarterly' | 'yearly'>('yearly');
  const [periodNo, setPeriodNo] = React.useState<number>(1);

  // Masterboard Filters
  const [mbSearch, setMbSearch] = React.useState('');
  const [mbStartDate, setMbStartDate] = React.useState('');
  const [mbEndDate, setMbEndDate] = React.useState('');
  const [mbRankingFilter, setMbRankingFilter] = React.useState('All Categories (Total)');

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const quarters = ["Q1 (Jan-Mar)", "Q2 (Apr-Jun)", "Q3 (Jul-Sep)", "Q4 (Oct-Dec)"];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/performance-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-thresholds', thresholds, actor: 'Admin' }),
      });
      if (res.ok) alert('Thresholds saved successfully!');
      else alert('Failed to save thresholds.');
    } catch (err) {
      console.error('Save thresholds error:', err);
      alert('Error saving thresholds.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWeights = async () => {
    setIsSavingWeights(true);
    try {
      const success = await saveWeights(weights, formula.name, formula.expression);
      if (success) alert('Scoring formula saved successfully!');
      else alert('Failed to save scoring formula.');
    } catch (err) {
      console.error('Save weights error:', err);
      alert('Error saving scoring formula.');
    } finally {
      setIsSavingWeights(false);
    }
  };

  const handleFormulaExpressionChange = (value: string) => {
    setFormula({ ...formula, expression: value });

    const derivedWeights = parseFormulaExpression(value);
    if (Object.keys(derivedWeights).length > 0) {
      setWeights({ ...weights, ...derivedWeights });
    }
  };

  const handleFormulaNameChange = (value: string) => {
    setFormula({ ...formula, name: value });
  };

  const updateWeightsAndFormula = (patch: Partial<typeof weights>) => {
    const nextWeights = { ...weights, ...patch };
    setWeights(nextWeights);
    setFormula({ ...formula, expression: generateFormulaString(nextWeights) });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <Topbar
        title="Admin - Performance Heatmap"
        subtitle="System Framework - Company-wide Trends"
        showProfile={false}
      />
      
      <div className="p-6 space-y-6">
        {/* Threshold Controls / Legend */}
        <div className="flex justify-end gap-4 items-center">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Scoring Thresholds:</span>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium" style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border))' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span style={{ color: 'rgb(var(--text-secondary))' }}>High ≥</span>
            <input 
              type="number" 
              value={thresholds.high}
              onChange={(e) => setThresholds({ ...thresholds, high: parseInt(e.target.value) || 0 })}
              className="w-10 bg-transparent border-none p-0 focus:ring-0 font-bold text-emerald-400"
            />
            <span className="text-emerald-400">%</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium" style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border))' }}>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span style={{ color: 'rgb(var(--text-secondary))' }}>Satisfactory ≥</span>
            <input 
              type="number" 
              value={thresholds.mid}
              onChange={(e) => setThresholds({ ...thresholds, mid: parseInt(e.target.value) || 0 })}
              className="w-10 bg-transparent border-none p-0 focus:ring-0 font-bold text-amber-400"
            />
            <span className="text-amber-400">%</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium" style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border))' }}>
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span style={{ color: 'rgb(var(--text-secondary))' }}>Underperforming &lt; {thresholds.mid}%</span>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Icon name="CheckCircleIcon" size={14} />
            )}
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
        
        <ScoringFormulaCard onSave={() => setRefreshKey(prev => prev + 1)} />
        
        {/* Masterboard Filters */}
        {viewMode === 'ranking' && (
          <div className="rounded-2xl p-5 shadow-sm border animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border-subtle))' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Search Employee</label>
                <div className="relative">
                  <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    value={mbSearch}
                    onChange={e => setMbSearch(e.target.value)}
                    className="input-base pl-9 text-xs py-2.5" 
                    placeholder="Search name or dept..." 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Year</label>
                <select 
                  value={selectedYear}
                  onChange={e => setSelectedYear(parseInt(e.target.value))}
                  className="input-base text-xs py-2.5 font-bold text-blue-400"
                >
                  {availableYears.map(item => (
                    <option key={item.year} value={item.year}>
                      {item.year}{item.archived ? ' (Archive)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filter by Ranking</label>
                <select 
                  value={mbRankingFilter}
                  onChange={e => setMbRankingFilter(e.target.value)}
                  className="input-base text-xs py-2.5"
                >
                  <option>All Categories (Total)</option>
                  <option>Performance Only</option>
                  <option>Participation Only</option>
                  <option>Popularity Only</option>
                  <option>Accountability</option>
                  <option>Sharpen The Saw (Continuous Learner)</option>
                  <option>Innovative & Creativity</option>
                  <option>Collaboration (Effective Collaborator)</option>
                  <option>Initiative</option>
                </select>
              </div>
            </div>
          </div>
        )}


        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            {viewMode === 'heatmap' ? 'Visual Heatmap View' : 'Masterboard Ranking View'}
          </h3>
          <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
            <button 
              onClick={() => setViewMode('heatmap')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'heatmap' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Icon name="ChartPieIcon" size={14} />
              Heatmap
            </button>
            <button 
              onClick={() => setViewMode('ranking')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'ranking' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Icon name="TrophyIcon" size={14} />
              Ranking Board
            </button>
          </div>
        </div>

        {/* Conditional Component View */}
        <div className="animate-slide-up">
          {viewMode === 'heatmap' ? (
            <TeamHeatmap 
              key={refreshKey} 
              thresholds={thresholds} 
              onRankingClick={() => setViewMode('ranking')} 
              periodType={periodType}
              periodNo={periodNo}
            />
          ) : (
            <MasterboardPanel 
              externalSearch={mbSearch}
              externalStartDate={mbStartDate}
              externalEndDate={mbEndDate}
              externalRankingFilter={mbRankingFilter}
              hideFilters={true}
              periodType={periodType}
              periodNo={periodNo}
            />
          )}
        </div>

      </div>
    </div>
  );
}
