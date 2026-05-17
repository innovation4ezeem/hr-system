'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

type Weights = {
  performanceWeight: number;
  participationWeight: number;
  popularityWeight: number;
  kpiWithinPerformanceWeight: number;
  taskWithinPerformanceWeight: number;
  qualityWithinPerformanceWeight: number;
  performanceLabel: string;
  participationLabel: string;
  popularityLabel: string;
  kpiLabel: string;
  taskLabel: string;
  qualityLabel: string;
  kpiParent: string;
  taskParent: string;
  qualityParent: string;
};

export default function ScoringFormulaCard({ onSave }: { onSave?: () => void }) {
  const [collapsed, setCollapsed] = useState(true);
  const [weights, setWeights] = useState<Weights>({
    performanceWeight: 60,
    participationWeight: 25,
    popularityWeight: 15,
    kpiWithinPerformanceWeight: 40,
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
    qualityParent: 'Performance',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/system-settings');
        const data = await res.json();
        if (data.performanceWeights) {
            setWeights({
                performanceWeight: data.performanceWeights.performanceWeight,
                participationWeight: data.performanceWeights.competencyWeight,
                popularityWeight: data.performanceWeights.attitudeWeight,
                kpiWithinPerformanceWeight: data.performanceWeights.kpiWithinPerformanceWeight,
                taskWithinPerformanceWeight: data.performanceWeights.taskWithinPerformanceWeight,
                qualityWithinPerformanceWeight: data.performanceWeights.qualityWithinPerformanceWeight,
                performanceLabel: data.performanceWeights.performanceLabel || 'Performance',
                participationLabel: data.performanceWeights.participationLabel || 'Participation',
                popularityLabel: data.performanceWeights.popularityLabel || 'Popularity',
                kpiLabel: data.performanceWeights.kpiLabel || 'KPI',
                taskLabel: data.performanceWeights.taskLabel || 'Tasks',
                qualityLabel: data.performanceWeights.qualityLabel || 'Quality',
                kpiParent: data.performanceWeights.kpiParent || 'Performance',
                taskParent: data.performanceWeights.taskParent || 'Performance',
                qualityParent: data.performanceWeights.qualityParent || 'Performance',
            });
        }
      } catch (error) {
        console.error('Failed to load settings', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const saveFormula = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performanceWeights: {
            performanceWeight: weights.performanceWeight,
            competencyWeight: weights.participationWeight,
            attitudeWeight: weights.popularityWeight,
            kpiWithinPerformanceWeight: weights.kpiWithinPerformanceWeight,
            taskWithinPerformanceWeight: weights.taskWithinPerformanceWeight,
            qualityWithinPerformanceWeight: weights.qualityWithinPerformanceWeight,
            performanceLabel: weights.performanceLabel,
            participationLabel: weights.participationLabel,
            popularityLabel: weights.popularityLabel,
            kpiLabel: weights.kpiLabel,
            taskLabel: weights.taskLabel,
            qualityLabel: weights.qualityLabel,
            kpiParent: weights.kpiParent,
            taskParent: weights.taskParent,
            qualityParent: weights.qualityParent,
          },
          performanceFormula: {
            name: 'Scoring Formula',
            expression: formulaString,
          }
        }),
      });

      if (!res.ok) throw new Error('Failed to save');
      toast.success('Scoring formula updated');
      setCollapsed(true);
      if (onSave) onSave();
    } catch (error) {
      toast.error('Failed to save formula');
    } finally {
      setSaving(false);
    }
  };

  const getGroupFormula = (parentLabel: string) => {
    const items = [];
    if (weights.kpiParent === parentLabel) items.push(`${weights.kpiLabel} ${weights.kpiWithinPerformanceWeight}%`);
    if (weights.taskParent === parentLabel) items.push(`${weights.taskLabel} ${weights.taskWithinPerformanceWeight}%`);
    if (weights.qualityParent === parentLabel) items.push(`${weights.qualityLabel} ${weights.qualityWithinPerformanceWeight}%`);
    
    if (items.length === 0) return '';
    return ` (${items.join(' + ')})`;
  };

  const formulaString = `Total Score = ${weights.performanceLabel}${getGroupFormula(weights.performanceLabel)} × ${weights.performanceWeight/100} + ${weights.participationLabel}${getGroupFormula(weights.participationLabel)} × ${weights.participationWeight/100} + ${weights.popularityLabel}${getGroupFormula(weights.popularityLabel)} × ${weights.popularityWeight/100}.`;

  if (loading) return null;

  return (
    <div className="rounded-xl overflow-hidden border transition-all duration-300 mb-4" 
        style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border-subtle))' }}>
      
      {/* Header / Collapsed View */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Icon name="QuestionMarkCircleIcon" size={20} />
            </div>
            <div>
                <h3 className="text-sm font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Scoring Formula</h3>
                {collapsed ? (
                    <p className="text-[10px] md:text-xs font-mono mt-0.5 max-w-[280px] md:max-w-none truncate md:whitespace-normal" style={{ color: 'rgb(var(--text-muted))' }}>{formulaString}</p>
                ) : (
                    <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>Edit weights and sub-weights</p>
                )}
            </div>
        </div>
        <div className="flex items-center gap-3">
             {!collapsed && (
                 <button 
                    disabled={saving}
                    onClick={(e) => { e.stopPropagation(); saveFormula(); }}
                    className="btn-primary text-[11px] py-1.5 px-4 flex items-center gap-1.5"
                 >
                    {saving ? 'Saving...' : <><Icon name="CheckCircleIcon" size={14} /> Save Formula</>}
                 </button>
             )}
             <Icon name={collapsed ? "ChevronDownIcon" : "ChevronUpIcon"} size={20} style={{ color: 'rgb(var(--text-muted))' }} />
        </div>
      </div>

      {/* Expanded Content */}
      {!collapsed && (
          <div className="px-4 pb-6 pt-2 animate-fade-in space-y-6">
               <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border))' }}>
                  <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgb(var(--text-muted))' }}>Formula Name</label>
                      <p className="text-sm font-bold text-blue-500">Scoring Formula</p>
                  </div>
                  <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgb(var(--text-muted))' }}>Scoring Formula</label>
                       <p className="text-xs font-mono leading-relaxed" style={{ color: 'rgb(var(--text-secondary))' }}>{formulaString}</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Main Weights */}
                  <CategoryInput 
                    label={weights.performanceLabel} 
                    onLabelChange={(v) => setWeights(p => ({ ...p, performanceLabel: v }))}
                    value={weights.performanceWeight} 
                    onValueChange={(v) => setWeights(p => ({ ...p, performanceWeight: v }))} 
                  />
                  <CategoryInput 
                    label={weights.participationLabel} 
                    onLabelChange={(v) => setWeights(p => ({ ...p, participationLabel: v }))}
                    value={weights.participationWeight} 
                    onValueChange={(v) => setWeights(p => ({ ...p, participationWeight: v }))} 
                  />
                  <CategoryInput 
                    label={weights.popularityLabel} 
                    onLabelChange={(v) => setWeights(p => ({ ...p, popularityLabel: v }))}
                    value={weights.popularityWeight} 
                    onValueChange={(v) => setWeights(p => ({ ...p, popularityWeight: v }))} 
                  />

                  {/* Sub Weights */}
                  <CategoryInput 
                    label={weights.kpiLabel} 
                    onLabelChange={(v) => setWeights(p => ({ ...p, kpiLabel: v }))}
                    secondaryLabel={weights.kpiParent}
                    onSecondaryLabelChange={(v) => setWeights(p => ({ ...p, kpiParent: v }))}
                    secondaryOptions={[weights.performanceLabel, weights.participationLabel, weights.popularityLabel]}
                    value={weights.kpiWithinPerformanceWeight} 
                    onValueChange={(v) => setWeights(p => ({ ...p, kpiWithinPerformanceWeight: v }))} 
                  />
                  <CategoryInput 
                    label={weights.taskLabel} 
                    onLabelChange={(v) => setWeights(p => ({ ...p, taskLabel: v }))}
                    secondaryLabel={weights.taskParent}
                    onSecondaryLabelChange={(v) => setWeights(p => ({ ...p, taskParent: v }))}
                    secondaryOptions={[weights.performanceLabel, weights.participationLabel, weights.popularityLabel]}
                    value={weights.taskWithinPerformanceWeight} 
                    onValueChange={(v) => setWeights(p => ({ ...p, taskWithinPerformanceWeight: v }))} 
                  />
                  <CategoryInput 
                    label={weights.qualityLabel} 
                    onLabelChange={(v) => setWeights(p => ({ ...p, qualityLabel: v }))}
                    secondaryLabel={weights.qualityParent}
                    onSecondaryLabelChange={(v) => setWeights(p => ({ ...p, qualityParent: v }))}
                    secondaryOptions={[weights.performanceLabel, weights.participationLabel, weights.popularityLabel]}
                    value={weights.qualityWithinPerformanceWeight} 
                    onValueChange={(v) => setWeights(p => ({ ...p, qualityWithinPerformanceWeight: v }))} 
                  />
              </div>
          </div>
      )}
    </div>
  );
}

function CategoryInput({ 
    label, 
    onLabelChange, 
    secondaryLabel, 
    onSecondaryLabelChange,
    secondaryOptions,
    value, 
    onValueChange 
}: { 
    label: string, 
    onLabelChange: (v: string) => void, 
    secondaryLabel?: string, 
    onSecondaryLabelChange?: (v: string) => void,
    secondaryOptions?: string[],
    value: number, 
    onValueChange: (v: number) => void 
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1 overflow-hidden">
                <input 
                  value={label}
                  onChange={(e) => onLabelChange(e.target.value)}
                  className="text-[10px] font-bold uppercase ml-1 bg-transparent border-none focus:ring-2 focus:ring-blue-500/20 rounded px-1 -ml-1 flex-1 transition-all"
                  style={{ color: 'rgb(var(--text-muted))' }}
                  placeholder="Name"
                />
                {secondaryLabel && (
                    <div className="relative">
                        <select 
                            value={secondaryLabel}
                            onChange={(e) => onSecondaryLabelChange?.(e.target.value)}
                            className="text-[9px] font-medium text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 mr-1 hover:bg-blue-500/20 transition-all appearance-none cursor-pointer focus:ring-0 focus:border-blue-500/50"
                        >
                            {secondaryOptions?.map(opt => (
                                <option key={opt} value={opt} className="bg-slate-900 text-slate-200">
                                    In {opt}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
            <div className="relative group">
                <input 
                    type="number"
                    value={value}
                    onChange={(e) => onValueChange(Number(e.target.value) || 0)}
                    className="input-base text-sm font-bold pl-3 pr-8 py-2 w-full transition-all group-hover:border-blue-500/50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs" style={{ color: 'rgb(var(--text-muted))' }}>%</span>
            </div>
        </div>
    );
}
