'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { toast } from 'sonner';
import InlineEditableField from '@/components/ui/InlineEditableField';
import { useAppContext } from '@/context/AppContext';
import { buildClientAuthHeaders } from '@/lib/clientAuth';

type PenaltyRecord = {
  id: string;
  employeeId?: string;
  employeeName: string;
  dept: string;
  date: string;
  year: number;
  mistake: string;
  category: string;
  notes: string;
  cashAmount?: number;
};

type UserOption = {
  id: string;
  name: string;
  dept: string;
  role: string;
  status: string;
};


export default function PenaltiesCrudPanel({
  departmentScope,
  allowCashPenalties = true,
  embedded = false,
  canEdit = true,
  canDelete = true,
  showAddButton = true,
  externalEmployeeId
}: {
  departmentScope?: string;
  allowCashPenalties?: boolean;
  embedded?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  showAddButton?: boolean;
  externalEmployeeId?: string;
}) {
  const { selectedYear, userRole, userId, userDepartment, userName, silentMode } = useAppContext();
  const [records, setRecords] = useState<PenaltyRecord[]>([]);

  const authHeaders = useMemo(() => {
    return buildClientAuthHeaders({
      role: (userRole || 'hod') as any,
      userId: userId || 'u-001',
      userName: userName || 'HOD',
      department: userDepartment || 'Operations',
      silentMode
    });
  }, [userRole, userId, userName, userDepartment, silentMode]);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [penaltyTypes, setPenaltyTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterYear, setFilterYear] = useState<number | 'All'>(selectedYear);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [activeTab, setActiveTab] = useState<'Standard' | 'Cash'>('Standard');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPenalty, setNewPenalty] = useState<Partial<PenaltyRecord>>({
    category: 'Tier 1',
    year: selectedYear,
    dept: 'Operations',
  });

  useEffect(() => {
    setFilterYear(selectedYear);
  }, [selectedYear]);

  // Draft persistence
  useEffect(() => {
    const saved = localStorage.getItem('penalty_draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNewPenalty(parsed);
        setShowAddForm(true);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (showAddForm && (newPenalty.employeeName || newPenalty.mistake)) {
      localStorage.setItem('penalty_draft', JSON.stringify(newPenalty));
    } else if (!showAddForm) {
      localStorage.removeItem('penalty_draft');
    }
  }, [newPenalty, showAddForm]);

  const formRef = useRef<HTMLDivElement>(null);

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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddForm]);

  const loadUsers = async () => {
    // Only admins/hods need the user list for selection dropdowns
    if (userRole === 'employee' || userRole === 'intern' || userRole === 'probation') return;

    try {
      const response = await fetch('/api/users', { headers: authHeaders });
      if (!response.ok) throw new Error('Failed to load users');
      const payload = await response.json();
      const baseUsers = payload.users
        .filter((u: any) => u.role !== 'admin');

      const finalUsers = departmentScope
        ? baseUsers.filter((u: any) => u.dept === departmentScope)
        : baseUsers;

      setUsers(
        finalUsers.map((item: any) => ({
          id: item.id,
          name: item.name,
          dept: item.dept || 'Operations',
          role: item.role,
          status: item.status || 'active'
        }))
      );
    } catch {
      toast.error('Failed to load users list');
    }
  };

  const loadPenalties = async () => {
    if (!authHeaders) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterYear !== 'All') params.set('year', String(filterYear));
      if (externalEmployeeId) params.set('employeeId', externalEmployeeId);
      if (departmentScope) params.set('department', departmentScope);

      const response = await fetch(`/api/penalties?${params.toString()}`, { headers: authHeaders });
      if (!response.ok) throw new Error('Failed to load penalties');
      const payload = await response.json();
      setRecords(Array.isArray(payload?.records) ? payload.records : []);
    } catch (err) {
      console.error('loadPenalties error:', err);
      toast.error('Failed to load penalty records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };


  const loadPenaltyTypes = async () => {
    try {
      const response = await fetch('/api/performance-management?mode=penalty-types', { headers: authHeaders });
      if (!response.ok) throw new Error('Failed to load penalty types');
      const payload = await response.json();
      if (Array.isArray(payload?.penaltyTypes)) {
        setPenaltyTypes(payload.penaltyTypes);
        if (!newPenalty.category && payload.penaltyTypes.length > 0) {
          setNewPenalty(prev => ({
            ...prev,
            category: payload.penaltyTypes[0].typeName,
          }));
        }
      }
    } catch {
      toast.error('Failed to load penalty categories');
    }
  };

  useEffect(() => {
    void loadUsers();
    void loadPenaltyTypes();
  }, []);

  useEffect(() => {
    if (authHeaders) {
      void loadPenalties();
    }
  }, [filterYear, externalEmployeeId, departmentScope, authHeaders]);


  const availableYears = useMemo(
    () => Array.from(new Set(records.map(record => record.year))).sort((a, b) => b - a),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const userMap = new Map(users.map(u => [u.name, u]));
    return records.filter(record => {
      if (departmentScope && record.dept !== departmentScope) return false;

      if (filterYear !== 'All' && record.year !== Number(filterYear)) return false;

      const user = userMap.get(record.employeeName);
      const isInactive = user ? user.status === 'inactive' : false;
      if (showInactive) {
        if (!isInactive) return false;
      } else {
        if (isInactive) return false;
      }

      if (filterStartDate) {
        if (new Date(record.date) < new Date(filterStartDate)) return false;
      }
      if (filterEndDate) {
        if (new Date(record.date) > new Date(filterEndDate)) return false;
      }

      if (!searchQuery) return true;

      const query = searchQuery.toLowerCase();
      return record.employeeName.toLowerCase().includes(query) || record.mistake.toLowerCase().includes(query);
    });
  }, [records, filterYear, filterStartDate, filterEndDate, searchQuery, showInactive, users, departmentScope]);

  const standardRecords = useMemo(() => filteredRecords.filter(r => !r.cashAmount || r.cashAmount === 0), [filteredRecords]);
  const cashRecords = useMemo(() => filteredRecords.filter(r => (r.cashAmount || 0) > 0), [filteredRecords]);
  const displayRecords = activeTab === 'Standard' ? standardRecords : cashRecords;


  const updateLocalRecord = (id: string, patch: Partial<PenaltyRecord>) => {
    setRecords(prev => prev.map(record => (record.id === id ? { ...record, ...patch } : record)));
  };

  const handleAsyncSave = async (record: PenaltyRecord, patch: Partial<PenaltyRecord>) => {
    const updated = { ...record, ...patch };
    await saveEdit(updated);
  };


  const createPenalty = async () => {
    if (!newPenalty.employeeName?.trim() || !newPenalty.mistake?.trim() || !newPenalty.date) {
      toast.error('Employee, date and mistake are required');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/penalties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ ...newPenalty, year: Number(newPenalty.year || selectedYear) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Failed to create penalty');

      await loadPenalties();
      setShowAddForm(false);
      setNewPenalty({
        category: 'Tier 1',
        year: selectedYear,
        dept: 'Operations',
        cashAmount: 0,
      });
      toast.success('Penalty history record created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create penalty');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (record: PenaltyRecord) => {
    if (!record.employeeName?.trim() || !record.mistake?.trim() || !record.date) {
      toast.error('Employee, date and mistake are required');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/penalties?id=${encodeURIComponent(record.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(record),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Failed to update penalty');

      await loadPenalties();
      setEditingId(null);
      toast.success('Penalty history record updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update penalty');
    } finally {
      setSaving(false);
    }
  };

  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const handleDeleteAllFiltered = async () => {
    if (displayRecords.length === 0) return;
    setSaving(true);
    try {
      for (const record of displayRecords) {
        await fetch(`/api/penalties?id=${encodeURIComponent(record.id)}`, {
          method: 'DELETE',
          headers: authHeaders
        });
      }
      toast.success(`Deleted ${displayRecords.length} records`);
      await loadPenalties();
    } catch (err) {
      toast.error('Failed to delete all records');
    } finally {
      setSaving(false);
      setShowDeleteAllConfirm(false);
    }
  };

  const removePenalty = async (id: string) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/penalties?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Failed to delete penalty');

      await loadPenalties();
      setDeleteId(null);
      toast.success('Penalty history record deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete penalty');
    } finally {
      setSaving(false);
    }
  };

  if (embedded) {
    return (
      <div className="space-y-4">
        {showAddButton && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Icon name={showAddForm ? 'XMarkIcon' : 'PlusIcon'} size={14} />
              {showAddForm ? 'Cancel' : 'New Penalty Record'}
            </button>
          </div>
        )}

        {showAddForm && (
          <div className="rounded-xl p-5 mb-6 border border-white/5 bg-white/5 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Employee</label>
                <select
                  className="input-base text-sm w-full"
                  value={newPenalty.employeeName || ''}
                  onChange={e => {
                    const user = users.find(u => u.name === e.target.value);
                    setNewPenalty(prev => ({
                      ...prev,
                      employeeName: e.target.value,
                      employeeId: user?.id,
                      dept: user?.dept || prev.dept
                    }));
                  }}
                >
                  <option value="">Select Employee</option>
                  {users.map(user => (
                    <option key={user.id} value={user.name}>{user.name} ({user.dept})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Date</label>
                <input type="date" className="input-base text-sm w-full cursor-pointer" value={newPenalty.date || ''} onChange={e => setNewPenalty(prev => ({ ...prev, date: e.target.value }))} onClick={(e) => (e.currentTarget as any).showPicker?.()} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Category</label>
                <input type="text" className="input-base text-sm w-full" value={newPenalty.category || ''} onChange={e => setNewPenalty(prev => ({ ...prev, category: e.target.value }))} />
              </div>
              {activeTab === 'Cash' && (
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Cash Amount (MYR)</label>
                  <input type="number" className="input-base text-sm w-full" value={newPenalty.cashAmount || 0} onChange={e => setNewPenalty(prev => ({ ...prev, cashAmount: Number(e.target.value) }))} />
                </div>
              )}
              <div className="md:col-span-2 lg:col-span-3">
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Incident / Mistake Detail</label>
                <textarea
                  className="input-base text-sm w-full h-20"
                  value={newPenalty.mistake || ''}
                  onChange={e => setNewPenalty(prev => ({ ...prev, mistake: e.target.value }))}
                  placeholder="Describe the incident..."
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={createPenalty} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold flex items-center gap-2">
                {saving && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
                Save History Record
              </button>
            </div>
          </div>
        )}

        <div className="rounded-lg overflow-hidden border border-white/5">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="px-3 py-3 text-left font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Date</th>
                <th className="px-3 py-3 text-left font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Mistake</th>
                <th className="px-3 py-3 text-left font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Category</th>
                <th className="px-3 py-3 text-right font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {displayRecords.map(record => (
                <tr key={record.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap">{record.date}</td>
                  <td className="px-3 py-3">
                    <InlineEditableField
                      initialValue={record.mistake}
                      onSave={(val) => handleAsyncSave(record, { mistake: val })}
                      className="w-full"
                      readOnly={!canEdit || userRole === 'employee' || record.employeeId === userId}
                    />
                  </td>
                  <td className="px-3 py-3">{record.category}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canEdit && userRole !== 'employee' && record.employeeId !== userId && (
                        <button className="text-blue-400 hover:text-blue-300 font-bold" onClick={() => setEditingId(record.id)}>Edit</button>
                      )}
                      {canDelete && userRole !== 'employee' && record.employeeId !== userId && (
                        <button className="text-red-400 hover:text-red-300 font-bold" onClick={() => setDeleteId(record.id)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {displayRecords.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center italic" style={{ color: 'rgb(var(--text-muted))' }}>No penalty records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-4" style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.3)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'rgb(248 113 113)' }}>Penalties History</h2>
            {/* <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
              {loading ? 'Loading penalty history...' : saving ? 'Saving penalty updates...' : `Synced history records: ${records.length}`}
            </p> */}
          </div>
          <div className="flex items-center gap-3">
            {showAddButton && (userRole === 'admin' || (userRole === 'hod' && !externalEmployeeId)) && (
              <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
                <Icon name="PlusIcon" size={14} className="inline mr-1" />
                New History Record
              </button>
            )}
            {canDelete && (userRole === 'admin' || userRole === 'hod') && !embedded && displayRecords.length > 0 && (
              <button
                onClick={() => setShowDeleteAllConfirm(true)}
                className="px-3 py-1.5 rounded-lg bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white text-xs font-bold transition-all flex items-center gap-2 border border-red-500/30"
                title="Delete all items currently shown in the table (filtered)"
              >
                <Icon name="TrashIcon" size={14} />
                Delete All Filtered
              </button>
            )}
          </div>
        </div>
      </div>

      {showAddForm && (
        <div ref={formRef} className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>Create Penalty Record</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold ml-1" style={{ color: 'rgb(var(--text-muted))' }}>Target Employee</label>
              <select
                className="input-base text-sm"
                value={newPenalty.employeeName || ''}
                onChange={e => {
                  const selected = users.find(user => user.name === e.target.value);
                  setNewPenalty(prev => ({
                    ...prev,
                    employeeName: e.target.value,
                    employeeId: selected?.id,
                    dept: selected?.dept || 'Operations'
                  }));
                }}
              >
                <option value="">Select Employee *</option>
                {users.map(user => (
                  <option key={user.id} value={user.name}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold ml-1" style={{ color: 'rgb(var(--text-muted))' }}>Penalty Date</label>
              <input
                type="date"
                className="input-base text-sm cursor-pointer"
                value={newPenalty.date || ''}
                onChange={e => setNewPenalty(prev => ({ ...prev, date: e.target.value }))}
                onClick={(e) => (e.currentTarget as any).showPicker?.()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold ml-1" style={{ color: 'rgb(var(--text-muted))' }}>Reference Year</label>
              <input
                type="number"
                className="input-base text-sm"
                value={newPenalty.year || selectedYear}
                onChange={e => setNewPenalty(prev => ({ ...prev, year: Number(e.target.value) || selectedYear }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold ml-1" style={{ color: 'rgb(var(--text-muted))' }}>Penalty Type / Category</label>
              <select
                className="input-base text-sm"
                value={newPenalty.category || ''}
                onChange={e => {
                  const type = penaltyTypes.find(t => t.typeName === e.target.value);
                  setNewPenalty(prev => ({
                    ...prev,
                    category: e.target.value,
                  }));
                }}
              >
                {penaltyTypes.map(type => (
                  <option key={type.id} value={type.typeName}>
                    {type.typeName}
                  </option>
                ))}
              </select>
            </div>
            {userRole === 'admin' && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold ml-1" style={{ color: 'rgb(var(--text-muted))' }}>Cash Penalty (Optional)</label>
                <div className="relative">
                  <input
                    type="number"
                    className="input-base text-sm w-full pl-8"
                    placeholder="0"
                    value={newPenalty.cashAmount || ''}
                    onChange={e => setNewPenalty(prev => ({ ...prev, cashAmount: Number(e.target.value) || 0 }))}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">RM</span>
                </div>
              </div>
            )}
            <div className="space-y-1 col-span-1 md:col-span-2 lg:col-span-3">
              <label className="text-[10px] uppercase font-bold ml-1" style={{ color: 'rgb(var(--text-muted))' }}>Incident / Mistake Detail</label>
              <textarea
                className="input-base text-sm w-full"
                rows={2}
                placeholder="Describe the incident..."
                value={newPenalty.mistake || ''}
                onChange={e => setNewPenalty(prev => ({ ...prev, mistake: e.target.value }))}
              />
            </div>
            <div className="space-y-1 col-span-1 md:col-span-2 lg:col-span-3">
              <label className="text-[10px] uppercase font-bold ml-1" style={{ color: 'rgb(var(--text-muted))' }}>Internal Notes</label>
              <textarea
                className="input-base text-sm w-full"
                rows={2}
                placeholder="Internal notes or follow-up actions..."
                value={newPenalty.notes || ''}
                onChange={e => setNewPenalty(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="btn-primary" onClick={createPenalty}>Save Record</button>
            <button className="btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Year</label>
            <select
              className="input-base text-sm w-full"
              value={filterYear}
              onChange={e => setFilterYear(e.target.value === 'All' ? 'All' : Number(e.target.value))}
            >
              <option value="All">All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
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
          <div className="md:col-span-2">
            <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>Search</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input-base text-sm w-full"
                placeholder={userRole === 'employee' ? "Search mistake..." : "Employee / mistake"}
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

      <div className="flex border-b border-white/5 gap-6">
        <button
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === 'Standard' ? 'text-blue-400' : 'text-muted-foreground hover:text-white'}`}
          onClick={() => setActiveTab('Standard')}
        >
          Warning Penalties ({standardRecords.length})
          {activeTab === 'Standard' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 animate-in fade-in slide-in-from-bottom-1" />}
        </button>
        {allowCashPenalties && (
          <button
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === 'Cash' ? 'text-amber-400' : 'text-muted-foreground hover:text-white'}`}
            onClick={() => setActiveTab('Cash')}
          >
            Cash Penalties ({cashRecords.length})
            {activeTab === 'Cash' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 animate-in fade-in slide-in-from-bottom-1" />}
          </button>
        )}
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgb(var(--border-subtle))' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
              <th className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Employee</th>
              <th className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Date</th>
              <th className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Mistake</th>
              <th className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Category</th>
              {activeTab === 'Cash' && <th className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Amount</th>}
              {(canEdit || canDelete) && (
                <th className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={(activeTab === 'Cash' ? 5 : 4) + (canEdit || canDelete ? 1 : 0)} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                    <p className="text-sm font-medium animate-pulse" style={{ color: 'rgb(var(--text-muted))' }}>Loading penalties records...</p>
                  </div>
                </td>
              </tr>
            ) : displayRecords.length === 0 ? (
              <tr>
                <td colSpan={(activeTab === 'Cash' ? 5 : 4) + (canEdit || canDelete ? 1 : 0)} className="px-4 py-6 text-center text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                  No {activeTab.toLowerCase()} records found
                </td>
              </tr>
            ) : (
              displayRecords.map(record => (
                <tr key={record.id} style={{ borderBottom: '1px solid rgb(var(--border))' }}>
                  <td className="px-3 py-3">
                        <InlineEditableField
                          type="select"
                          initialValue={record.employeeName}
                          options={users.map(u => ({ value: u.name, label: u.name }))}
                          onSave={(val) => {
                            const selected = users.find(user => user.name === val);
                            handleAsyncSave(record, { 
                              employeeName: val, 
                              employeeId: selected?.id, 
                              dept: selected?.dept || record.dept 
                            });
                          }}
                          readOnly={!canEdit || userRole === 'employee' || record.employeeId === userId}
                        />
                        <p className="text-[10px] opacity-70 ml-2" style={{ color: 'rgb(var(--text-muted))' }}>{record.dept}</p>
                    </td>
                    <td className="px-3 py-3">
                        <InlineEditableField
                          type="date"
                          initialValue={record.date}
                          onSave={(val) => handleAsyncSave(record, { date: val })}
                          textClassName="text-xs"
                          readOnly={!canEdit || userRole === 'employee' || record.employeeId === userId}
                        />
                    </td>
                    <td className="px-3 py-3">
                      <InlineEditableField
                        type="textarea"
                        initialValue={record.mistake}
                        onSave={(val) => handleAsyncSave(record, { mistake: val })}
                        textClassName="text-xs font-medium"
                        style={{ color: 'rgb(var(--text-primary))' }}
                        placeholder="Describe incident"
                        readOnly={!canEdit || userRole === 'employee' || record.employeeId === userId}
                      />
                      {record.notes && (
                        <div className="mt-1">
                          <label className="text-[9px] uppercase font-bold text-slate-500 block">Internal Notes</label>
                          <InlineEditableField
                            type="textarea"
                            initialValue={record.notes}
                            onSave={(val) => handleAsyncSave(record, { notes: val })}
                            textClassName="text-[10px] opacity-60 italic"
                            style={{ color: 'rgb(var(--text-muted))' }}
                            placeholder="Add notes..."
                            readOnly={!canEdit || userRole === 'employee' || record.employeeId === userId}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                        <InlineEditableField
                          type="select"
                          initialValue={record.category}
                          options={penaltyTypes.map(t => ({ value: t.typeName, label: t.typeName }))}
                          onSave={(val) => handleAsyncSave(record, { category: val })}
                          textClassName="text-xs"
                          readOnly={!canEdit || userRole === 'employee' || record.employeeId === userId}
                        />
                    </td>
                    {activeTab === 'Cash' && (
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-amber-500 font-bold">RM</span>
                          <InlineEditableField
                            type="number"
                            initialValue={String(record.cashAmount || 0)}
                            onSave={(val) => handleAsyncSave(record, { cashAmount: Number(val) || 0 })}
                            textClassName="font-bold text-amber-600 dark:text-amber-500"
                            className="w-20"
                            readOnly={!canEdit || userRole !== 'admin' || record.employeeId === userId}
                          />
                        </div>
                      </td>
                    )}
                    {(canEdit || canDelete) && (
                      <td className="px-3 py-3">
                        <div className="flex gap-1 justify-end">
                            {canDelete && userRole !== 'employee' && record.employeeId !== userId && (
                              <button
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-all"
                                onClick={() => setDeleteId(record.id)}
                                title="Delete record"
                              >
                                <Icon name="TrashIcon" size={14} />
                              </button>
                            )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={deleteId !== null}
        title="Delete Penalty Record"
        message="This will permanently remove this penalty history record. Continue?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteId && removePenalty(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
      <ConfirmModal
        open={showDeleteAllConfirm}
        title="Delete All Filtered Records"
        message={`This will permanently delete ALL ${displayRecords.length} records currently shown in the table based on your filters. This action cannot be undone. Continue?`}
        confirmLabel={`Delete ${displayRecords.length} Records`}
        variant="danger"
        onConfirm={handleDeleteAllFiltered}
        onCancel={() => setShowDeleteAllConfirm(false)}
      />
    </div>
  );
}
