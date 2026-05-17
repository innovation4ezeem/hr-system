'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { 
  ACTIVITY_CATEGORIES, 
  bucketSectionTitle,
  STANDARD_MARKS
} from '@/data/activityScoreRules';

import InlineEditableField from '@/components/ui/InlineEditableField';

interface ScoringRulesEditorProps {
  onClose: () => void;
  onSuccess?: () => void;
  authHeaders: Record<string, string>;
  userName?: string;
}

export const ScoringRulesEditor: React.FC<ScoringRulesEditorProps> = ({ onClose, onSuccess, authHeaders, userName }) => {
  const [marks, setMarks] = useState<Record<string, number>>(STANDARD_MARKS);
  const [bucketCategories, setBucketCategories] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState<string | null>(null); // category name
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketPoints, setNewBucketPoints] = useState(10);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchMarks();
  }, []);

  const fetchMarks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/performance-management?mode=standard-marks', {
        headers: authHeaders
      });
      if (!res.ok) throw new Error('Failed to fetch standard marks');
      const data = await res.json();
      const loadedMarks = data.standardMarks || {};
      const loadedCategories = data.bucketCategories || {};
      
      // Use DB data if it exists, otherwise fall back to static defaults
      if (Object.keys(loadedMarks).length > 0) {
        setMarks(loadedMarks);
        
        // Ensure all marks have a category assigned (either from DB or inferred)
        const categories = { ...loadedCategories };
        Object.keys(loadedMarks).forEach(b => {
          if (!categories[b]) {
            categories[b] = bucketSectionTitle(b);
          }
        });
        setBucketCategories(categories);
      } else {
        setMarks(STANDARD_MARKS);
        setBucketCategories({});
      }
    } catch (err) {
      toast.error('Error loading scoring rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updatedMarks?: Record<string, number>, updatedCategories?: Record<string, string>) => {
    try {
      setSaving(true);
      const res = await fetch('/api/performance-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          action: 'save-standard-marks',
          marks: updatedMarks || marks,
          bucketCategories: updatedCategories || bucketCategories,
          actor: userName || 'Admin'
        })
      });

      if (!res.ok) throw new Error('Failed to save standard marks');
      onSuccess?.();
    } catch (err) {
      toast.error('Error saving scoring rules');
    } finally {
      setSaving(false);
    }
  };

  const updateMark = async (bucket: string, val: string) => {
    const num = parseInt(val, 10) || 0;
    const newMarks = { ...marks, [bucket]: num };
    setMarks(newMarks);
    await handleSave(newMarks);
  };

  const handleAddBucket = () => {
    if (!newBucketName.trim()) return;
    if (marks[newBucketName]) {
      toast.error('Bucket name already exists');
      return;
    }

    const category = showAddModal!;
    setMarks(prev => ({ ...prev, [newBucketName]: newBucketPoints }));
    setBucketCategories(prev => ({ ...prev, [newBucketName]: category }));
    
    setNewBucketName('');
    setNewBucketPoints(10);
    setShowAddModal(null);
    toast.success(`Added "${newBucketName}" to ${category}`);
  };

  const handleDeleteBucket = (bucket: string) => {
    const newMarks = { ...marks };
    delete newMarks[bucket];
    setMarks(newMarks);

    const newCats = { ...bucketCategories };
    delete newCats[bucket];
    setBucketCategories(newCats);

    setDeleteConfirm(null);
    toast.success(`Deleted "${bucket}"`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3" />
        <p className="text-xs text-slate-500">Loading scoring rules...</p>
      </div>
    );
  }

  const categories = ['Performance', 'Participation', 'Popularity'];
  const categoryThemes: Record<string, { color: string; bg: string; border: string }> = {
    'Performance': { color: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)' },
    'Participation': { color: 'rgb(16, 185, 129)', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)' },
    'Popularity': { color: 'rgb(168, 85, 247)', bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.2)' }
  };

  const getBucketsForCategory = (cat: string) => {
    const targetCat = cat.trim().toLowerCase();
    return Object.keys(marks || {})
      .filter(b => {
        // First check explicit mapping from DB
        if (bucketCategories[b]) {
          return bucketCategories[b].trim().toLowerCase() === targetCat;
        }
        // Fallback to static mapping logic
        const inferred = bucketSectionTitle(b);
        return inferred.trim().toLowerCase() === targetCat;
      });
  };

  const handleResetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset all scoring rules to system defaults? This will overwrite your current changes.')) return;
    
    try {
      setSaving(true);
      const res = await fetch('/api/performance-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          action: 'save-standard-marks',
          marks: null, // Sending null triggers reset to defaults in controller
          bucketCategories: null,
          actor: userName || 'Admin'
        })
      });

      if (!res.ok) throw new Error('Failed to reset marks');
      toast.success('Restored system default scoring rules');
      fetchMarks(); // Reload
      onSuccess?.();
    } catch (err) {
      toast.error('Error resetting rules');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white">System Framework - Scoring Rules</h2>
          <p className="text-xs text-slate-500 mt-1">Define standard marks for each activity bucket</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-400 border border-white/5 transition-all flex items-center gap-2"
            onClick={handleResetToDefaults}
            disabled={saving}
          >
            <Icon name="ArrowPathIcon" size={14} />
            Reset to Defaults
          </button>
          <button 
            className="p-1 hover:bg-white/5 rounded-full transition-colors"
            onClick={onClose}
          >
            <Icon name="XMarkIcon" size={20} className="text-slate-500" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {categories.map(cat => {
          const theme = categoryThemes[cat];
          const buckets = getBucketsForCategory(cat);
          
          return (
            <div key={cat} className="space-y-4">
              <div 
                className="p-3 rounded-t-xl border-x border-t flex items-center justify-between"
                style={{ background: theme.bg, borderColor: theme.border }}
              >
                <h3 
                  className="text-sm font-black uppercase tracking-widest"
                  style={{ color: theme.color }}
                >
                  {cat}
                </h3>
                <button 
                  onClick={() => setShowAddModal(cat)}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
                  title={`Add rule to ${cat}`}
                >
                  <Icon name="PlusIcon" size={14} />
                </button>
              </div>
              
              <div className="bg-slate-900/50 border border-white/5 rounded-b-xl overflow-hidden min-h-[100px]">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-white/5">
                    {buckets.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-slate-600 italic">No rules defined</td>
                      </tr>
                    ) : (
                      buckets.map(bucket => (
                        <tr key={bucket} className="hover:bg-white/[0.02] group transition-colors">
                          <td className="px-3 py-3 text-slate-300 font-medium">
                            <div className="flex items-center justify-between gap-2">
                              <span>{bucket}</span>
                              <button 
                                onClick={() => setDeleteConfirm(bucket)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-all"
                              >
                                <Icon name="TrashIcon" size={12} />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3 w-24">
                            <div className="relative">
                              <InlineEditableField
                                type="number"
                                initialValue={String(marks[bucket] ?? 0)}
                                onSave={(val) => updateMark(bucket, val)}
                                textClassName="w-full text-center font-mono font-bold text-white"
                                className="bg-slate-800 border border-white/10 rounded"
                              />
                              <span className="absolute -right-2 top-1.5 text-[8px] font-bold text-slate-600 uppercase">pts</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
        <button 
          onClick={onClose}
          className="px-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-bold text-white transition-all flex items-center gap-2"
        >
          Close Editor
        </button>
      </div>

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Add Rule to {showAddModal}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Rule Name</label>
                <input 
                  autoFocus
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Extra Mile Bonus"
                  value={newBucketName}
                  onChange={e => setNewBucketName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Default Points</label>
                <input 
                  type="number"
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  value={newBucketPoints}
                  onChange={e => setNewBucketPoints(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowAddModal(null)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-bold text-slate-400 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddBucket}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold"
                >
                  Add Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <ConfirmModal 
          open={!!deleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => handleDeleteBucket(deleteConfirm)}
          title="Delete Scoring Rule"
          message={`Are you sure you want to delete the scoring rule for "${deleteConfirm}"? This will not affect existing score records, but this bucket will no longer appear in future score entries.`}
          confirmLabel="Delete Rule"
          variant="danger"
        />
      )}
    </div>
  );
};
