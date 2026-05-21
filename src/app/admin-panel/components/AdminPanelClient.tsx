'use client';
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import ConfirmModal from '@/components/ui/ConfirmModal';
import dynamic from 'next/dynamic';

const LeaveControlRoom = dynamic(() => import('./LeaveControlRoom'), { ssr: false });
const PerformanceScoresEditor = dynamic(() => import('./PerformanceScoresCrudEditor'), { ssr: false });
const AdminProfileReviewPanel = dynamic(() => import('./AdminProfileReviewPanel'), { ssr: false });
const ActivityAuditLogPanel = dynamic(() => import('./ActivityAuditLogPanel'), { ssr: false });
const ScoringFormulaCard = dynamic(() => import('./ScoringFormulaCard'), { ssr: false });
const ScoringRulesEditor = dynamic(() => import('./ScoringRulesEditor').then(m => m.ScoringRulesEditor), { ssr: false });
const EvaluationFormBuilder = dynamic(() => import('./EvaluationFormBuilder'), { ssr: false });
import { toast } from 'sonner';
import { useAppContext } from '@/context/AppContext';
import { PERFORMANCE_MONTHS } from '@/data/performanceScores';
import { formatToDisplayDate, formatToDbDate, isValidMalaysiaPhone, getTodayDbDate } from '@/lib/dateUtils';
import InlineEditableField from '@/components/ui/InlineEditableField';


// ─── Types ───────────────────────────────────────────────────────────────────
type AdminTab = 'users' | 'profile-updates' | 'departments' | 'scoring' | 'performance' | 'leave' | 'audit' | 'attributes';

interface YearEntry {
  year: number;
  archived: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'hod' | 'employee' | 'intern' | 'probation';
  phoneNumber?: string | null;
  dept: string;
  status: 'active' | 'inactive' | 'pending' | 'terminated';
  joinDate: string | null;
  updatedAt?: string | null;
  reportsToId?: string | null;
  rewards?: any[];
  achievements?: any[];
  experienceInOffice?: any[];
  address?: string | null;
  mailingAddress?: string | null;
}

interface Department {
  id: string;
  name: string;
  hodName: string; // The person's current name
  hodId?: string | null; // The link to users.id
  headcount: number;
  budget: string;
  status: 'active' | 'inactive';
}

interface ScoringCategory {
  id: string;
  name: string;
  weight: number;
  description: string;
  color: string;
  order: number;
}

interface KpiFormulaRule {
  id: string;
  metric: string;
  formula: string;
  source: string;
  frequency: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  weight: number;
  notes: string;
}

const defaultKpiFormulaRules: KpiFormulaRule[] = [
  {
    id: 'fr-001',
    metric: 'Attendance KPI',
    formula: '(Attendance Days / Working Days) * 100',
    source: 'Attendance Sheet',
    frequency: 'Monthly',
    weight: 25,
    notes: 'Exclude approved unpaid leave',
  },
  {
    id: 'fr-002',
    metric: 'Delivery KPI',
    formula: '(Completed Deliverables / Planned Deliverables) * 100',
    source: 'Department Tracker',
    frequency: 'Monthly',
    weight: 35,
    notes: 'Overdue item deducts 5 points each',
  },
  {
    id: 'fr-003',
    metric: 'Quality KPI',
    formula: '100 - ((Defects / Total Output) * 100)',
    source: 'QA Checklist',
    frequency: 'Quarterly',
    weight: 40,
    notes: 'Cap minimum score at 0',
  },
];

// ─── Mock Data ────────────────────────────────────────────────────────────────
const initialUsers: User[] = [];

const initialDepts: Department[] = [];

const initialCategories: ScoringCategory[] = [
  { id: 'sc-001', name: 'Performance', weight: 60, description: 'KPIs, Tasks, and Quality of work', color: 'rgb(249 115 22)', order: 1 },
  { id: 'sc-002', name: 'Participation', weight: 25, description: 'Attendance, Activities, and Learning', color: 'rgb(34 197 94)', order: 2 },
  { id: 'sc-003', name: 'Popularity', weight: 15, description: 'Votings and Gratitude stickers', color: 'rgb(168 85 247)', order: 3 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SaveIndicator({ status }: { status: 'saved' | 'draft' | 'saving' }) {
  return (
    <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
      style={{
        background: status === 'saved' ? 'rgba(52,211,153,0.1)' : status === 'saving' ? 'rgba(79,127,255,0.1)' : 'rgba(251,191,36,0.1)',
        color: status === 'saved' ? 'rgb(52 211 153)' : status === 'saving' ? 'rgb(79 127 255)' : 'rgb(251 191 36)',
        border: `1px solid ${status === 'saved' ? 'rgba(52,211,153,0.2)' : status === 'saving' ? 'rgba(79,127,255,0.2)' : 'rgba(251,191,36,0.2)'}`,
      }}>
      <div className={`w-1.5 h-1.5 rounded-full ${status === 'saving' ? 'animate-pulse' : ''}`}
        style={{ background: status === 'saved' ? 'rgb(52 211 153)' : status === 'saving' ? 'rgb(79 127 255)' : 'rgb(251 191 36)' }} />
      {status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving...' : 'Draft'}
    </div>
  );
}

export function ScoringFormulaDetailPanel() {
  const [formulaRules, setFormulaRules] = useState<KpiFormulaRule[]>(defaultKpiFormulaRules);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'draft' | 'saving'>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerAutoSave = () => {
    setSaveStatus('draft');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveStatus('saving');
      setTimeout(() => setSaveStatus('saved'), 600);
    }, 1200);
  };

  const addFormulaRule = () => {
    setFormulaRules(prev => [
      ...prev,
      {
        id: `fr-${Date.now()}`,
        metric: 'New KPI Metric',
        formula: '(value / target) * 100',
        source: 'Data Source',
        frequency: 'Monthly',
        weight: 10,
        notes: 'Add rule notes',
      },
    ]);
    triggerAutoSave();
    toast.success('Formula rule added');
  };

  const updateFormulaRule = (id: string, patch: Partial<KpiFormulaRule>) => {
    setFormulaRules(prev => prev.map(rule => (rule.id === id ? { ...rule, ...patch } : rule)));
    triggerAutoSave();
  };

  const removeFormulaRule = (id: string) => {
    setFormulaRules(prev => prev.filter(rule => rule.id !== id));
    triggerAutoSave();
    toast.success('Formula rule removed');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>KPI Formula Detail Board</h3>
          <SaveIndicator status={saveStatus} />
        </div>
        <button onClick={addFormulaRule} className="btn-primary text-xs flex items-center gap-1.5">
          <Icon name="PlusIcon" size={12} />
          Add Formula
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Detailed formula storage for Scoring Engine calculation rules.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 1050 }}>
            <thead>
              <tr style={{ background: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                {['KPI Metric', 'Formula', 'Source', 'Frequency', 'Weight %', 'Notes', 'Del'].map(col => (
                  <th key={col} className="px-3 py-2 text-left font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {formulaRules.map((rule, idx) => (
                <tr key={rule.id} style={{ borderBottom: '1px solid rgb(var(--border))', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td className="px-3 py-2">
                    <InlineEditableField
                      initialValue={rule.metric}
                      onSave={(val) => updateFormulaRule(rule.id, { metric: val })}
                      textClassName="text-xs"
                      className="w-full"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <InlineEditableField
                      initialValue={rule.formula}
                      onSave={(val) => updateFormulaRule(rule.id, { formula: val })}
                      textClassName="text-xs font-mono"
                      className="w-full"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <InlineEditableField
                      initialValue={rule.source}
                      onSave={(val) => updateFormulaRule(rule.id, { source: val })}
                      textClassName="text-xs"
                      className="w-full"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select className="input-base text-xs py-1" value={rule.frequency} onChange={e => updateFormulaRule(rule.id, { frequency: e.target.value as KpiFormulaRule['frequency'] })}>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half-Yearly">Half-Yearly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <InlineEditableField
                      type="number"
                      initialValue={String(rule.weight)}
                      onSave={(val) => updateFormulaRule(rule.id, { weight: Number(val) || 0 })}
                      textClassName="text-xs font-mono"
                      className="w-full justify-center"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <InlineEditableField
                      initialValue={rule.notes}
                      onSave={(val) => updateFormulaRule(rule.id, { notes: val })}
                      textClassName="text-xs text-slate-400"
                      className="w-full"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => removeFormulaRule(rule.id)} className="p-1 rounded hover:bg-red-400/10" style={{ color: 'rgb(248 113 113)' }}>
                      <Icon name="TrashIcon" size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Users CRUD ───────────────────────────────────────────────────────────────
function UsersPanel() {
  const { silentMode, setSilentMode, buildAuthHeaders } = useAppContext();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [depts, setDepts] = useState<Department[]>(initialDepts);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const addFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAdd) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (addFormRef.current && !addFormRef.current.contains(e.target as Node)) {
        if (e.target instanceof Element && e.target.closest('.btn-primary')) {
          return;
        }
        setShowAdd(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAdd]);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'draft' | 'saving'>('saved');
  const [newUser, setNewUser] = useState<Partial<User & { password?: string; sendNotification?: boolean }>>({
    role: 'employee',
    status: 'active',
    dept: 'Operations',
    phoneNumber: '',
    joinDate: getTodayDbDate(),
    password: '',
    address: '',
    mailingAddress: '',
    sendNotification: true
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoadingUsers(true);
      try {
        const [userRes, deptRes] = await Promise.all([
          fetch(`/api/users?t=${Date.now()}`),
          fetch(`/api/departments?t=${Date.now()}`)
        ]);

        const userPayload = await userRes.json();
        const deptPayload = await deptRes.json();

        if (!cancelled) {
          if (Array.isArray(userPayload?.users)) {
            setUsers(userPayload.users as User[]);
          }
          if (Array.isArray(deptPayload?.departments)) {
            setDepts(deptPayload.departments as Department[]);
          }
          setSaveStatus('saved');
        }
      } catch {
        if (!cancelled) {
          toast.error('Load data failed');
          setSaveStatus('draft');
        }
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const triggerAutoSave = () => {
    setSaveStatus('draft');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveStatus('saving');
      setTimeout(() => setSaveStatus('saved'), 600);
    }, 1500);
  };

  const handleAdd = () => {
    if (!newUser.name || !newUser.email) { toast.error('Name and email are required'); return; }
    if (newUser.phoneNumber && !isValidMalaysiaPhone(newUser.phoneNumber)) {
      toast.error('Invalid phone format. Use +60xx-xxxxxxx');
      return;
    }

    void (async () => {
      try {
        setSaveStatus('saving');
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...buildAuthHeaders()
          },
          body: JSON.stringify({
            name: newUser.name,
            email: newUser.email,
            phoneNumber: newUser.phoneNumber,
            password: newUser.password,
            role: newUser.role || 'employee',
            dept: newUser.dept || 'Operations',
            joinDate: newUser.joinDate,
            address: newUser.address,
            mailingAddress: newUser.mailingAddress,
            sendNotification: silentMode ? false : (newUser as any).sendNotification,
            employeeId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Create user failed');
        }
        const payload = await response.json();
        const created = payload?.user as User;
        setUsers(prev => [...prev, created]);
        setShowAdd(false);
        setNewUser({
          role: 'employee',
          status: 'pending',
          dept: 'Operations',
          phoneNumber: '',
          joinDate: getTodayDbDate(),
          password: '',
          address: '',
          mailingAddress: '',
          sendNotification: true
        });
        setSaveStatus('saved');
        toast.success('User added successfully');
      } catch (error) {
        setSaveStatus('draft');
        toast.error(error instanceof Error ? error.message : 'Create user failed');
      }
    })();
  };

  const handleEdit = (userId: string, patch: Partial<User>) => {
    void (async () => {
      try {
        // Find current user in the latest state to build full object for API
        // We can't easily get latest state here without refs or functional updates
        // but we can at least update the UI optimistically or after the call.
        setSaveStatus('saving');
        
        const currentUser = users.find(u => u.id === userId);
        if (!currentUser) return;
        const updatedUser = { ...currentUser, ...patch };

        const response = await fetch(`/api/users?id=${encodeURIComponent(userId)}&t=${Date.now()}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            ...buildAuthHeaders()
          },
          body: JSON.stringify(updatedUser),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Update user failed');
        }
        
        // Use functional update to ensure we don't overwrite other concurrent changes
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } : u));
        setEditUser(null);
        setSaveStatus('saved');

        // Check if manager changed to trigger notifications
        if (!silentMode && patch.reportsToId !== undefined && currentUser.reportsToId !== patch.reportsToId) {
          await fetch('/api/profile/assign-reports-to', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              ...buildAuthHeaders()
            },
            body: JSON.stringify({
              employeeId: userId,
              newReportsToId: patch.reportsToId
            }),
          });
          toast.success('Manager reassigned & notifications sent');
        } else {
          toast.success(silentMode ? 'User updated (Silent)' : 'User updated');
        }
      } catch (error) {
        setSaveStatus('draft');
        toast.error(error instanceof Error ? error.message : 'Update user failed');
      }
    })();
  };

  const handleDelete = (id: string) => {
    void (async () => {
      try {
        setSaveStatus('saving');
        const response = await fetch(`/api/users?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Delete user failed');
        }
        setUsers(prev => prev.filter(u => u.id !== id));
        setDeleteId(null);
        setSaveStatus('saved');
        toast.success('User removed');
      } catch (error) {
        setSaveStatus('draft');
        toast.error(error instanceof Error ? error.message : 'Delete user failed');
      }
    })();
  };

  const roleColor = (role: User['role']) => {
    if (role === 'admin') return { bg: 'rgba(167,139,250,0.2)', text: 'rgb(167 139 250)' };
    if (role === 'hod') return { bg: 'rgba(79,127,255,0.2)', text: 'rgb(79 127 255)' };
    if (role === 'intern') return { bg: 'rgba(232,121,249,0.2)', text: 'rgb(232 121 249)' }; 
    if (role === 'probation') return { bg: 'rgba(251,191,36,0.2)', text: 'rgb(251 191 36)' }; 
    return { bg: 'rgba(52,211,153,0.2)', text: 'rgb(52 211 153)' };
  };

  const statusColor = (s: User['status']) => {
    if (s === 'active') return { bg: 'rgba(52,211,153,0.15)', text: 'rgb(52 211 153)' };
    if (s === 'pending') return { bg: 'rgba(251,191,36,0.15)', text: 'rgb(251 191 36)' };
    return { bg: 'rgba(248,113,113,0.15)', text: 'rgb(248 113 113)' };
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [deptFilter, setDeptFilter] = useState('All Departments');
  const [roleFilter, setRoleFilter] = useState('All Roles');

  const uniqueDepts = useMemo(() => {
    const list = depts.map(d => d.name).sort();
    return ['All Departments', ...list];
  }, [depts]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const isInactive = u.status === 'inactive' || u.status === 'terminated';

      const matchesDept = deptFilter === 'All Departments' || u.dept === deptFilter;
      const matchesRole = roleFilter === 'All Roles' || u.role === roleFilter.toLowerCase();

      if (!showInactive && isInactive) return false;
      return matchesSearch && matchesDept && matchesRole;
    });
  }, [users, searchTerm, showInactive, deptFilter, roleFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>User Management</h3>
          <div className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            {users.filter(u => u.role !== 'admin').length} Employees
          </div>
          <SaveIndicator status={saveStatus} />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input-base pl-9 text-xs py-1.5"
              placeholder="Search by name or email..."
              style={{ width: 200 }}
            />
          </div>

          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="input-base text-xs py-1.5 px-3 rounded-lg border"
            style={{ width: 160, background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border))' }}
          >
            {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="input-base text-xs py-1.5 px-3 rounded-lg border"
            style={{ width: 120, background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border))' }}
          >
            {['All Roles', 'Admin', 'HOD', 'Employee', 'Intern', 'Probation'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer hover:bg-white/5 transition-colors" style={{ borderColor: 'rgb(var(--border))' }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-xs font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>Include Inactive</span>
          </label>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <Icon name="PlusIcon" size={14} />
            Add User
          </button>
        </div>
      </div>

      {/* Add User Form */}
      {showAdd && (
        <div ref={addFormRef} className="rounded-xl p-4 animate-fade-in" style={{ background: 'rgba(79,127,255,0.05)', border: '1px solid rgba(79,127,255,0.2)' }}>
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'rgb(79 127 255)' }}>New User</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-secondary))' }}>Full Name *</label>
              <input value={newUser.name || ''} onChange={e => { setNewUser(p => ({ ...p, name: e.target.value })); triggerAutoSave(); }}
                className="input-base" placeholder="Full name" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-secondary))' }}>Email *</label>
              <input value={newUser.email || ''} onChange={e => { setNewUser(p => ({ ...p, email: e.target.value })); triggerAutoSave(); }}
                className="input-base" placeholder="email@ezeetechnosys.com.my" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-secondary))' }}>Role</label>
              <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value as any }))} className="input-base">
                <option value="employee">Employee</option>
                <option value="hod">HOD / Manager</option>
                <option value="intern">Intern</option>
                <option value="probation">Probation</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-secondary))' }}>Department</label>
              <div className="space-y-2">
                <select 
                  value={newUser.dept || (depts.length > 0 ? depts[0].name : '')} 
                  onChange={e => {
                    const deptName = e.target.value;
                    const d = depts.find(x => x.name === deptName);
                    setNewUser(p => ({ 
                      ...p, 
                      dept: deptName, 
                      reportsToId: d?.hodId || null
                    }));
                  }} 
                  className="input-base"
                >
                  {depts.length === 0 && <option value="">No Departments Defined</option>}
                  {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div className="mt-1 text-[10px] flex items-center gap-1" style={{ color: 'rgb(var(--text-muted))' }}>
                <Icon name="UserCircleIcon" size={10} />
                HOD Detected: <span className="font-semibold text-blue-400">{depts.find(d => d.name === newUser.dept)?.hodName || 'None'}</span>
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-secondary))' }}>Phone Number</label>
              <input value={newUser.phoneNumber || ''} onChange={e => setNewUser(p => ({ ...p, phoneNumber: e.target.value }))}
                className="input-base" placeholder="+6012-3456789" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-secondary))' }}>Joined Date</label>
              <input 
                type="date" 
                value={newUser.joinDate || ''} 
                onChange={e => setNewUser(p => ({ ...p, joinDate: e.target.value }))}
                onClick={e => { try { (e.target as any).showPicker(); } catch(err) {} }}
                className="input-base cursor-pointer" 
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-secondary))' }}>Temp Password</label>
              <input type="text" value={newUser.password || ''} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} className="input-base" placeholder="Min 8 characters" />
            </div>
            <div className="col-span-2 flex items-center gap-2 mt-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={(newUser as any).sendNotification} 
                  onChange={e => setNewUser(p => ({ ...p, sendNotification: e.target.checked }))}
                  className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-500 focus:ring-blue-500" 
                />
                <span className="text-xs font-medium group-hover:text-blue-400 transition-colors" style={{ color: 'rgb(var(--text-primary))' }}>
                  Send automated welcome notification to employee email
                </span>
              </label>
            </div>
            <div className="col-span-2">
              <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-secondary))' }}>Home Address</label>
              <textarea
                value={newUser.address || ''}
                onChange={e => setNewUser(p => ({ ...p, address: e.target.value }))}
                className="input-base resize-none"
                placeholder="Full residential address"
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-secondary))' }}>Mailing Address</label>
              <textarea
                value={newUser.mailingAddress || ''}
                onChange={e => setNewUser(p => ({ ...p, mailingAddress: e.target.value }))}
                className="input-base resize-none"
                placeholder="Full correspondence address"
                rows={2}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleAdd} className="btn-primary text-sm">Add User</button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        {loadingUsers && (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            <p className="text-sm font-medium animate-pulse" style={{ color: 'rgb(var(--text-muted))' }}>
              Loading users from SQL Server...
            </p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr style={{ borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                {['Name', 'Email', 'Role', 'Reports To', 'Department', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="px-2 py-2 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
            {filteredUsers.map((user, idx) => {
              const rc = roleColor(user.role);
              const sc = statusColor(user.status);
              const isEditing = editUser?.id === user.id;
              const isInactive = user.status === 'inactive' || user.status === 'terminated';
              return (
                <tr
                  key={user.id}
                  className="border-b hover:bg-white/[0.02] group transition-colors"
                  style={{
                    borderColor: 'rgb(var(--border))',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    opacity: isInactive ? 0.7 : 1
                  }}>
                  <td className="px-2 py-2">
                    <Link
                      href={`/admin-panel/users/${btoa(user.id).replace(/=/g, '')}`}
                      className={`text-left font-bold hover:text-blue-400 hover:underline transition-colors block ${isInactive ? 'text-slate-400' : 'text-blue-500 dark:text-blue-400'}`}
                    >
                      {user.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                      {user.email}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <select 
                      value={user.role} 
                      onChange={e => handleEdit(user.id, { role: e.target.value as any })}
                      onClick={e => e.stopPropagation()}
                      className="input-base text-xs py-1" 
                      style={{ backgroundColor: 'rgb(var(--bg-elevated))', color: rc.text, border: '1px solid rgb(var(--border-subtle))', width: 'auto' }}
                    >
                      <option value="employee">Employee</option>
                      <option value="hod">HOD</option>
                      <option value="intern">Intern</option>
                      <option value="probation">Probation</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={user.reportsToId || ''}
                      onChange={e => handleEdit(user.id, { reportsToId: e.target.value || null })}
                      onClick={e => e.stopPropagation()}
                      className="input-base text-xs py-1"
                      style={{ width: 'auto', backgroundColor: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border-subtle))' }}
                    >
                      <option value="">None</option>
                      {users.filter(u => u.id !== user.id).map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select 
                      value={user.dept} 
                      onChange={e => {
                        const deptName = e.target.value;
                        const d = depts.find(x => x.name === deptName);
                        handleEdit(user.id, { 
                          dept: deptName, 
                          reportsToId: d?.hodId || null
                        });
                      }}
                      onClick={e => e.stopPropagation()}
                      className="input-base text-xs py-1" 
                      style={{ width: 'auto', backgroundColor: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border-subtle))' }}
                    >
                      {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      {!depts.some(d => d.name === user.dept) && <option value={user.dept}>{user.dept}</option>}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select 
                      value={user.status} 
                      onChange={e => handleEdit(user.id, { status: e.target.value as User['status'] })}
                      onClick={e => e.stopPropagation()}
                      className="input-base text-xs py-1" 
                      style={{ backgroundColor: 'rgb(var(--bg-elevated))', color: sc.text, border: '1px solid rgb(var(--border-subtle))', width: 'auto' }}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="pending">Pending</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input 
                      type="date"
                      value={user.joinDate || ''} 
                      onChange={e => handleEdit(user.id, { joinDate: e.target.value })}
                      onClick={e => { 
                        e.stopPropagation(); 
                        try { (e.target as any).showPicker(); } catch(err) {} 
                      }}
                      className="input-base text-xs py-1 cursor-pointer" 
                      style={{ width: '130px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgb(var(--border-subtle))' }} 
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteId(user.id); }} className="p-1.5 rounded hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100" style={{ color: 'rgb(248 113 113)' }}>
                      <Icon name="TrashIcon" size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <ConfirmModal
        open={deleteId !== null}
        title="Remove User"
        message="This will permanently remove this user account and all associated data. This action cannot be undone."
        confirmLabel="Remove User"
        variant="danger"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

// ─── Departments CRUD ─────────────────────────────────────────────────────────
function DepartmentsPanel() {
  const { silentMode, buildAuthHeaders } = useAppContext();
  const [depts, setDepts] = useState<Department[]>(initialDepts);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const addDeptFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAdd) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (addDeptFormRef.current && !addDeptFormRef.current.contains(e.target as Node)) {
        if (e.target instanceof Element && e.target.closest('.btn-primary')) {
          return;
        }
        setShowAdd(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAdd]);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'draft' | 'saving'>('saved');
  const [newDept, setNewDept] = useState<Partial<Department>>({ status: 'active', hodName: 'Pending Assignment' });
  const [viewingEmployees, setViewingEmployees] = useState<Department | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberToAdd, setMemberToAdd] = useState('');
  const [unassigningMember, setUnassigningMember] = useState<User | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoadingDepartments(true);
      try {
        const [deptRes, userRes] = await Promise.all([
          fetch('/api/departments'),
          fetch('/api/users')
        ]);

        const deptPayload = await deptRes.json();
        const userPayload = await userRes.json();

        if (!cancelled) {
          if (Array.isArray(deptPayload?.departments)) {
            setDepts(deptPayload.departments as Department[]);
          }
          if (Array.isArray(userPayload?.users)) {
            setUsers(userPayload.users as User[]);
          }
        }
      } catch {
        if (!cancelled) {
          toast.error('Load data failed');
        }
      } finally {
        if (!cancelled) setLoadingDepartments(false);
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const triggerAutoSave = () => {
    setSaveStatus('draft');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveStatus('saving');
      setTimeout(() => setSaveStatus('saved'), 600);
    }, 1500);
  };

  const handleAdd = () => {
    if (!newDept.name) { toast.error('Department name is required'); return; }
    void (async () => {
      try {
        setSaveStatus('saving');
        const response = await fetch('/api/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newDept.name,
            hodName: newDept.hodName || 'Pending Assignment',
            hodId: newDept.hodId,
            budget: newDept.budget || 'TBD',
            status: 'active',
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Create department failed');
        }
        const payload = await response.json();
        const created = payload?.department as Department;
        setDepts(prev => [...prev, created]);
        setShowAdd(false);
        setNewDept({ status: 'active' });
        setSaveStatus('saved');
        toast.success('Department created');
      } catch (error) {
        setSaveStatus('draft');
        toast.error(error instanceof Error ? error.message : 'Create department failed');
      }
    })();
  };

  const handleDelete = (id: string) => {
    void (async () => {
      try {
        setSaveStatus('saving');
        const response = await fetch(`/api/departments?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Delete department failed');
        }
        setDepts(prev => prev.filter(d => d.id !== id));
        setDeleteId(null);
        setSaveStatus('saved');
        toast.success('Department removed');
      } catch (error) {
        setSaveStatus('draft');
        toast.error(error instanceof Error ? error.message : 'Delete department failed');
      }
    })();
  };

  const handleUpdateUserDept = async (userId: string, newDeptName: string) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      const updatedUser = { ...user, dept: newDeptName };
      const response = await fetch(`/api/users?id=${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...buildAuthHeaders()
        },
        body: JSON.stringify(updatedUser),
      });

      if (!response.ok) throw new Error('Update user failed');

      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      toast.success(newDeptName === 'Unassigned' ? 'Member removed' : 'Member added');
    } catch (error) {
      toast.error('Failed to update member');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Department Management</h3>
          <SaveIndicator status={saveStatus} />
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Icon name="PlusIcon" size={14} />
          Add Department
        </button>
      </div>

      {showAdd && (
        <div ref={addDeptFormRef} className="rounded-xl p-4 animate-fade-in" style={{ background: 'rgba(79,127,255,0.05)', border: '1px solid rgba(79,127,255,0.2)' }}>
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'rgb(79 127 255)' }}>New Department</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-secondary))' }}>Department Name *</label>
              <input value={newDept.name || ''} onChange={e => { setNewDept(p => ({ ...p, name: e.target.value })); triggerAutoSave(); }}
                className="input-base" placeholder="e.g. Marketing" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-secondary))' }}>HOD</label>
              <select
                value={newDept.hodId || ''}
                onChange={e => {
                  const u = users.find(x => x.id === e.target.value);
                  setNewDept(p => ({ ...p, hodId: e.target.value, hodName: u?.name || 'Pending Assignment' }));
                }}
                className="input-base"
              >
                <option value="">Pending Assignment</option>
                {users.filter(u => u.role === 'hod' || u.role === 'admin').map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.dept})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleAdd} className="btn-primary text-sm">Create Department</button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loadingDepartments && (
          <div className="md:col-span-2 rounded-xl px-4 py-3 text-xs" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))', color: 'rgb(var(--text-muted))' }}>
            Loading departments from SQL Server...
          </div>
        )}
        {depts.map(dept => {
          const deptUsers = users.filter(u => u.dept?.trim().toLowerCase() === dept.name.trim().toLowerCase());
          const staffCount = deptUsers.length;

          return (
            <div
              key={dept.id}
              className="rounded-xl p-4 group cursor-pointer hover:ring-1 hover:ring-blue-500/50 transition-all shadow-sm"
              style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}
              onClick={() => setViewingEmployees(dept)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <InlineEditableField
                    initialValue={dept.name}
                    onSave={async (val) => {
                      const response = await fetch(`/api/departments?id=${encodeURIComponent(dept.id)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...dept, name: val }),
                      });
                      if (!response.ok) throw new Error('Update failed');
                      setDepts(prev => prev.map(d => d.id === dept.id ? { ...d, name: val } : d));
                    }}
                    textClassName="text-sm font-bold text-white"
                  />
                  <div className="mt-2">
                    <select
                      value={dept.hodId || ''}
                      onChange={async (e) => {
                        const u = users.find(x => x.id === e.target.value);
                        const updated = { ...dept, hodId: e.target.value, hodName: u?.name || 'Pending Assignment' };
                        const response = await fetch(`/api/departments?id=${encodeURIComponent(dept.id)}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(updated),
                        });
                        if (response.ok) {
                          setDepts(prev => prev.map(d => d.id === dept.id ? updated : d));
                          toast.success('HOD updated');
                        }
                      }}
                      onClick={e => e.stopPropagation()}
                      className="input-base text-[10px] py-1 bg-blue-500/10 border-blue-500/20 text-blue-400 font-bold uppercase tracking-wider"
                      style={{ width: 'auto' }}
                    >
                      <option value="">Unassigned</option>
                      {users.filter(u => u.role === 'hod' || u.role === 'admin').map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setDeleteId(dept.id); }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Icon name="TrashIcon" size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Headcount</p>
                  <p className="text-sm font-mono text-slate-300">
                    {users.filter(u => u.dept?.trim().toLowerCase() === dept.name.trim().toLowerCase()).length} 
                    <span className="text-[10px] text-slate-500 font-sans ml-1">Active</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Budget</p>
                  <InlineEditableField
                    initialValue={dept.budget}
                    onSave={async (val) => {
                      const response = await fetch(`/api/departments?id=${encodeURIComponent(dept.id)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...dept, budget: val }),
                      });
                      if (!response.ok) throw new Error('Update failed');
                      setDepts(prev => prev.map(d => d.id === dept.id ? { ...d, budget: val } : d));
                    }}
                    textClassName="text-sm font-mono text-slate-300"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[10px] text-white/20 uppercase tracking-widest font-medium px-1">
        <Icon name="InformationCircleIcon" size={10} />
        Click a department card to manage team members
      </div>

      <ConfirmModal
        open={deleteId !== null}
        title="Remove Department"
        message="This will permanently remove this department. All associated users will need to be reassigned. This action cannot be undone."
        confirmLabel="Remove Department"
        variant="danger"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      {/* Viewing Employees Modal */}
      {viewingEmployees && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-start justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-[#0A0A0A] border border-white/10 w-full max-w-xl my-auto flex flex-col rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-300">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h3 className="text-lg font-semibold text-white">{viewingEmployees.name} Team</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-white/40">Manage employees assigned to this department</p>
                  <span className="w-1 h-1 rounded-full bg-white/20"></span>
                  <p className="text-xs text-blue-400 font-medium">{users.filter(u => u.dept === viewingEmployees.name).length} members</p>
                </div>
              </div>
              <button
                onClick={() => setViewingEmployees(null)}
                className="p-2 rounded-full hover:bg-white/5 transition-colors text-white/40 hover:text-white"
              >
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>

            <div className="px-6 py-3 border-b border-white/5 bg-white/[0.01]">
              {!isAddingMember ? (
                <button
                  onClick={() => setIsAddingMember(true)}
                  className="w-full py-2 px-4 rounded-xl border border-dashed border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 text-xs text-white/40 hover:text-blue-400 transition-all flex items-center justify-center gap-2 group"
                >
                  <Icon name="PlusIcon" size={14} className="group-hover:scale-110 transition-transform" />
                  Add New Member
                </button>
              ) : (
                <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
                  <select
                    value={memberToAdd}
                    onChange={e => setMemberToAdd(e.target.value)}
                    className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  >
                    <option value="">Select an employee...</option>
                    {users
                      .filter(u => u.dept !== viewingEmployees.name)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.dept || 'No Dept'})</option>
                      ))
                    }
                  </select>
                  <button
                    onClick={() => {
                      if (memberToAdd) {
                        handleUpdateUserDept(memberToAdd, viewingEmployees.name);
                        setMemberToAdd('');
                        setIsAddingMember(false);
                      }
                    }}
                    disabled={!memberToAdd}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setIsAddingMember(false); setMemberToAdd(''); }}
                    className="p-2 text-white/40 hover:text-white"
                  >
                    <Icon name="XMarkIcon" size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {users.filter(u => u.dept === viewingEmployees.name).length > 0 ? (
                <div className="space-y-2">
                  {users.filter(u => u.dept === viewingEmployees.name).map(emp => (
                    <div key={emp.id} className="flex items-center justify-between p-3 rounded-xl transition-colors group" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border-subtle))' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{emp.name}</p>
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'rgb(var(--text-muted))' }}>{emp.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{emp.email}</p>
                          <p className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>{emp.id}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUnassigningMember(emp);
                          }}
                          className="p-2 rounded-lg hover:bg-red-500/10 transition-all sm:opacity-0 group-hover:opacity-100"
                          style={{ color: 'rgb(var(--text-muted))' }}
                          title="Remove from department"
                        >
                          <Icon name="TrashIcon" size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                    <Icon name="UsersIcon" size={24} className="text-white/10" />
                  </div>
                  <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>No employees assigned yet</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-white/[0.01] border-t border-white/5 flex justify-end">
              <button
                onClick={() => setViewingEmployees(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'rgb(var(--bg-elevated))', color: 'rgb(var(--text-secondary))', border: '1px solid rgb(var(--border-subtle))' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unassign Confirmation */}
      <ConfirmModal
        open={unassigningMember !== null}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${unassigningMember?.name} from the ${viewingEmployees?.name} department?`}
        confirmLabel="Remove Member"
        variant="danger"
        onConfirm={() => {
          if (unassigningMember && viewingEmployees) {
            handleUpdateUserDept(unassigningMember.id, 'Unassigned');
            setUnassigningMember(null);
          }
        }}
        onCancel={() => setUnassigningMember(null)}
      />
    </div>
  );
}

// ─── Scoring Categories (Drag & Drop) ────────────────────────────────────────
function YearRegistryPanel({
  selectedYear,
  setSelectedYear,
  years,
  setYears,
}: {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  years: YearEntry[];
  setYears: React.Dispatch<React.SetStateAction<YearEntry[]>>;
}) {
  const [newYear, setNewYear] = useState('');
  const [editYear, setEditYear] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const addYear = () => {
    const y = Number(newYear);
    if (!Number.isInteger(y) || y < 2020 || y > 2100) {
      toast.error('Enter a valid year');
      return;
    }
    if (years.some(item => item.year === y)) {
      toast.error('Year already exists');
      return;
    }
    setYears(prev => [...prev, { year: y, archived: false }].sort((a, b) => b.year - a.year));
    setNewYear('');
    toast.success(`Year ${y} created`);
  };

  const updateYear = (oldYear: number) => {
    const nextYear = Number(editValue);
    if (!Number.isInteger(nextYear) || nextYear < 2020 || nextYear > 2100) {
      toast.error('Enter a valid year');
      return;
    }
    if (nextYear !== oldYear && years.some(item => item.year === nextYear)) {
      toast.error('Year already exists');
      return;
    }
    setYears(prev => prev.map(item => (item.year === oldYear ? { ...item, year: nextYear } : item)).sort((a, b) => b.year - a.year));
    if (selectedYear === oldYear) setSelectedYear(nextYear);
    setEditYear(null);
    setEditValue('');
    toast.success('Year updated');
  };

  const deleteYear = (year: number) => {
    if (years.length <= 1) {
      toast.error('At least one year is required');
      return;
    }
    const next = years.filter(item => item.year !== year);
    setYears(next);
    if (selectedYear === year) {
      const fallback = next.find(item => !item.archived)?.year ?? next[0].year;
      setSelectedYear(fallback);
    }
    toast.success(`Year ${year} removed`);
  };

  const toggleArchive = (year: number) => {
    setYears(prev => prev.map(item => (item.year === year ? { ...item, archived: !item.archived } : item)));
    const target = years.find(item => item.year === year);
    if (target?.year === selectedYear && !target.archived) {
      const fallback = years.find(item => item.year !== year && !item.archived)?.year;
      if (fallback) setSelectedYear(fallback);
    }
    toast.success('Archive status updated');
  };

  return (
    <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Year Registry (CRUD + Archive)</p>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Only Scoring Engine and Performance Scores use year selection.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newYear}
            onChange={e => setNewYear(e.target.value)}
            className="input-base text-xs"
            style={{ width: 110 }}
            placeholder="Add year"
          />
          <button onClick={addYear} className="btn-primary text-xs">Add Year</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {years.map(item => (
          <button
            key={`year-chip-${item.year}`}
            onClick={() => !item.archived && setSelectedYear(item.year)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: selectedYear === item.year ? 'rgba(79,127,255,0.2)' : 'rgba(255,255,255,0.04)',
              color: item.archived ? 'rgb(130 130 150)' : selectedYear === item.year ? 'rgb(79 127 255)' : 'rgb(var(--text-secondary))',
              border: item.archived ? '1px dashed rgba(248,113,113,0.35)' : '1px solid transparent',
              opacity: item.archived ? 0.75 : 1,
            }}
          >
            {item.year} {item.archived ? '(Archive)' : ''}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {years.map(item => (
          <div key={`year-row-${item.year}`} className="rounded-lg p-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgb(var(--border))' }}>
            <div className="flex items-center gap-3">
              {editYear === item.year ? (
                <input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="input-base text-xs"
                  style={{ width: 110 }}
                />
              ) : (
                <span className="text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{item.year}</span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: item.archived ? 'rgba(248,113,113,0.15)' : 'rgba(52,211,153,0.15)', color: item.archived ? 'rgb(248 113 113)' : 'rgb(52 211 153)' }}>
                {item.archived ? 'Archived' : 'Active'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {editYear === item.year ? (
                <>
                  <button className="p-1.5 rounded hover:bg-emerald-400/10" style={{ color: 'rgb(52 211 153)' }} onClick={() => updateYear(item.year)}>
                    <Icon name="CheckIcon" size={13} />
                  </button>
                  <button className="p-1.5 rounded hover:bg-white/10" style={{ color: 'rgb(var(--text-secondary))' }} onClick={() => { setEditYear(null); setEditValue(''); }}>
                    <Icon name="XMarkIcon" size={13} />
                  </button>
                </>
              ) : (
                <button className="p-1.5 rounded hover:bg-white/10" style={{ color: 'rgb(var(--text-secondary))' }} onClick={() => { setEditYear(item.year); setEditValue(String(item.year)); }}>
                  <Icon name="PencilSquareIcon" size={13} />
                </button>
              )}
              <button className="p-1.5 rounded hover:bg-amber-400/10" style={{ color: 'rgb(251 191 36)' }} onClick={() => toggleArchive(item.year)}>
                <Icon name={item.archived ? 'LockOpenIcon' : 'ArchiveBoxIcon'} size={13} />
              </button>
              <button className="p-1.5 rounded hover:bg-red-400/10" style={{ color: 'rgb(248 113 113)' }} onClick={() => deleteYear(item.year)}>
                <Icon name="TrashIcon" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoringPanel({
  selectedYear,
  setSelectedYear,
  years,
  setYears,
}: {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  years: YearEntry[];
  setYears: React.Dispatch<React.SetStateAction<YearEntry[]>>;
}) {
  const [categories, setCategories] = useState<ScoringCategory[]>(initialCategories);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const addCatFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAdd) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (addCatFormRef.current && !addCatFormRef.current.contains(e.target as Node)) {
        if (e.target instanceof Element && e.target.closest('.btn-primary')) {
          return;
        }
        setShowAdd(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAdd]);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'draft' | 'saving'>('saved');
  const [newCat, setNewCat] = useState<Partial<ScoringCategory>>({ color: 'rgb(79 127 255)', weight: 10 });
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoriesRef = useRef<ScoringCategory[]>(categories);
  const [showRules, setShowRules] = useState(false);
  const { userId, userRole, userName } = useAppContext();
  const authHeaders = { 'x-user-id': userId || '', 'x-user-role': userRole || '' };

  const totalWeight = categories.reduce((s, c) => s + c.weight, 0);

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  const persistCategories = async (items: ScoringCategory[]) => {
    const response = await fetch('/api/scoring-categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: selectedYear,
        categories: items,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Save scoring categories failed');
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const response = await fetch(`/api/scoring-categories?year=${selectedYear}`);
        if (!response.ok) throw new Error('Failed to load scoring categories');
        const payload = await response.json();
        if (!cancelled && Array.isArray(payload?.categories)) {
          setCategories(payload.categories as ScoringCategory[]);
        }
      } catch {
        if (!cancelled) {
          toast.error('Load scoring categories failed, using local defaults');
        }
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    };

    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  const triggerAutoSave = () => {
    setSaveStatus('draft');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        try {
          setSaveStatus('saving');
          await persistCategories(categoriesRef.current);
          setSaveStatus('saved');
        } catch {
          setSaveStatus('draft');
          toast.error('Auto-save failed for scoring categories');
        }
      })();
    }, 1500);
  };

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id); };
  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const items = [...categories];
    const fromIdx = items.findIndex(c => c.id === dragId);
    const toIdx = items.findIndex(c => c.id === targetId);
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    setCategories(items.map((c, i) => ({ ...c, order: i + 1 })));
    setDragId(null);
    setDragOverId(null);
    triggerAutoSave();
    toast.success('Order updated');
  };

  const handleAdd = () => {
    if (!newCat.name) { toast.error('Category name is required'); return; }
    const cat: ScoringCategory = {
      id: `sc-${Date.now()}`,
      name: newCat.name!,
      weight: newCat.weight || 10,
      description: newCat.description || '',
      color: newCat.color || 'rgb(79 127 255)',
      order: categories.length + 1,
    };
    const next = [...categories, cat];
    void (async () => {
      try {
        setSaveStatus('saving');
        await persistCategories(next);
        setCategories(next);
        setShowAdd(false);
        setNewCat({ color: 'rgb(79 127 255)', weight: 10 });
        setSaveStatus('saved');
        toast.success('Category added');
      } catch (error) {
        setSaveStatus('draft');
        toast.error(error instanceof Error ? error.message : 'Add category failed');
      }
    })();
  };

  const handleDelete = (id: string) => {
    const next = categories.filter(c => c.id !== id).map((item, index) => ({ ...item, order: index + 1 }));
    void (async () => {
      try {
        setSaveStatus('saving');
        await persistCategories(next);
        setCategories(next);
        setDeleteId(null);
        setSaveStatus('saved');
        toast.success('Category removed');
      } catch (error) {
        setSaveStatus('draft');
        toast.error(error instanceof Error ? error.message : 'Delete category failed');
      }
    })();
  };

  const colorOptions = [
    'rgb(79 127 255)', 'rgb(52 211 153)', 'rgb(167 139 250)',
    'rgb(251 191 36)', 'rgb(248 113 113)', 'rgb(34 211 238)',
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Performance Scoring Categories</h3>
          <SaveIndicator status={saveStatus} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: totalWeight === 100 ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: totalWeight === 100 ? 'rgb(52 211 153)' : 'rgb(248 113 113)' }}>
            Total: {totalWeight}% {totalWeight !== 100 ? '⚠️ Must equal 100%' : '✓'}
          </span>
          <button
            onClick={() => setShowRules(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-white/5 transition-all flex items-center gap-2"
          >
            <Icon name="Cog6ToothIcon" size={14} />
            Manage Activity Rules
          </button>
          <button
            onClick={() => {
              if (confirm('Reset all categories to the 3P Performance Framework? This will overwrite current database records.')) {
                void (async () => {
                  try {
                    setSaveStatus('saving');
                    await persistCategories(initialCategories);
                    setCategories(initialCategories);
                    setSaveStatus('saved');
                    toast.success('Reset to 3P Framework complete');
                  } catch (e) {
                    setSaveStatus('draft');
                    toast.error('Reset failed');
                  }
                })();
              }
            }}
            className="btn-ghost text-xs border border-white/10"
          >
            Reset to 3P Framework
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <Icon name="PlusIcon" size={14} />
            Add Category
          </button>
        </div>
      </div>

      <p className="text-xs flex items-center gap-2" style={{ color: 'rgb(var(--text-muted))' }}>
        <Icon name="ArrowsUpDownIcon" size={12} />
        Drag rows to reorder scoring categories
      </p>

      {loadingCategories && (
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}

      {showAdd && (
        <div ref={addCatFormRef} className="rounded-xl p-4 animate-fade-in" style={{ background: 'rgba(79,127,255,0.05)', border: '1px solid rgba(79,127,255,0.2)' }}>
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'rgb(79 127 255)' }}>New Category</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-secondary))' }}>Name *</label>
              <input value={newCat.name || ''} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                className="input-base" placeholder="Category name" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-secondary))' }}>Weight (%)</label>
              <input type="number" min={1} max={100} value={newCat.weight || 10}
                onChange={e => setNewCat(p => ({ ...p, weight: Number(e.target.value) }))}
                className="input-base" />
            </div>
            <div className="col-span-2">
              <label className="text-xs mb-1 block" style={{ color: 'rgb(var(--text-secondary))' }}>Description</label>
              <input value={newCat.description || ''} onChange={e => setNewCat(p => ({ ...p, description: e.target.value }))}
                className="input-base" placeholder="Brief description" />
            </div>
            <div>
              <label className="text-xs mb-2 block" style={{ color: 'rgb(var(--text-secondary))' }}>Color</label>
              <div className="flex gap-2">
                {colorOptions.map(c => (
                  <button key={c} onClick={() => setNewCat(p => ({ ...p, color: c }))}
                    className="w-6 h-6 rounded-full transition-all"
                    style={{ background: c, outline: newCat.color === c ? `2px solid white` : 'none', outlineOffset: 2 }} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleAdd} className="btn-primary text-sm">Add Category</button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost text-sm">Cancel</button>
          </div>
        </div>
      )}

      {showRules && (
        <div className="rounded-xl p-6 shadow-2xl border bg-white dark:bg-slate-900/40 border-slate-200 dark:border-white/5 backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <ScoringRulesEditor 
            onClose={() => setShowRules(false)}
            authHeaders={authHeaders}
            userName={userName}
          />
        </div>
      )}

      <div className="space-y-2">
        {categories.sort((a, b) => a.order - b.order).map(cat => (
          <div
            key={cat.id}
            draggable
            onDragStart={() => handleDragStart(cat.id)}
            onDragOver={e => handleDragOver(e, cat.id)}
            onDrop={() => handleDrop(cat.id)}
            onDragEnd={() => { setDragId(null); setDragOverId(null); }}
            className="rounded-xl p-4 flex items-center gap-4 transition-all"
            style={{
              background: dragOverId === cat.id ? 'rgba(79,127,255,0.08)' : 'rgb(var(--bg-card))',
              border: dragOverId === cat.id ? '1px solid rgba(79,127,255,0.4)' : '1px solid rgb(var(--border-subtle))',
              opacity: dragId === cat.id ? 0.5 : 1,
              cursor: 'grab',
            }}
          >
            <Icon name="Bars3Icon" size={16} style={{ color: 'rgb(var(--text-muted))' }} className="flex-shrink-0" />
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cat.color }} />
            <div className="flex-1 min-w-0">
              {editId === cat.id ? (
                <div className="flex items-center gap-2">
                  <input defaultValue={cat.name}
                    onBlur={e => { setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: e.target.value } : c)); setEditId(null); triggerAutoSave(); }}
                    className="input-base text-sm flex-1" style={{ padding: '4px 8px' }} autoFocus />
                </div>
              ) : (
                <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{cat.name}</p>
              )}
              <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>{cat.description}</p>
            </div>
            <div className="flex items-center gap-3">
              {editId === cat.id ? (
                <input type="number" min={1} max={100} defaultValue={cat.weight}
                  onBlur={e => { setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, weight: Number(e.target.value) } : c)); triggerAutoSave(); }}
                  className="input-base text-sm w-20 text-center" style={{ padding: '4px 8px' }} />
              ) : (
                <span className="text-sm font-bold font-mono" style={{ color: cat.color }}>{cat.weight}%</span>
              )}
              <button onClick={() => setEditId(editId === cat.id ? null : cat.id)}
                className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: 'rgb(var(--text-secondary))' }}>
                <Icon name="PencilSquareIcon" size={14} />
              </button>
              <button onClick={() => setDeleteId(cat.id)}
                className="p-1.5 rounded hover:bg-red-400/10 transition-colors" style={{ color: 'rgb(248 113 113)' }}>
                <Icon name="TrashIcon" size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={deleteId !== null}
        title="Remove Scoring Category"
        message="This will remove this scoring category. Existing performance scores using this category will be affected."
        confirmLabel="Remove Category"
        variant="danger"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

    </div>
  );
}

// ─── Excel-like Performance Score Table ──────────────────────────────────────
function PerformancePanel({ selectedYear }: { selectedYear: number }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const preSelectedUserId = searchParams?.get('userId');

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.users)) setUsers(data.users);
      })
      .finally(() => setLoading(false));
  }, []);

  const employeeOptions = [
    { id: 'masterboard', name: '📊 MASTERBOARD SUMMARY' },
    ...users
      .filter(u => u.role !== 'admin')
      .map(u => ({
        id: u.id,
        name: u.name ? decodeURIComponent(u.name) : 'Unknown'
      }))
  ];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PerformanceScoresEditor 
        selectedYear={selectedYear} 
        employeeOptions={employeeOptions} 
        preSelectedUserId={preSelectedUserId || undefined}
      />
    </div>
  );
}

function KpiCalculatorPanel({
  selectedYear,
}: {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  years: YearEntry[];
  setYears: React.Dispatch<React.SetStateAction<YearEntry[]>>;
}) {
  const months = [...PERFORMANCE_MONTHS];
  const [saveStatus, setSaveStatus] = useState<'saved' | 'draft' | 'saving'>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const employeeOptions = initialUsers.filter(u => u.role !== 'admin').map(u => ({ id: u.id, name: u.name }));
  const [employeeId, setEmployeeId] = useState(employeeOptions[0]?.id || 'u-001');

  const kpiRows = [
    { id: 'delivery', label: 'Delivery KPI', weight: 40, target: 100 },
    { id: 'quality', label: 'Quality KPI', weight: 35, target: 100 },
    { id: 'attendance', label: 'Attendance KPI', weight: 25, target: 100 },
  ];

  const [actualCells, setActualCells] = useState<Record<string, Record<string, number>>>(() =>
    employeeOptions.reduce((acc, item) => {
      const rowMap: Record<string, number> = {};
      kpiRows.forEach(row => {
        months.forEach(month => {
          rowMap[`${row.id}::${month}`] = Math.floor(Math.random() * 31) + 70;
        });
      });
      acc[item.id] = rowMap;
      return acc;
    }, {} as Record<string, Record<string, number>>),
  );

  const triggerAutoSave = () => {
    setSaveStatus('draft');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveStatus('saving');
      setTimeout(() => setSaveStatus('saved'), 600);
    }, 1000);
  };

  const getActual = (rowId: string, month: string) => actualCells[employeeId]?.[`${rowId}::${month}`] || 0;
  const setActual = (rowId: string, month: string, raw: string) => {
    const next = raw.trim() === '' ? 0 : Number(raw);
    if (Number.isNaN(next)) return;
    setActualCells(prev => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || {}),
        [`${rowId}::${month}`]: Math.max(0, next),
      },
    }));
    triggerAutoSave();
  };

  const getKpiResult = (rowId: string, month: string) => {
    const row = kpiRows.find(item => item.id === rowId);
    if (!row || row.target === 0) return 0;
    const ratio = (getActual(rowId, month) / row.target) * 100;
    return Math.round(Math.max(0, ratio));
  };

  const getWeightedResult = (rowId: string, month: string) => {
    const row = kpiRows.find(item => item.id === rowId);
    if (!row) return 0;
    return Math.round((getKpiResult(rowId, month) * row.weight) / 100);
  };

  const monthTotal = (month: string) => kpiRows.reduce((sum, row) => sum + getWeightedResult(row.id, month), 0);
  const grandTotal = () => months.reduce((sum, month) => sum + monthTotal(month), 0);

  const masterboardRows = useMemo(() => {
    return employeeOptions.map(item => {
      const total = months.reduce((sum, month) => {
        return sum + kpiRows.reduce((rowSum, row) => {
          const actual = actualCells[item.id]?.[`${row.id}::${month}`] || 0;
          const result = row.target === 0 ? 0 : Math.round((actual / row.target) * 100);
          return rowSum + Math.round((Math.max(0, result) * row.weight) / 100);
        }, 0);
      }, 0);
      return { id: item.id, name: item.name, total };
    });
  }, [actualCells, employeeOptions, months]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>KPI Calculation Results</h3>
          <SaveIndicator status={saveStatus} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Year {selectedYear}</span>
          <select
            className="input-base text-sm"
            style={{ minWidth: 220 }}
            value={employeeId}
            onChange={e => setEmployeeId(e.target.value)}
          >
            {employeeOptions.map(item => (
              <option key={`kpi-calc-${item.id}`} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'rgba(79,127,255,0.08)', border: '1px solid rgba(79,127,255,0.25)' }}>
        <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Calculator Formula</p>
        <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-secondary))' }}>
          KPI Result = (Actual / Target) x 100, Weighted Result = KPI Result x Weight%.
        </p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" style={{ minWidth: 1320 }}>
            <thead>
              <tr style={{ background: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                <th className="px-4 py-2 text-left text-xs font-semibold sticky left-0 z-10"
                  style={{ color: 'rgb(var(--text-muted))', background: 'rgb(var(--bg-elevated))', minWidth: 280 }}>
                  KPI Metric / Weight / Target
                </th>
                {months.map(month => (
                  <th key={`calc-head-${month}`} className="px-2 py-2 text-center text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))', minWidth: 76 }}>
                    {month}
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))', minWidth: 86 }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {kpiRows.map((row, idx) => (
                <tr key={`kpi-row-${row.id}`} style={{ borderBottom: '1px solid rgb(var(--border))', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td className="px-4 py-2 text-sm sticky left-0 z-10" style={{ color: 'rgb(var(--text-secondary))', background: idx % 2 === 0 ? 'rgb(var(--bg-card))' : 'rgb(var(--bg-surface))' }}>
                    <div className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{row.label}</div>
                    <div className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Weight {row.weight}% | Target {row.target}</div>
                  </td>
                  {months.map(month => (
                    <td key={`kpi-cell-${row.id}-${month}`} className="px-1 py-1">
                      <div className="space-y-1">
                        <input
                          type="number"
                          min={0}
                          value={getActual(row.id, month)}
                          onChange={e => setActual(row.id, month, e.target.value)}
                          className="w-full text-center text-sm font-mono rounded px-1.5 py-1 focus:outline-none"
                          style={{ background: 'transparent', color: 'rgb(var(--text-primary))', border: '1px solid rgba(255,255,255,0.08)' }}
                        />
                        <p className="text-[11px] text-center font-mono" style={{ color: 'rgb(79 127 255)' }}>
                          {getKpiResult(row.id, month)}% {'->'} {getWeightedResult(row.id, month)}
                        </p>
                      </div>
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center text-sm font-semibold font-mono" style={{ color: 'rgb(var(--text-primary))' }}>
                    {months.reduce((sum, month) => sum + getWeightedResult(row.id, month), 0)}
                  </td>
                </tr>
              ))}

              <tr style={{ background: 'rgba(79,127,255,0.1)', borderTop: '2px solid rgba(79,127,255,0.35)' }}>
                <td className="px-4 py-2 text-sm font-semibold sticky left-0 z-10" style={{ color: 'rgb(var(--text-primary))', background: 'rgba(79,127,255,0.1)' }}>
                  KPI Calculation Total (All Metrics)
                </td>
                {months.map(month => (
                  <td key={`kpi-total-${month}`} className="px-2 py-2 text-center text-sm font-semibold font-mono" style={{ color: 'rgb(79 127 255)' }}>
                    {monthTotal(month)}
                  </td>
                ))}
                <td className="px-2 py-2 text-center text-sm font-bold font-mono" style={{ color: 'rgb(79 127 255)' }}>
                  {grandTotal()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <p className="text-sm font-semibold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>KPI Calculator Masterboard</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {masterboardRows.map(row => (
            <button
              key={`kpi-master-${row.id}`}
              onClick={() => setEmployeeId(row.id)}
              className="px-3 py-2 rounded-lg text-left hover:bg-white/5 transition-colors"
              style={{ border: '1px solid rgb(var(--border-subtle))' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: row.id === employeeId ? 'rgb(79 127 255)' : 'rgb(var(--text-primary))' }}>{row.name}</span>
                <span className="text-xs font-mono" style={{ color: 'rgb(var(--text-secondary))' }}>{row.total}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Panel Client ──────────────────────────────────────────────────
export default function AdminPanelClient() {
  const { selectedYear, setSelectedYear, userRole } = useAppContext();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  if (userRole !== 'admin') {
    return (
      <div className="flex-1 grid place-items-center px-6 py-10">
        <div className="max-w-xl rounded-2xl p-6 text-center" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'rgb(248 113 113)' }}>Access Restricted</h3>
          <p className="text-sm mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>
            Admin panel is reserved for System Framework controls. HOD/Manager can request rule or formula changes through Admin workflow.
          </p>
        </div>
      </div>
    );
  }

  const tabs: { key: AdminTab; label: string; icon: string }[] = [
    { key: 'users', label: 'Users', icon: 'UsersIcon' },
    { key: 'departments', label: 'Departments', icon: 'BuildingOfficeIcon' },
    { key: 'scoring', label: 'Scoring Categories', icon: 'AdjustmentsHorizontalIcon' },
    { key: 'performance', label: 'Performance Scores', icon: 'TableCellsIcon' },
    { key: 'leave', label: 'Leave Control', icon: 'CalendarDaysIcon' },
  ];

  return (
    <AdminPanelSections
      selectedYear={selectedYear}
      setSelectedYear={setSelectedYear}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
      showTabNavigation
    />
  );
}

interface AdminPanelClientProps {
  fixedTab?: AdminTab;
  showTabNavigation?: boolean;
}

export function AdminPanelSectionClient({ fixedTab, showTabNavigation = false }: AdminPanelClientProps) {
  const { selectedYear, setSelectedYear, userRole } = useAppContext();
  const [activeTab, setActiveTab] = useState<AdminTab>(fixedTab ?? 'users');

  useEffect(() => {
    if (fixedTab) {
      setActiveTab(fixedTab);
    }
  }, [fixedTab]);

  if (userRole !== 'admin') {
    return (
      <div className="flex-1 grid place-items-center px-6 py-10">
        <div className="max-w-xl rounded-2xl p-6 text-center" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'rgb(248 113 113)' }}>Access Restricted</h3>
          <p className="text-sm mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>
            Admin panel is reserved for System Framework controls. HOD/Manager can request rule or formula changes through Admin workflow.
          </p>
        </div>
      </div>
    );
  }

  const tabs: { key: AdminTab; label: string; icon: string }[] = [
    { key: 'users', label: 'Users', icon: 'UsersIcon' },
    { key: 'profile-updates', label: 'Profile Updates', icon: 'IdentificationIcon' },
    { key: 'departments', label: 'Departments', icon: 'BuildingOfficeIcon' },
    { key: 'scoring', label: 'Scoring Categories', icon: 'AdjustmentsHorizontalIcon' },
    { key: 'performance', label: 'Performance Scores', icon: 'TableCellsIcon' },
    { key: 'leave', label: 'Leave Control', icon: 'CalendarDaysIcon' },
    { key: 'attributes', label: 'Evaluation Forms', icon: 'DocumentTextIcon' },
    { key: 'audit', label: 'Audit Trail', icon: 'ClipboardDocumentCheckIcon' },
  ];

  return (
    <AdminPanelSections
      selectedYear={selectedYear}
      setSelectedYear={setSelectedYear}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
      showTabNavigation={showTabNavigation}
    />
  );
}

function AdminPanelSections({
  selectedYear,
  setSelectedYear,
  activeTab,
  setActiveTab,
  tabs,
  showTabNavigation,
}: {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  tabs: { key: AdminTab; label: string; icon: string }[];
  showTabNavigation: boolean;
}) {
  const { availableYears: years, setAvailableYears: setYears, silentMode, setSilentMode } = useAppContext();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'rgb(var(--text-primary))' }}>System Framework Control</h1>
            <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Comprehensive framework for HR operations and performance scoring.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer hover:bg-white/5 transition-colors" 
              style={{ 
                borderColor: silentMode ? 'rgba(239,68,68,0.3)' : 'rgb(var(--border-subtle))',
                background: silentMode ? 'rgba(239,68,68,0.05)' : 'rgb(var(--bg-card))'
              }}
              title="Silent Mode: Skip automated email notifications for this session"
            >
              <input
                type="checkbox"
                checked={silentMode}
                onChange={e => setSilentMode(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-red-500 focus:ring-red-500"
              />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: silentMode ? 'rgb(239 68 68)' : 'rgb(var(--text-secondary))' }}>
                {silentMode ? 'Silent Mode ON' : 'Silent Mode'}
              </span>
            </label>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border" style={{ borderColor: 'rgb(var(--border-subtle))', background: 'rgb(var(--bg-card))' }}>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
        </div>
        {showTabNavigation && (
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex-1 justify-center"
                style={{
                  background: activeTab === tab.key ? 'rgba(79,127,255,0.15)' : 'transparent',
                  color: activeTab === tab.key ? 'rgb(79 127 255)' : 'rgb(var(--text-secondary))',
                }}>
                <Icon name={tab.icon as never} size={15} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Tab Content */}
        <div className="animate-fade-in">
          {activeTab === 'users' && <UsersPanel />}
          {activeTab === 'profile-updates' && <AdminProfileReviewPanel />}
          {activeTab === 'departments' && <DepartmentsPanel />}
          {activeTab === 'scoring' && <ScoringPanel selectedYear={selectedYear} setSelectedYear={setSelectedYear} years={years} setYears={setYears} />}
          {activeTab === 'performance' && <PerformancePanel selectedYear={selectedYear} />}
          {activeTab === 'leave' && <LeaveControlRoom />}
          {activeTab === 'attributes' && <EvaluationFormBuilder />}
          {activeTab === 'audit' && <ActivityAuditLogPanel />}
        </div>
      </div>
    </div>
  );
}
