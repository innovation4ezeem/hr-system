'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { buildClientAuthHeaders } from '@/lib/clientAuth';
import { useAppContext } from '@/context/AppContext';
import { toast } from 'sonner';

type PenaltyLevel = 'Warning' | 'Minor' | 'Major' | 'Termination';
type PenaltyCategory = 'Attendance' | 'Conduct' | 'Performance' | 'Policy Breach' | 'Safety';
type PenaltyLogMode = 'standard' | 'cash';

interface DatabasePenalty {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  penaltyTypeCode: string;
  penaltyDate: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  attachment?: string;
  status: 'active' | 'resolved';
  linkedLeaveRequestId?: string;
}

interface Penalty {
  id: string;
  date: string;
  employee: string;
  dept: string;
  mistake: string;
  level: PenaltyLevel;
  category: PenaltyCategory;
  remarks: string;
  hasDoc: boolean;
  sourceStatus: 'active' | 'resolved';
}

const levelStyle: Record<PenaltyLevel, { bg: string; text: string }> = {
  Warning: { bg: 'rgba(251,191,36,0.1)', text: 'rgb(251 191 36)' },
  Minor: { bg: 'rgba(248,113,113,0.1)', text: 'rgb(248 113 113)' },
  Major: { bg: 'rgba(248,113,113,0.2)', text: 'rgb(240 80 80)' },
  Termination: { bg: 'rgba(220,30,30,0.2)', text: 'rgb(220 30 30)' },
};

const severityToLevel: Record<DatabasePenalty['severity'], PenaltyLevel> = {
  low: 'Warning',
  medium: 'Minor',
  high: 'Major',
};

function mapPenaltyCategory(code: string, reason: string): PenaltyCategory {
  const normalizedCode = String(code || '').toUpperCase();
  const normalizedReason = String(reason || '').toLowerCase();

  if (normalizedCode.includes('ABSENT') || normalizedCode.includes('LATE') || normalizedReason.includes('attendance')) {
    return 'Attendance';
  }
  if (normalizedCode.includes('CONDUCT') || normalizedReason.includes('conduct')) {
    return 'Conduct';
  }
  if (normalizedCode.includes('PERFORMANCE') || normalizedReason.includes('report') || normalizedReason.includes('deadline')) {
    return 'Performance';
  }
  if (normalizedCode.includes('SAFETY')) {
    return 'Safety';
  }
  return 'Policy Breach';
}

function mapPenalty(row: DatabasePenalty): Penalty {
  return {
    id: row.id,
    date: row.penaltyDate,
    employee: row.employeeName,
    dept: row.department,
    mistake: row.reason,
    level: severityToLevel[row.severity] || 'Warning',
    category: mapPenaltyCategory(row.penaltyTypeCode, row.reason),
    remarks: row.reason,
    hasDoc: Boolean(row.attachment),
    sourceStatus: row.status,
  };
}

interface PenaltyLogPanelProps {
  isArchive?: boolean;
  departmentScope?: string | null;
  canManage?: boolean;
  year?: number;
}

export default function PenaltyLogPanel({ isArchive = false, departmentScope = null, canManage = true, year }: PenaltyLogPanelProps) {
  const { userRole, userId, userName, userDepartment, selectedYear } = useAppContext();
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandId, setExpandId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmployee, setNewEmployee] = useState('');
  const [newMistake, setNewMistake] = useState('');
  const [newLevel, setNewLevel] = useState<PenaltyLevel>('Warning');
  const [newCategory, setNewCategory] = useState<PenaltyCategory>('Attendance');
  const [loading, setLoading] = useState(false);

  const effectiveYear = year || selectedYear || new Date().getFullYear();

  const authHeaders = useMemo(() => buildClientAuthHeaders({
    role: userRole,
    userId: userId || 'admin-001',
    userName: userName || 'Manager',
    department: userDepartment || departmentScope || 'Operations',
  }), [departmentScope, userDepartment, userId, userName, userRole]);

  const loadPenalties = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        mode: 'penalties',
        year: String(effectiveYear),
        status: 'all',
        includeResolved: '1',
      });

      if (departmentScope) {
        params.set('department', departmentScope);
      }

      const response = await fetch(`/api/performance-management?${params.toString()}`, {
        headers: authHeaders,
      });
      const contentType = response.headers.get('content-type');
      let body: any = {};

      if (contentType && contentType.includes('application/json')) {
        body = await response.json().catch(() => ({}));
      }

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to load penalties');
      }

      const records = Array.isArray(body?.penalties) ? body.penalties as DatabasePenalty[] : [];
      setPenalties(records.map(mapPenalty));
    } catch (error) {
      setPenalties([]);
      toast.error(error instanceof Error ? error.message : 'Failed to load penalty records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPenalties();
    // Reload when the manager year, scope, or auth identity changes.
  }, [departmentScope, effectiveYear, authHeaders]);

  const displayed = departmentScope ? penalties.filter(p => p.dept === departmentScope) : penalties;

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/penalties?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'Delete failed');
      }

      setDeleteId(null);
      await loadPenalties();
      toast.success('Penalty record deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  const handleAdd = async () => {
    try {
      const employeeName = newEmployee.trim() || 'Ahmad Faris';
      const reason = newMistake.trim() || 'New penalty entry';
      const department = departmentScope || userDepartment || 'Operations';

      const response = await fetch('/api/penalties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          actor: userId || userRole,
          employeeName,
          department,
          category: newCategory,
          level: newLevel,
          penaltyDate: new Date(effectiveYear, new Date().getMonth(), new Date().getDate()).toISOString().slice(0, 10),
          reason,
          severity: newLevel === 'Major' || newLevel === 'Termination' ? 'high' : newLevel === 'Minor' ? 'medium' : 'low',
          status: 'active',
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'Save failed');
      }

      setNewEmployee('');
      setNewMistake('');
      setShowAdd(false);
      await loadPenalties();
      toast.success('Penalty record saved to database');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save penalty record');
    }
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Penalty Logs</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
            Historical record of disciplinary actions and warnings
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isArchive && canManage && (
            <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center gap-2 text-xs">
              <Icon name="PlusIcon" size={14} /> Add Record
            </button>
          )}
        </div>
      </div>

      {showAdd && !isArchive && canManage && (
        <div className="px-5 py-4 border-b animate-slide-up" style={{ borderColor: 'rgb(var(--border-subtle))', background: 'rgba(248,113,113,0.04)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Employee</label>
              <input value={newEmployee} onChange={e => setNewEmployee(e.target.value)} className="input-base text-xs" placeholder="Employee name" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Level</label>
              <select value={newLevel} onChange={e => setNewLevel(e.target.value as PenaltyLevel)} className="input-base text-xs">
                {['Warning', 'Minor', 'Major', 'Termination'].map(l => <option key={`lvl-${l}`} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Category</label>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value as PenaltyCategory)} className="input-base text-xs">
                {['Attendance', 'Conduct', 'Performance', 'Policy Breach', 'Safety'].map(c => <option key={`cat-${c}`} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-medium block mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Mistake Description</label>
            <input value={newMistake} onChange={e => setNewMistake(e.target.value)} className="input-base text-xs" placeholder="Describe the incident..." />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn-primary text-xs">Save Penalty Record</button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost text-xs">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 700 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgb(var(--border-subtle))' }}>
              {['Date', 'Employee', 'Category', 'Level', 'Remarks', 'Docs', 'Actions'].map(h => (
                <th
                  key={`ph-${h}`}
                  className="px-4 py-3 text-left"
                  style={{ color: 'rgb(var(--text-muted))', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center" style={{ color: 'rgb(var(--text-muted))' }}>
                  Loading penalty records from the database...
                </td>
              </tr>
            ) : displayed.length > 0 ? (
              displayed.map(pen => {
                const ls = levelStyle[pen.level];
                return (
                  <React.Fragment key={pen.id}>
                    <tr
                      className="border-b hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      style={{ borderColor: 'rgb(var(--border))' }}
                      onClick={() => setExpandId(expandId === pen.id ? null : pen.id)}
                    >
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono" style={{ color: 'rgb(var(--text-secondary))', fontVariantNumeric: 'tabular-nums' }}>{pen.date}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{pen.employee}</p>
                        <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{pen.dept}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(167,139,250,0.1)', color: 'rgb(167 139 250)' }}>
                          {pen.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: ls.bg, color: ls.text }}>
                          {pen.level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs max-w-xs truncate" style={{ color: 'rgb(var(--text-secondary))' }}>{pen.remarks}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Icon name={pen.hasDoc ? 'PaperClipIcon' : 'XMarkIcon'} size={14} className={pen.hasDoc ? 'text-emerald-400' : 'text-gray-600'} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isArchive && canManage && (
                            <>
                              <button className="p-1.5 rounded hover:bg-white/10 transition-colors" title="Edit record" style={{ color: 'rgb(var(--text-secondary))' }}>
                                <Icon name="PencilSquareIcon" size={14} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteId(pen.id); }}
                                className="p-1.5 rounded hover:bg-red-400/10 transition-colors"
                                title="Delete record — this cannot be undone"
                                style={{ color: 'rgb(248 113 113)' }}
                              >
                                <Icon name="TrashIcon" size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandId === pen.id && (
                      <tr key={`${pen.id}-expand`} style={{ background: 'rgba(79,127,255,0.03)' }}>
                        <td colSpan={7} className="px-6 py-3 animate-fade-in">
                          <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--text-muted))' }}>Full Remarks</p>
                          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{pen.remarks}</p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center" style={{ color: 'rgb(var(--text-muted))' }}>
                  No penalty records found for the selected manager scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {displayed.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Icon name="ShieldCheckIcon" size={40} className="text-emerald-400 mb-3 opacity-50" />
          <p className="text-base font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>
            No penalty records
          </p>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
            All team members are in good standing this period.
          </p>
        </div>
      )}

      <ConfirmModal
        open={deleteId !== null}
        title="Delete Penalty Record"
        message="This will permanently remove this penalty record. Any KPI deductions from this record will be reversed on the next score calculation."
        confirmLabel="Delete Record"
        variant="danger"
        onConfirm={() => deleteId && void handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
