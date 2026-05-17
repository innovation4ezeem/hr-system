'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { toast } from 'sonner';
import InlineEditableField from '@/components/ui/InlineEditableField';
import { useAppContext } from '@/context/AppContext';
import { buildClientAuthHeaders } from '@/lib/clientAuth';

type Department = {
  id: string;
  name: string;
  hodName: string;
  hodId?: string | null;
  headcount: number;
  status: 'active' | 'inactive';
};

type UserOption = {
  id: string;
  name: string;
  role: string;
  dept?: string;
  status: string;
};

export default function DepartmentsCrudPanel() {
  const { userRole, userId, userName, userDepartment, silentMode } = useAppContext();

  const authHeaders = useMemo(() => {
    return buildClientAuthHeaders({
      role: (userRole || 'admin') as any,
      userId: userId || 'admin-001',
      userName: userName || 'Admin',
      department: userDepartment || 'Headquarters',
      silentMode
    });
  }, [userRole, userId, userName, userDepartment, silentMode]);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDept, setNewDept] = useState<Partial<Department>>({
    status: 'active'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [deptRes, usersRes] = await Promise.all([
        fetch('/api/departments', { headers: authHeaders }),
        fetch('/api/users', { headers: authHeaders })
      ]);
      
      const deptData = await deptRes.json();
      const usersData = await usersRes.json();
      
      setDepartments(Array.isArray(deptData?.departments) ? deptData.departments : []);
      setUsers(Array.isArray(usersData?.users) ? usersData.users : []);
    } catch (err) {
      toast.error('Failed to load department data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredDepartments = useMemo(() => {
    if (!searchQuery) return departments;
    const query = searchQuery.toLowerCase();
    return departments.filter(d => 
      d.name.toLowerCase().includes(query) || 
      d.hodName.toLowerCase().includes(query)
    );
  }, [departments, searchQuery]);

  const createDepartment = async () => {
    if (!newDept.name?.trim()) {
      toast.error('Department name is required');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(newDept),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create department');
      }

      toast.success('Department created successfully');
      setShowAddForm(false);
      setNewDept({ status: 'active' });
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create department');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (dept: Department) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/departments?id=${encodeURIComponent(dept.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(dept),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update department');
      }

      toast.success('Department updated successfully');
      setEditingId(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update department');
    } finally {
      setSaving(false);
    }
  };

  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const handleDeleteAllFiltered = async () => {
    if (filteredDepartments.length === 0) return;
    setSaving(true);
    try {
      for (const dept of filteredDepartments) {
        await fetch(`/api/departments?id=${encodeURIComponent(dept.id)}`, {
          method: 'DELETE',
          headers: authHeaders
        });
      }
      toast.success(`Deleted ${filteredDepartments.length} departments`);
      await loadData();
    } catch (err) {
      toast.error('Failed to delete departments');
    } finally {
      setSaving(false);
      setShowDeleteAllConfirm(false);
    }
  };

  const removeDepartment = async (id: string) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/departments?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete department');
      }

      toast.success('Department deleted successfully');
      setDeleteId(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete department');
    } finally {
      setSaving(false);
    }
  };

  const updateLocalDept = (id: string, patch: Partial<Department>) => {
    setDepartments(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleAsyncSave = async (dept: Department, patch: Partial<Department>) => {
    const updated = { ...dept, ...patch };
    await saveEdit(updated);
  };


  const hodOptions = users.filter(u => u.role?.toLowerCase() === 'hod' || u.role?.toLowerCase() === 'admin');

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-4" style={{ background: 'rgba(79,127,255,0.08)', border: '1px solid rgba(79,127,255,0.3)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'rgb(79 127 255)' }}>Department Management</h2>
            <p className="text-xs mt-1 font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>
              {loading ? 'Loading...' : `Total Employees: ${users.filter(u => u.role !== 'admin').length} (Excl. Admin)`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
              <Icon name="PlusIcon" size={14} className="inline mr-1" />
              Add Department
            </button>
            
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'rgb(var(--text-primary))' }}>Create New Department</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold ml-1" style={{ color: 'rgb(var(--text-muted))' }}>Department Name</label>
              <input
                type="text"
                className="input-base text-sm"
                placeholder="e.g. Engineering"
                value={newDept.name || ''}
                onChange={e => setNewDept(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold ml-1" style={{ color: 'rgb(var(--text-muted))' }}>Head of Dept (HOD)</label>
              <select
                className="input-base text-sm"
                value={newDept.hodId || ''}
                onChange={e => {
                  const val = e.target.value;
                  const user = users.find(u => u.id === val);
                  setNewDept(prev => ({ 
                    ...prev, 
                    hodId: val || null, 
                    hodName: user?.name || 'Pending Assignment' 
                  }));
                }}
              >
                <option value="">Select HOD...</option>
                {users.filter(u => u.status === 'active').map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

          </div>
          <div className="flex gap-2 mt-3">
            <button className="btn-primary" onClick={createDepartment} disabled={saving}>
              {saving ? 'Creating...' : 'Create Department'}
            </button>
            <button className="btn-ghost" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgb(var(--text-muted))' }} />
            <input
              type="text"
              className="input-base text-sm pl-9"
              placeholder="Search departments or HODs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--text-muted))' }}>Department Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--text-muted))' }}>HOD / Manager</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--text-muted))' }}>Headcount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--text-muted))' }}>Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--text-muted))' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                      <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Loading departments...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs italic" style={{ color: 'rgb(var(--text-muted))' }}>
                    No departments found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredDepartments.map(dept => {
                  const editing = editingId === dept.id;
                  return (
                    <tr key={dept.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <InlineEditableField
                          initialValue={dept.name}
                          onSave={(val) => handleAsyncSave(dept, { name: val })}
                          textClassName="font-medium text-slate-900 dark:text-slate-200"
                          placeholder="Department name"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {editing ? (
                          <select
                            className="input-base text-sm"
                            value={dept.hodId || ''}
                            onChange={e => {
                              const val = e.target.value;
                              const user = users.find(u => u.id === val);
                              updateLocalDept(dept.id, { 
                                hodId: val || null, 
                                hodName: user?.name || 'Pending Assignment' 
                              });
                            }}
                          >
                            <option value="">Unassigned / Pending</option>
                            {users.filter(u => u.status === 'active').map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Icon name="UserIcon" size={12} className="text-blue-400" />
                             <span style={{ color: 'rgb(var(--text-secondary))' }}>{dept.hodName || 'Pending'}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                         <span className="font-mono" style={{ color: 'rgb(var(--text-secondary))' }} title={`${users.filter(u => u.dept?.trim().toLowerCase() === dept.name.trim().toLowerCase()).length} employees assigned`}>
                          {users.filter(u => u.dept?.trim().toLowerCase() === dept.name.trim().toLowerCase()).length}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {editing ? (
                          <select
                            className="input-base text-sm"
                            value={dept.status}
                            onChange={e => updateLocalDept(dept.id, { status: e.target.value as any })}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            dept.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'
                          }`}>
                            {dept.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {editing ? (
                            <>
                              <button onClick={() => saveEdit(dept)} className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-500 transition-colors" title="Save Changes">
                                <Icon name="CheckIcon" size={16} />
                              </button>
                              <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors" title="Cancel">
                                <Icon name="XMarkIcon" size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => setEditingId(dept.id)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'rgb(var(--text-muted))' }} title="Edit Department">
                                <Icon name="PencilSquareIcon" size={16} />
                              </button>
                              <button onClick={() => setDeleteId(dept.id)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'rgb(var(--text-muted))' }} title="Delete Department">
                                <Icon name="TrashIcon" size={16} />
                              </button>
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
      </div>

      <ConfirmModal
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && removeDepartment(deleteId)}
        title="Delete Department"
        message="Are you sure you want to delete this department? This action cannot be undone."
        confirmLabel="Delete Department"
        variant="danger"
      />
      <ConfirmModal
        open={showDeleteAllConfirm}
        onCancel={() => setShowDeleteAllConfirm(false)}
        onConfirm={handleDeleteAllFiltered}
        title="Delete All Filtered Departments"
        message={`Are you sure you want to delete ALL ${filteredDepartments.length} departments shown in the results? This action cannot be undone.`}
        confirmLabel={`Delete ${filteredDepartments.length} Departments`}
        variant="danger"
      />
    </div>
  );
}
