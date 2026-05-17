'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { buildClientAuthHeaders, readClientIdentity } from '@/lib/clientAuth';

type PerformanceScoreRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  periodLabel: string;
  performance60: number;
  participation25: number;
  popularity15: number;
  penaltyDeduction: number;
  finalScore: number;
  status: string;
};

type PenaltyType = {
  id: string;
  typeCode: string;
  typeName: string;
  defaultSeverity: 'low' | 'medium' | 'high';
  active: boolean;
};

type TeamMember = {
  id: string;
  name: string;
  dept: string;
};

interface TeamPerformanceOverviewPanelProps {
  departmentScope?: string | null;
}

export default function TeamPerformanceOverviewPanel({ departmentScope = null }: TeamPerformanceOverviewPanelProps) {
  const [scores, setScores] = useState<PerformanceScoreRow[]>([]);
  const [penaltyTypes, setPenaltyTypes] = useState<PenaltyType[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const identity = useMemo(() => readClientIdentity('hod'), []);
  const currentManagerId = identity.userId;

  const managerHeaders = useMemo(
    () => buildClientAuthHeaders({
      ...identity,
      department: departmentScope || identity.department,
    }),
    [departmentScope, identity],
  );

  const [penaltyForm, setPenaltyForm] = useState({
    employeeId: '',
    penaltyTypeCode: '',
    penaltyDate: new Date().toISOString().slice(0, 10),
    severity: 'medium' as 'low' | 'medium' | 'high',
    reason: '',
  });

  const selectedMember = useMemo(
    () => teamMembers.find(member => member.id === penaltyForm.employeeId),
    [penaltyForm.employeeId, teamMembers],
  );

  const selectedPenaltyType = useMemo(
    () => penaltyTypes.find(type => type.typeCode === penaltyForm.penaltyTypeCode),
    [penaltyForm.penaltyTypeCode, penaltyTypes],
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        mode: 'scores',
        periodYear: String(periodYear),
        status: 'all',
      });
      if (departmentScope) {
        query.set('department', departmentScope);
      }

      const [scoresResponse, typesResponse, usersResponse] = await Promise.all([
        fetch(`/api/performance-management?${query.toString()}`, {
          headers: managerHeaders,
        }),
        fetch('/api/performance-management?mode=penalty-types&activeOnly=1', {
          headers: managerHeaders,
        }),
        fetch('/api/users', {
          headers: managerHeaders,
        }),
      ]);

      const scoresPayload = await scoresResponse.json().catch(() => ({}));
      const typesPayload = await typesResponse.json().catch(() => ({}));
      const usersPayload = await usersResponse.json().catch(() => ({}));

      if (!scoresResponse.ok) throw new Error(scoresPayload?.error || 'Failed to load team performance');
      if (!typesResponse.ok) throw new Error(typesPayload?.error || 'Failed to load penalty types');

      const loadedScores = (scoresPayload?.scores || []) as PerformanceScoreRow[];
      const loadedTypes = (typesPayload?.penaltyTypes || []) as PenaltyType[];
      const loadedUsers = Array.isArray(usersPayload?.users)
        ? (usersPayload.users as any[])
            .filter(user => !departmentScope || user.dept === departmentScope)
            .map(user => ({ id: user.id, name: user.name, dept: user.dept || 'Operations' }))
        : [];

      setScores(loadedScores);
      setPenaltyTypes(loadedTypes);
      setTeamMembers(loadedUsers);

      if (!penaltyForm.penaltyTypeCode && loadedTypes[0]) {
        setPenaltyForm(prev => ({
          ...prev,
          penaltyTypeCode: loadedTypes[0].typeCode,
          severity: loadedTypes[0].defaultSeverity,
        }));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load team performance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [departmentScope, periodYear]);

  const teamAverage = useMemo(() => {
    if (scores.length === 0) return 0;
    return Math.round((scores.reduce((sum, row) => sum + Number(row.finalScore || 0), 0) / scores.length) * 100) / 100;
  }, [scores]);

  const topPerformer = useMemo(() => {
    if (scores.length === 0) return null;
    return [...scores].sort((a, b) => b.finalScore - a.finalScore)[0];
  }, [scores]);

  const submitPenalty = async () => {
    if (!selectedMember) {
      toast.error('Please select a team member');
      return;
    }

    if (!penaltyForm.reason.trim()) {
      toast.error('Reason is required');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/performance-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...managerHeaders,
        },
        body: JSON.stringify({
          action: 'create-penalty',
          actor: currentManagerId,
          employeeId: selectedMember.id,
          employeeName: selectedMember.name,
          department: selectedMember.dept,
          penaltyTypeCode: penaltyForm.penaltyTypeCode,
          penaltyDate: penaltyForm.penaltyDate,
          severity: penaltyForm.severity,
          reason: penaltyForm.reason.trim(),
          status: 'active',
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create penalty');
      }

      toast.success('Team penalty recorded. Score will reflect on next calculation run.');
      setPenaltyForm(prev => ({ ...prev, reason: '' }));
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create penalty');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold">Team Performance Overview</h3>
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>3Ps score aggregation with penalty impact</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs">Year</label>
            <input
              type="number"
              className="input-base text-xs"
              style={{ width: 92 }}
              value={periodYear}
              onChange={event => setPeriodYear(Number(event.target.value) || new Date().getFullYear())}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg p-3" style={{ background: 'rgba(79,127,255,0.12)', border: '1px solid rgba(79,127,255,0.25)' }}>
            <p className="text-xs">Team Members with Score</p>
            <p className="text-lg font-bold" style={{ color: 'rgb(79 127 255)' }}>{scores.length}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}>
            <p className="text-xs">Team Avg Final Score</p>
            <p className="text-lg font-bold" style={{ color: 'rgb(52 211 153)' }}>{teamAverage}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <p className="text-xs">Top Performer</p>
            <p className="text-sm font-semibold" style={{ color: 'rgb(251 191 36)' }}>{topPerformer ? `${topPerformer.employeeName} (${topPerformer.finalScore})` : 'n/a'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <h4 className="text-sm font-semibold mb-3">Add Team Penalty</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <select
            className="input-base text-sm"
            value={penaltyForm.employeeId}
            onChange={event => setPenaltyForm(prev => ({ ...prev, employeeId: event.target.value }))}
          >
            <option value="">Select Team Member</option>
            {teamMembers.map(member => (
              <option key={`member-${member.id}`} value={member.id}>{member.name}</option>
            ))}
          </select>

          <select
            className="input-base text-sm"
            value={penaltyForm.penaltyTypeCode}
            onChange={event => {
              const matched = penaltyTypes.find(type => type.typeCode === event.target.value);
              setPenaltyForm(prev => ({
                ...prev,
                penaltyTypeCode: event.target.value,
                severity: matched?.defaultSeverity || prev.severity,
              }));
            }}
          >
            <option value="">Penalty Type</option>
            {penaltyTypes.map(type => (
              <option key={`type-${type.id}`} value={type.typeCode}>{type.typeName}</option>
            ))}
          </select>

          <input
            type="date"
            className="input-base text-sm"
            value={penaltyForm.penaltyDate}
            onChange={event => setPenaltyForm(prev => ({ ...prev, penaltyDate: event.target.value }))}
          />

          <div className="flex items-center gap-2">
          </div>

          <select
            className="input-base text-sm"
            value={penaltyForm.severity}
            onChange={event => setPenaltyForm(prev => ({ ...prev, severity: event.target.value as 'low' | 'medium' | 'high' }))}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <input
            className="input-base text-sm md:col-span-2 xl:col-span-3"
            placeholder="Reason"
            value={penaltyForm.reason}
            onChange={event => setPenaltyForm(prev => ({ ...prev, reason: event.target.value }))}
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button className="btn-primary text-xs" onClick={submitPenalty} disabled={saving}>
            {saving ? 'Saving...' : 'Save Penalty'}
          </button>
          {selectedPenaltyType && (
            <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
              Severity: {selectedPenaltyType.defaultSeverity}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        {loading ? (
          <div className="p-4 text-sm">Loading team scores...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgb(var(--border-subtle))', background: 'rgb(var(--bg-elevated))' }}>
                  <th className="px-3 py-2 text-left text-xs">Employee</th>
                  <th className="px-3 py-2 text-left text-xs">Period</th>
                  <th className="px-3 py-2 text-right text-xs">P60</th>
                  <th className="px-3 py-2 text-right text-xs">P25</th>
                  <th className="px-3 py-2 text-right text-xs">P15</th>
                  <th className="px-3 py-2 text-right text-xs">Penalty</th>
                  <th className="px-3 py-2 text-right text-xs">Final</th>
                  <th className="px-3 py-2 text-left text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {scores.map(row => (
                  <tr key={`score-${row.id}`} style={{ borderBottom: '1px solid rgb(var(--border))' }}>
                    <td className="px-3 py-2 text-xs">{row.employeeName}</td>
                    <td className="px-3 py-2 text-xs">{row.periodLabel}</td>
                    <td className="px-3 py-2 text-right text-xs">{row.performance60}</td>
                    <td className="px-3 py-2 text-right text-xs">{row.participation25}</td>
                    <td className="px-3 py-2 text-right text-xs">{row.popularity15}</td>
                    <td className="px-3 py-2 text-right text-xs">-{row.penaltyDeduction}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold">{row.finalScore}</td>
                    <td className="px-3 py-2 text-xs">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {scores.length === 0 && <div className="p-4 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>No team score records in selected year.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
