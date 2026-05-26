'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { toast } from 'sonner';
import InlineEditableField from '@/components/ui/InlineEditableField';
import { useAppContext } from '@/context/AppContext';
import Link from 'next/link';
import { ACTIVITY_CATEGORIES, ACTIVITY_MONTHS, ACTIVITY_SCORE_BUCKETS, DEFAULT_BUCKET_BY_CATEGORY, STANDARD_MARKS, bucketSectionTitle } from '@/data/activityScoreRules';
import { buildClientAuthHeaders } from '@/lib/clientAuth';
import ScoringFormulaCard from './ScoringFormulaCard';
import { ScoringRulesEditor } from './ScoringRulesEditor';

type Activity = {
  id: string;
  activityName: string;
  date: string;
  year: number;
  month: string;
  category: string;
  scoreBucket: string;
  score: number;
  sourceFolder: string;
  description: string;
  assignedToName: string;
  assignedToId: string;
  attachmentName: string;
  attachmentUrl: string;
  updatedBy?: string;
  updatedAt?: string;
};

type UserOption = {
  id: string;
  name: string;
  role: string;
  dept?: string;
  status: string;
};

const getCategoryColor = (category: string, labels?: any) => {
  const perf = labels?.performance || 'Performance';
  const part = labels?.participation || 'Participation';
  const pop = labels?.popularity || 'Popularity';
  
  const categoryMap: Record<string, { badge: string; text: string }> = {
    [perf]: { badge: 'rgba(249, 115, 22, 0.2)', text: 'rgb(249 115 22)' },
    [part]: { badge: 'rgba(34, 197, 94, 0.2)', text: 'rgb(34 197 94)' },
    [pop]: { badge: 'rgba(168, 85, 247, 0.2)', text: 'rgb(168 85 247)' },
  };
  return categoryMap[category] || { badge: 'rgba(107, 114, 128, 0.2)', text: 'rgb(107 114 128)' };
};

const formatVoteDescription = (desc: string | null) => {
  if (!desc) return '';
  const match = desc.match(/Voted by\s+[^.]+\.\s*Reason:\s*(.*)/i);
  if (match) {
    const reason = match[1]?.trim();
    return reason ? `Reason: ${reason}` : '';
  }
  return desc;
};

const isVoteRecord = (entry: any) => {
  return entry.id?.startsWith('VOTE-') || entry.activityName?.toLowerCase().includes('voting form');
};

export default function ActivitiesCrudPanel({ 
  embedded = false, 
  externalEmployeeId = null,
  year: externalYear = null,
  showFilters = true,
  showAddButton = false,
  canEdit = true,
  canDelete = true,
  departmentScope = null,
  onMutation
}: { 
  embedded?: boolean; 
  externalEmployeeId?: string | null;
  year?: number | null;
  showFilters?: boolean;
  showAddButton?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  departmentScope?: string | null;
  onMutation?: () => void;
}) {
  const { selectedYear: contextYear, userName, availableYears, setSelectedYear, userRole, userId, userDepartment } = useAppContext();
  const selectedYear = externalYear ?? contextYear;

  const authHeaders = useMemo(() => {
    return buildClientAuthHeaders({
      role: (userRole || 'hod') as any,
      userId: userId || 'u-001',
      userName: userName || 'HOD',
      department: userDepartment || 'Operations'
    });
  }, [userRole, userId, userName, userDepartment]);

  const [entries, setEntries] = useState<Activity[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterMonth, setFilterMonth] = useState('All');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [systemWeights, setSystemWeights] = useState<any>(null);
  const [newEntry, setNewEntry] = useState<Partial<Activity>>({
    score: 1,
    description: '',
  });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [historyEntry, setHistoryEntry] = useState<Activity | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [dynamicStandardMarks, setDynamicStandardMarks] = useState<Record<string, number>>({});
  const [dynamicBucketCategories, setDynamicBucketCategories] = useState<Record<string, string>>({});

  const bucketToCategory = useMemo(() => {
    const mapping: Record<string, string> = { ...dynamicBucketCategories };
    ACTIVITY_SCORE_BUCKETS.forEach(bucket => {
      if (!mapping[bucket]) {
        mapping[bucket] = bucketSectionTitle(bucket);
      }
    });
    return mapping;
  }, [dynamicBucketCategories]);

  const allBuckets = useMemo(() => {
    const buckets = new Set([...ACTIVITY_SCORE_BUCKETS, ...Object.keys(dynamicStandardMarks)]);
    return Array.from(buckets);
  }, [dynamicStandardMarks]);

  const [showSummary, setShowSummary] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [editingScore, setEditingScore] = useState<{ eid: string, cat: string, val: string } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        setShowAddForm(false);
      }
    };

    if (showAddForm) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAddForm]);

  useEffect(() => {
    const handleClickOutsideDropdown = (event: MouseEvent) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target as Node)) {
        setShowEmployeeDropdown(false);
      }
    };

    if (showEmployeeDropdown) {
      document.addEventListener('mousedown', handleClickOutsideDropdown);
    } else {
      document.removeEventListener('mousedown', handleClickOutsideDropdown);
    }

    return () => document.removeEventListener('mousedown', handleClickOutsideDropdown);
  }, [showEmployeeDropdown]);

  // Draft persistence for new entry
  useEffect(() => {
    const saved = localStorage.getItem('activity_draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNewEntry(parsed);
        setShowAddForm(true);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (showAddForm && (newEntry.activityName || newEntry.description)) {
      localStorage.setItem('activity_draft', JSON.stringify(newEntry));
    } else if (!showAddForm) {
      localStorage.removeItem('activity_draft');
    }
  }, [newEntry, showAddForm]);

  const filteredBuckets = useMemo(() => {
    const cat = newEntry.category || 'Performance';
    return allBuckets.filter(bucket => bucketToCategory[bucket] === cat);
  }, [newEntry.category, bucketToCategory, allBuckets]);

  const loadUsers = async () => {
    if (userRole === 'employee' || userRole === 'intern' || userRole === 'probation') return;

    try {
      const response = await fetch(`/api/users?t=${Date.now()}`, { headers: authHeaders });
      if (!response.ok) throw new Error('Failed to load users');
      const payload = await response.json();
      if (Array.isArray(payload?.users)) {
        setUsers(
          payload.users
            .filter((u: any) => u.role !== 'admin')
            .filter((u: any) => !departmentScope || u.dept === departmentScope)
            .map((item: any) => ({ 
              id: item.id, 
              name: item.name, 
              role: item.role,
              dept: item.dept,
              status: item.status || 'active'
            }))
        );
      }
    } catch {
      toast.error('Failed to load users list');
    }
  };

  const loadStandardMarks = async () => {
    try {
      const res = await fetch(`/api/performance-management?mode=standard-marks&t=${Date.now()}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        if (data.standardMarks) {
          setDynamicStandardMarks(data.standardMarks);
        }
        if (data.bucketCategories) {
          setDynamicBucketCategories(data.bucketCategories);
        }
      }
    } catch (err) {
      console.error('Failed to load dynamic standard marks:', err);
    }
  };

  const loadEntries = async () => {
    setLoading(true);
    try {
      const entriesUrl = `/api/activity-scores?year=${selectedYear}&meta=1${externalEmployeeId ? `&employeeId=${encodeURIComponent(externalEmployeeId)}` : ''}`;
      const [entriesRes, settingsRes] = await Promise.all([
        fetch(`${entriesUrl}&t=${Date.now()}`, { headers: authHeaders }),
        fetch(`/api/system-settings?mode=weights&t=${Date.now()}`, { headers: authHeaders })
      ]);
      
      const payload = await entriesRes.json();
      const settings = await settingsRes.json();
      
      setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
      setSystemWeights(settings.weights);
      
      if (settings.weights?.performanceLabel) {
        setNewEntry(prev => ({ ...prev, category: settings.weights.performanceLabel }));
      }
    } catch {
      toast.error('Failed to load activity data');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    void loadStandardMarks();
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [selectedYear]);
  
  useEffect(() => {
    if (!historyEntry) {
      setAuditLogs([]);
      return;
    }
    const fetchAudit = async () => {
      setLoadingAudit(true);
      try {
        const res = await fetch(`/api/activity-scores?mode=audit&id=${encodeURIComponent(historyEntry.id)}&t=${Date.now()}`, { headers: authHeaders });
        const data = await res.json();
        setAuditLogs(data.logs || []);
      } catch {
        toast.error('Failed to load audit history');
      } finally {
        setLoadingAudit(false);
      }
    };
    void fetchAudit();
  }, [historyEntry]);

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (filterStartDate && entry.date < filterStartDate) return false;
      if (filterEndDate && entry.date > filterEndDate) return false;
      
      if (filterMonth !== 'All' && entry.month !== filterMonth) return false;
      
      if (filterCategory !== 'All' && entry.category !== filterCategory) return false;
      
      const user = users.find(u => u.id === entry.assignedToId);
      const isInactive = user ? user.status === 'inactive' : false;
      
      if (showInactive) {
        if (!isInactive) return false;
      } else {
        if (isInactive) return false;
      }

      if (externalEmployeeId && entry.assignedToId !== externalEmployeeId) return false;
      
      if (departmentScope) {
        const user = users.find(u => u.id === entry.assignedToId);
        if (!user || user.dept !== departmentScope) return false;
      }

      if (!searchQuery) return true;

      const query = searchQuery.toLowerCase();
      return (
        entry.activityName.toLowerCase().includes(query) ||
        entry.assignedToName.toLowerCase().includes(query) ||
        entry.scoreBucket.toLowerCase().includes(query)
      );
    });
  }, [entries, filterMonth, filterCategory, filterStartDate, filterEndDate, searchQuery, showInactive, users, externalEmployeeId, departmentScope]);

  const summaryData = useMemo(() => {
    const summary: Record<string, { id: string, name: string, scores: Record<string, number> }> = {};
    const cats = [
      systemWeights?.performanceLabel || 'Performance',
      systemWeights?.participationLabel || 'Participation',
      systemWeights?.popularityLabel || 'Popularity'
    ];

    filteredEntries.forEach(entry => {
      const eid = entry.assignedToId;
      if (!eid) return;
      if (!summary[eid]) {
        summary[eid] = { id: eid, name: entry.assignedToName, scores: {} };
        cats.forEach(c => summary[eid].scores[c] = 0);
      }
      summary[eid].scores[entry.category] = (summary[eid].scores[entry.category] || 0) + Number(entry.score);
    });

    return Object.values(summary).map(item => ({
      ...item,
      total: Object.values(item.scores).reduce((acc, val) => acc + val, 0)
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredEntries, systemWeights]);

  const handleSummaryEdit = async (employeeId: string, employeeName: string, category: string, newTotal: number, currentTotal: number) => {
    if (newTotal === currentTotal) return;
    if (filterMonth === 'All') {
      toast.error('Select a specific month to edit category scores');
      return;
    }
    
    const delta = newTotal - currentTotal;
    const bucket = DEFAULT_BUCKET_BY_CATEGORY[category] || 'KPI / OKR';
    const month = filterMonth;
    const date = `${selectedYear}-${String(ACTIVITY_MONTHS.indexOf(month as any) + 1).padStart(2, '0')}-01`;

    try {
      setSaving(true);
      const existingAdj = filteredEntries.find(e => 
        e.assignedToId === employeeId && 
        e.category === category && 
        e.activityName.startsWith('Worksheet Adjustment') &&
        e.month === month
      );

      if (existingAdj) {
        const updatedScore = Number(existingAdj.score) + delta;
        if (updatedScore === 0) {
          await removeEntry(existingAdj.id);
        } else {
          await saveEdit({ ...existingAdj, score: updatedScore });
        }
      } else {
        const response = await fetch('/api/activity-scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            activityName: `Worksheet Adjustment: ${category}`,
            date,
            month,
            year: selectedYear,
            category,
            scoreBucket: bucket,
            score: delta,
            assignedToId: employeeId,
            assignedToName: employeeName,
            updatedBy: userName || 'Admin',
            sourceFolder: 'System'
          }),
        });
        if (!response.ok) throw new Error('Failed to create adjustment');
        await loadEntries();
      }
      toast.success('Score adjusted successfully');
    } catch (err) {
      toast.error('Failed to adjust score');
    } finally {
      setSaving(false);
      setEditingScore(null);
    }
  };

  const totalSyncedScore = useMemo(
    () => filteredEntries.reduce((sum, entry) => sum + Number(entry.score || 0), 0),
    [filteredEntries],
  );

  const setNewCategory = (category: string) => {
    const bucket = DEFAULT_BUCKET_BY_CATEGORY[category] || 'KPI';
    setNewEntry(prev => ({
      ...prev,
      category,
      scoreBucket: bucket,
      score: dynamicStandardMarks[bucket] ?? (STANDARD_MARKS[bucket] || prev.score || 0),
    }));
  };

  const setNewBucket = (scoreBucket: string) => {
    setNewEntry(prev => ({
      ...prev,
      scoreBucket,
      category: bucketToCategory[scoreBucket] || prev.category || 'Performance',
      score: dynamicStandardMarks[scoreBucket] ?? (STANDARD_MARKS[scoreBucket] || prev.score || 0),
    }));
  };

  const handleNewDateChange = (dateStr: string) => {
    if (!dateStr) {
      setNewEntry(prev => ({ ...prev, date: '' }));
      return;
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      setNewEntry(prev => ({ ...prev, date: dateStr }));
      return;
    }
    const monthName = ACTIVITY_MONTHS[date.getMonth()];
    setNewEntry(prev => ({ 
      ...prev, 
      date: dateStr,
      month: monthName
    }));
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEntries.length && filteredEntries.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map(e => e.id)));
    }
  };

  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const handleDeleteAllFiltered = async () => {
    if (filteredEntries.length === 0) return;
    const idsToDelete = filteredEntries.map(e => e.id);
    await handleBulkDelete(idsToDelete);
    setShowDeleteAllConfirm(false);
  };

  const handleBulkDelete = async (ids: string[] = Array.from(selectedIds)) => {
    if (ids.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/activity-scores?year=${selectedYear}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ ids })
      });
      
      if (!res.ok) {
        const errText = await res.text();
        console.error('Bulk delete failed:', res.status, errText);
        throw new Error(`Bulk delete failed: ${errText}`);
      }

      toast.success(`Successfully deleted ${ids.length} records`);
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      void loadEntries();
      if (onMutation) onMutation();
    } catch (error) {
      console.error('handleBulkDelete error:', error);
      toast.error('Failed to complete bulk deletion');
    } finally {
      setSaving(false);
    }
  };

  const uploadAttachment = async () => {
    if (!attachmentFile) return { attachmentName: '', attachmentUrl: '' };

    const formData = new FormData();
    formData.append('file', attachmentFile);

    const response = await fetch('/api/leave-attachments', {
      method: 'POST',
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Failed to upload attachment');

    return {
      attachmentName: payload?.attachment?.originalName || attachmentFile.name,
      attachmentUrl: payload?.attachment?.path || '',
    };
  };

  const createEntry = async () => {
    if (!newEntry.activityName?.trim() || !newEntry.date) {
      toast.error('Activity and date are required');
      return;
    }

    if (selectedEmployeeIds.length === 0) {
      toast.error('Select at least one employee');
      return;
    }

    try {
      setSaving(true);
      const attachment = await uploadAttachment();
      
      const response = await fetch('/api/activity-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          ...newEntry,
          assignedToIds: selectedEmployeeIds,
          attachmentName: attachment.attachmentName,
          attachmentUrl: attachment.attachmentUrl,
          updatedBy: userName || 'Admin',
          year: selectedYear,
          score: Number(newEntry.score || 0),
          description: newEntry.description || '',
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to create activity entries');

      await loadEntries();
      setShowAddForm(false);
      setSelectedEmployeeIds([]);
      setAttachmentFile(null);
      setNewEntry({
        category: 'Performance',
        month: 'January',
        scoreBucket: 'KPI',
        score: 1,
        description: '',
      });
      toast.success('Activity recorded and synced into Performance Scores summary');
      if (onMutation) onMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create activity entry');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (entry: Activity) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/activity-scores?id=${encodeURIComponent(entry.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ ...entry, updatedBy: userName || 'Admin' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to update activity entry');

      await loadEntries();
      setEditingId(null);
      toast.success('Activity updated and summary scores recalculated');
      if (onMutation) onMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update activity entry');
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (id: string) => {
    try {
      setSaving(true);
      const previousEntries = [...entries];
      setEntries(prev => prev.filter(item => item.id !== id));

      const response = await fetch(`/api/activity-scores?id=${encodeURIComponent(id)}&year=${selectedYear}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setEntries(previousEntries);
        throw new Error(body.error || 'The server encountered an error while deleting the record.');
      }
      
      setDeleteId(null);
      toast.success('Activity deleted successfully');
      void loadEntries();
      if (onMutation) onMutation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete activity entry');
    } finally {
      setSaving(false);
    }
  };

  const updateLocalEntry = (id: string, patch: Partial<Activity>) => {
    setEntries(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleAsyncSave = async (entry: Activity, patch: Partial<Activity>) => {
    const updated = { ...entry, ...patch };
    await saveEdit(updated);
  };

  return (
    <div className="space-y-6">
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-left-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-red-400 uppercase tracking-widest">{selectedIds.size} Records Selected</span>
            <button 
              className="text-[10px] font-bold text-slate-400 hover:text-white uppercase underline"
              onClick={() => setSelectedIds(new Set())}
            >
              Deselect All
            </button>
          </div>
          <button 
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-900/20 transition-all"
            onClick={() => setBulkDeleteConfirm(true)}
            disabled={saving}
          >
            <Icon name="TrashIcon" size={14} />
            {saving ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      )}

      {showRules && (
        <div className="rounded-xl p-6 mb-6 shadow-2xl border border-white/5 bg-slate-900/80 backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <ScoringRulesEditor 
            onClose={() => setShowRules(false)}
            onSuccess={() => {
              void loadStandardMarks();
            }}
            authHeaders={authHeaders}
            userName={userName}
          />
        </div>
      )}

      {(!embedded || showAddButton) && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(79,127,255,0.08)', border: '1px solid rgba(79,127,255,0.3)' }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'rgb(79 127 255)' }}>Activities Scoring Management</h2>
            </div>
            {userRole === 'admin' && (
              <div className="flex items-center gap-2">
                <button 
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-white/5 transition-all flex items-center gap-2"
                  onClick={() => setShowRules(!showRules)}
                >
                  <Icon name="Cog6ToothIcon" size={14} />
                  Scoring Rules
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                  >
                    <Icon name={showAddForm ? 'XMarkIcon' : 'PlusIcon'} size={14} />
                    {showAddForm ? 'Cancel' : 'New Activity Entry'}
                  </button>
                  {(userRole === 'admin' || userRole === 'hod') && !embedded && filteredEntries.length > 0 && (
                    <button
                      onClick={() => setSelectedIds(new Set(filteredEntries.map(e => e.id)))}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white text-xs font-bold transition-all flex items-center gap-2 border border-blue-500/30"
                    >
                      <Icon name="CheckCircleIcon" size={14} />
                      Select All Filtered
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }} ref={formRef}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>Create Activity Entry</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Activity Name</label>
              <input
                type="text"
                className="input-base text-sm"
                placeholder="e.g. Monthly KPI Achievement"
                value={newEntry.activityName || ''}
                onChange={e => setNewEntry(prev => ({ ...prev, activityName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Incident Date</label>
              <input
                type="date"
                className="input-base text-sm cursor-pointer"
                value={newEntry.date || ''}
                onChange={e => handleNewDateChange(e.target.value)}
                onClick={(e) => (e.currentTarget as any).showPicker?.()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Period Month</label>
              <select
                className="input-base text-sm"
                value={newEntry.month || 'January'}
                onChange={e => setNewEntry(prev => ({ ...prev, month: e.target.value }))}
              >
                {ACTIVITY_MONTHS.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 lg:col-span-3 relative space-y-1.5" ref={employeeDropdownRef}>
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Assigned Employees *</label>
              <button
                type="button"
                onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                className="input-base text-sm w-full flex items-center justify-between py-2 px-3"
                style={{ background: 'rgb(var(--bg-elevated))' }}
              >
                <span className={selectedEmployeeIds.length === 0 ? 'text-slate-500' : 'text-slate-800 dark:text-slate-200'}>
                  {selectedEmployeeIds.length === 0 
                    ? 'Select employees...' 
                    : `${selectedEmployeeIds.length} employee(s) selected`}
                </span>
                <Icon name={showEmployeeDropdown ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="text-slate-400" />
              </button>

              {showEmployeeDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg border shadow-2xl p-2 max-h-60 overflow-y-auto"
                    style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border-subtle))' }}>
                    <div className="flex items-center justify-between px-2 mb-2 pb-1 border-b border-black/5 dark:border-white/5">
                        <button 
                          type="button"
                          className="text-[10px] font-bold text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 uppercase tracking-wider"
                          onClick={() => setSelectedEmployeeIds(users.filter(u => showInactive ? u.status === 'inactive' : u.status === 'active').map(u => u.id))}
                        >
                          Select All
                        </button>
                        <button 
                          type="button"
                          className="text-[10px] font-bold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 uppercase tracking-wider"
                          onClick={() => setSelectedEmployeeIds([])}
                        >
                          Clear
                        </button>
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {users.filter(u => showInactive ? u.status === 'inactive' : u.status === 'active').map(user => (
                        <label
                          key={user.id}
                          className="flex items-center gap-2 rounded-md px-3 py-1.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          style={{ background: selectedEmployeeIds.includes(user.id) ? 'rgba(79,127,255,0.12)' : 'transparent' }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedEmployeeIds.includes(user.id)}
                            onChange={() => toggleEmployee(user.id)}
                            className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-blue-500 focus:ring-blue-500"
                          />
                          <span className="text-sm flex-1" style={{ color: selectedEmployeeIds.includes(user.id) ? 'rgb(var(--text-primary))' : 'rgb(var(--text-secondary))' }}>
                            {user.name}
                          </span>
                          {user.status === 'inactive' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-bold uppercase">Inactive</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Scoring Category</label>
              <select
                className="input-base text-sm"
                value={newEntry.category}
                onChange={e => setNewCategory(e.target.value)}
              >
                {[
                  systemWeights?.performanceLabel || 'Performance',
                  systemWeights?.participationLabel || 'Participation',
                  systemWeights?.popularityLabel || 'Popularity'
                ].map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Score Bucket</label>
              <select
                className="input-base text-sm"
                value={newEntry.scoreBucket || 'KPI'}
                onChange={e => setNewBucket(e.target.value)}
              >
                {filteredBuckets.map(bucket => (
                  <option key={bucket} value={bucket}>
                    {bucket}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Weighted Score</label>
              <input
                type="number"
                className="input-base text-sm"
                placeholder="Score"
                value={newEntry.score ?? 0}
                onChange={e => setNewEntry(prev => ({ ...prev, score: Number(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Verification Attachment</label>
              <label className="input-base text-sm flex items-center gap-3 cursor-pointer">
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
                />
                <Icon name="PaperClipIcon" size={14} className="text-slate-500" />
                <span className="flex-1" style={{ color: attachmentFile ? 'rgb(var(--text-primary))' : 'rgb(var(--text-muted))' }}>
                  {attachmentFile ? attachmentFile.name : 'Upload PDF, JPG, PNG'}
                </span>
                {attachmentFile && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setAttachmentFile(null); }} className="p-1 hover:bg-white/10 rounded-full">
                    <Icon name="XMarkIcon" size={14} className="text-red-400" />
                  </button>
                )}
              </label>
            </div>

            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Detailed Description / Notes</label>
              <textarea
                className="input-base text-sm min-h-[80px] py-2"
                placeholder="Enter additional details or justification for this entry..."
                value={newEntry.description || ''}
                onChange={e => setNewEntry(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button 
              className="btn-primary flex items-center justify-center min-w-[120px]" 
              onClick={createEntry}
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-white/30 border-t-white mr-2" />
                  Saving...
                </>
              ) : 'Save & Sync'}
            </button>
            <button className="btn-ghost" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showFilters && (
        <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Year</label>
              <select 
                className="input-base text-sm w-full" 
                value={selectedYear} 
                onChange={e => setSelectedYear(Number(e.target.value))}
                disabled={!!externalYear}
              >
                {availableYears.map(y => (
                  <option key={y.year} value={y.year}>{y.year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Month</label>
              <select 
                className="input-base text-sm w-full" 
                value={filterMonth} 
                onChange={e => setFilterMonth(e.target.value)}
              >
                <option value="All">All Months</option>
                {ACTIVITY_MONTHS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Date From</label>
              <input type="date" className="input-base text-sm w-full cursor-pointer" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} onClick={(e) => (e.currentTarget as any).showPicker?.()} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Date To</label>
              <input type="date" className="input-base text-sm w-full cursor-pointer" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} onClick={(e) => (e.currentTarget as any).showPicker?.()} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Category</label>
              <select className="input-base text-sm w-full" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="All">All Categories</option>
                {[
                  systemWeights?.performanceLabel || 'Performance',
                  systemWeights?.participationLabel || 'Participation',
                  systemWeights?.popularityLabel || 'Popularity'
                ].map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Search</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-base text-sm w-full"
                  placeholder="Activity / Employee"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {(userRole === 'admin' || userRole === 'hod') && !embedded && !externalEmployeeId && (
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-white/5 transition-all whitespace-nowrap"
                    style={{ borderColor: showInactive ? 'rgb(var(--text-primary))' : 'rgb(var(--border-subtle))' }}>
                    <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: showInactive ? 'rgb(var(--text-primary))' : 'rgb(var(--text-muted))' }}>Show Inactive</span>
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgb(var(--border-subtle))' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
              {(canDelete && userRole !== 'employee') && (
                <th className="px-3 py-3 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-white/20 bg-black/20 text-blue-500 focus:ring-0" 
                    checked={selectedIds.size === filteredEntries.length && filteredEntries.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              <th className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Activity</th>
              {userRole !== 'employee' && (
                <th className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Employee</th>
              )}
              <th className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Month</th>
              <th className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Category</th>
              <th className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Bucket</th>
              <th className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Score</th>
              <th className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Attachment</th>
              <th className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={(canDelete && userRole !== 'employee') ? 9 : (userRole === 'employee' ? 7 : 8)} className="px-4 py-12">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                    <span className="text-xs font-medium" style={{ color: 'rgb(var(--text-muted))' }}>Loading activity records...</span>
                  </div>
                </td>
              </tr>
            ) : filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={(canDelete && userRole !== 'employee') ? 9 : (userRole === 'employee' ? 7 : 8)} className="px-4 py-6 text-center text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                  No activity records found
                </td>
              </tr>
            ) : (
              filteredEntries.map(entry => {
                const colors = getCategoryColor(entry.category);
                return (
                  <tr key={entry.id} className="group" style={{ borderBottom: '1px solid rgb(var(--border))', background: selectedIds.has(entry.id) ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                    {(canDelete && userRole !== 'employee') && (
                      <td className="px-3 py-3 text-center">
                        <input 
                          type="checkbox" 
                          className="rounded border-white/20 bg-black/20 text-blue-500 focus:ring-0" 
                          checked={selectedIds.has(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                        />
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <InlineEditableField
                            initialValue={entry.activityName}
                            onSave={(val) => handleAsyncSave(entry, { activityName: val })}
                            textClassName="text-slate-700 dark:text-slate-200 font-semibold"
                            placeholder="Activity name"
                            readOnly={editingId !== entry.id}
                          />
                          <div className="mt-1 pl-2 border-l border-white/5 space-y-1">
                             <InlineEditableField
                              initialValue={isVoteRecord(entry) ? formatVoteDescription(entry.description) : (entry.description || '')}
                              onSave={(val) => handleAsyncSave(entry, { description: val })}
                              textClassName="text-[11px] text-slate-500 italic"
                              placeholder="Add details..."
                              readOnly={editingId !== entry.id}
                            />
                            <p className="text-[10px] text-slate-600 font-medium">{entry.date}</p>
                          </div>
                        </div>
                        {entry.updatedBy && (
                          <div className="group/audit relative">
                            <button 
                              type="button" 
                              onClick={() => setHistoryEntry(entry)}
                              className="p-1 rounded-md hover:bg-white/5 transition-colors"
                            >
                              <Icon name="ClockIcon" size={14} className="text-slate-500 hover:text-blue-400" />
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-slate-900 text-[10px] text-slate-200 rounded-lg shadow-2xl border border-white/10 opacity-0 group-hover/audit:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                              <p className="font-bold text-blue-400 uppercase tracking-tighter mb-0.5">Audit Info</p>
                               <p>Last Updated by: <span className="text-white">{isVoteRecord(entry) ? 'Anonymous' : decodeURIComponent(entry.updatedBy || '')}</span></p>
                              {entry.updatedAt && (
                               <p className="text-[9px] text-slate-400 mt-0.5">
                                  {new Date(entry.updatedAt).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                                </p>
                              )}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    {userRole !== 'employee' && (
                      <td className="px-3 py-3 text-xs">
                        {editingId === entry.id ? (
                          <select
                            className="input-base text-[11px] py-0.5 w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-white/10"
                            value={entry.assignedToName}
                            onChange={async (e) => {
                              const selected = users.find(item => item.name === e.target.value);
                              if (selected) {
                                updateLocalEntry(entry.id, { assignedToName: selected.name, assignedToId: selected.id });
                              }
                            }}
                          >
                            {users.map(user => (
                              <option key={user.id} value={user.name}>{user.name}</option>
                            ))}
                          </select>
                        ) : (
                          <Link 
                            href={`/admin-panel/users?id=${entry.assignedToId}`}
                            className="text-blue-400 hover:text-blue-300 hover:underline transition-all block font-medium"
                          >
                            {entry.assignedToName}
                          </Link>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-3 text-xs">
                      {editingId === entry.id ? (
                        <select 
                          className="input-base text-[11px] py-0.5 w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-white/10"
                          value={entry.month} 
                          onChange={(e) => updateLocalEntry(entry.id, { month: e.target.value })}
                        >
                          {ACTIVITY_MONTHS.map(month => (
                            <option key={month} value={month}>{month}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ color: 'rgb(var(--text-secondary))' }}>{entry.month}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {editingId === entry.id ? (
                        <select
                          className="input-base text-[11px] py-0.5 w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-white/10"
                          value={entry.category}
                          onChange={(e) => {
                            const category = e.target.value;
                            updateLocalEntry(entry.id, {
                              category,
                              scoreBucket: DEFAULT_BUCKET_BY_CATEGORY[category] || entry.scoreBucket,
                            });
                          }}
                        >
                          {ACTIVITY_CATEGORIES.map(category => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ color: colors.text }}>{entry.category}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {editingId === entry.id ? (
                        <select
                          className="input-base text-[11px] py-0.5 w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-white/10"
                          value={entry.scoreBucket}
                          onChange={(e) => {
                            const scoreBucket = e.target.value;
                            updateLocalEntry(entry.id, {
                              scoreBucket,
                              category: bucketToCategory[scoreBucket] || entry.category,
                              score: dynamicStandardMarks[scoreBucket] ?? (STANDARD_MARKS[scoreBucket] || entry.score),
                            });
                          }}
                        >
                          {allBuckets.filter(b => bucketToCategory[b] === entry.category).map(bucket => (
                            <option key={bucket} value={bucket}>{bucket}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ color: 'rgb(var(--text-secondary))' }}>{entry.scoreBucket}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <InlineEditableField
                        type="number"
                        initialValue={String(entry.score)}
                        onSave={(val) => updateLocalEntry(entry.id, { score: Number(val) || 0 })}
                        textClassName="font-semibold text-blue-600 dark:text-blue-400"
                        className="w-16"
                        readOnly={editingId !== entry.id}
                      />
                    </td>
                    <td className="px-3 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                      {entry.attachmentUrl ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => window.open(entry.attachmentUrl, '_blank', 'noopener,noreferrer')}
                            className="inline-flex items-center gap-1"
                            style={{ color: 'rgb(79 127 255)' }}
                          >
                            <Icon name="PaperClipIcon" size={12} />
                            <span className="max-w-[80px] truncate">{entry.attachmentName || 'Open'}</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-600 italic text-[10px]">No file</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 items-center">
                        {editingId === entry.id ? (
                          <>
                            <button
                              className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold disabled:opacity-50 flex items-center gap-1"
                              onClick={() => saveEdit(entry)}
                              disabled={saving}
                            >
                              {saving && editingId === entry.id ? (
                                <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-white" />
                              ) : null}
                              {saving && editingId === entry.id ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold"
                              onClick={() => {
                                setEditingId(null);
                                void loadEntries();
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {canEdit && userRole !== 'employee' && (
                              <button 
                                className="p-1.5 rounded-lg hover:bg-blue-400/10 text-slate-500 hover:text-blue-400 transition-all opacity-0 group-hover:opacity-100" 
                                onClick={() => {
                                  setEditingId(entry.id);
                                }}
                                title="Edit Record"
                              >
                                <Icon name="PencilSquareIcon" size={14} />
                              </button>
                            )}
                            {canDelete && userRole !== 'employee' && (
                              <button 
                                className="p-1.5 rounded-lg hover:bg-red-400/10 text-slate-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100" 
                                onClick={() => setDeleteId(entry.id)}
                                title="Delete Record"
                              >
                                <Icon name="TrashIcon" size={14} />
                              </button>
                            )}
                            {(!canEdit || userRole === 'employee') && (!canDelete || userRole === 'employee') && (
                              <span className="text-[10px] text-slate-600 dark:text-slate-500 italic">View Only</span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={deleteId !== null}
        title="Delete Activity Entry"
        message="This will remove the activity and re-sync performance summary totals. Continue?"
        confirmLabel="Delete"
        variant="danger"
        loading={saving}
        onConfirm={() => deleteId && removeEntry(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmModal
        open={bulkDeleteConfirm}
        title="Bulk Delete Activities"
        message={`You are about to delete ${selectedIds.size} records. This action cannot be undone. Continue?`}
        confirmLabel="Bulk Delete"
        variant="danger"
        loading={saving}
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
      {/* History Modal */}
      <ConfirmModal
        open={!!historyEntry}
        onConfirm={() => setHistoryEntry(null)}
        title="Activity Audit History"
        message="Timeline of changes for this record."
        confirmLabel="Close"
        cancelLabel={null}
        variant="info"
      >
        <div className="space-y-4 py-2">
          <div className="flex flex-col gap-1 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Current Record</p>
            <p className="text-sm font-semibold">{historyEntry?.activityName}</p>
            <p className="text-[10px] text-muted-foreground">{historyEntry?.assignedToName} | {historyEntry?.date}</p>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Modification Log</p>
            {loadingAudit ? (
              <div className="py-4 text-center text-xs animate-pulse">Loading history...</div>
            ) : auditLogs.length === 0 ? (
              <div className="py-2 pl-6 relative before:absolute before:left-[11px] before:top-1 before:bottom-1 before:w-[1px] before:bg-white/10">
                <div className="relative">
                  <div className="absolute -left-[18px] top-1 w-2 h-2 rounded-full bg-white/20 border border-[#0b0e14]" />
                  <p className="text-[10px] text-muted-foreground italic">No detailed audit logs found for this record.</p>
                </div>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-1 before:bottom-1 before:w-[1px] before:bg-white/10">
                {auditLogs.map((log, idx) => (
                  <div key={log.logId || idx} className="relative">
                    <div className={`absolute -left-[19px] top-1 w-3 h-3 rounded-full border-2 border-[#0b0e14] ${idx === 0 ? 'bg-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]' : 'bg-slate-700'}`} />
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold">{decodeURIComponent(log.actor || 'Unknown')}</p>
                        <p className="text-[10px] text-blue-400 font-medium uppercase tracking-tighter mt-0.5">{log.action}</p>
                        
                        {log.payload?.diffs && (
                          <div className="mt-2 space-y-1.5 border-l border-white/5 pl-2 py-1">
                            {Object.entries(log.payload.diffs).map(([field, vals]: [string, any]) => (
                              <div key={field} className="text-[10px]">
                                <span className="text-slate-400 capitalize">{field.replace(/([A-Z])/g, ' $1')}: </span>
                                <span className="text-red-400 line-through opacity-70">{String(vals.from)}</span>
                                <Icon name="ArrowRightIcon" size={8} className="inline mx-1 text-slate-600" />
                                <span className="text-emerald-400 font-semibold">{String(vals.to)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-muted-foreground px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                        {new Date(log.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="relative opacity-50">
                  <div className="absolute -left-[18px] top-1 w-2 h-2 rounded-full bg-white/20 border border-[#0b0e14]" />
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold">System</p>
                      <p className="text-[10px] text-muted-foreground italic">Initial creation of record</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ConfirmModal>
      <ConfirmModal
        open={showDeleteAllConfirm}
        title="Delete All Filtered Records"
        message={`This will permanently delete ALL ${filteredEntries.length} records currently shown in the table based on your filters. This action cannot be undone. Continue?`}
        confirmLabel={`Delete ${filteredEntries.length} Records`}
        variant="danger"
        onConfirm={handleDeleteAllFiltered}
        onCancel={() => setShowDeleteAllConfirm(false)}
      />
    </div>
  );
}
