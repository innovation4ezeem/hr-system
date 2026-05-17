'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type ConfigPayload = {
  id: number;
  versionNo: number;
  config: {
    weights: {
      performance: number;
      participation: number;
      popularity: number;
    };
    performance: {
      kpiWeight: number;
      tasksWeight: number;
      qualityWeight: number;
      qualityMinPercent: number;
    };
    penalty: {
      allowDeduction: boolean;
      maxDeduction: number;
    };
    workflow: {
      allowManagerSelfApproval: boolean;
      selfApprovalFallbackApproverId: string;
    };
    leavePolicy: {
      annualLeave: {
        serviceYears2To5: number;
        serviceYearsGT5: number;
        intern: number;
      };
      carryForwardExpiryMonth: number;
      carryForwardExpiryDay: number;
      allowNextYearBookingAfterMonth: number;
      allowNextYearBookingAfterDay: number;
      requireExportPreviousYearBeforeNextYearBooking: boolean;
      prorateAfterYears: number;
    };
    participationRules: {
      PLAY_ATTENDANCE: { pointsPerUnit: number; maxPoints: number };
      PLAY_WINNER: { pointsPerUnit: number; maxPoints: number };
      LEARN_ATTENDANCE: { pointsPerUnit: number; maxPoints: number };
      HCM_STICKERS: { pointsPerUnit: number; maxPoints: number };
      bucketMaxPoints: number;
    };
    popularityRules: {
      GRATITUDE_STICKER: { pointsPerUnit: number; maxPoints: number };
      VOTING_FORM: { pointsPerUnit: number; maxPoints: number };
      bucketMaxPoints: number;
    };
  };
};

type PenaltyType = {
  id: string;
  typeCode: string;
  typeName: string;
  defaultSeverity: 'low' | 'medium' | 'high';
  active: boolean;
};

export default function ThreePsConfigPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configRecord, setConfigRecord] = useState<ConfigPayload | null>(null);
  const [penaltyTypes, setPenaltyTypes] = useState<PenaltyType[]>([]);
  const [calcResult, setCalcResult] = useState<any>(null);

  const [newType, setNewType] = useState<PenaltyType>({
    id: '',
    typeCode: '',
    typeName: '',
    defaultSeverity: 'medium',
    active: true,
  });

  const [calcForm, setCalcForm] = useState({
    employeeId: 'e-001',
    employeeName: 'Demo Employee',
    department: 'Operations',
    periodType: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
    periodYear: new Date().getFullYear(),
    periodNo: new Date().getMonth() + 1,
    kpiAchieved: 35,
    kpiTotal: 40,
    tasksAchieved: 42,
    tasksTotal: 45,
    qualityTotalTasks: 45,
    qualityErrors: 3,
    playAttendance: 3,
    playWinner: 1,
    learnAttendance: 2,
    hcmStickers: 4,
    gratitudeSticker: 1,
    votingForm: 2,
  });

  const weightSum = useMemo(() => {
    if (!configRecord) return 0;
    return configRecord.config.weights.performance + configRecord.config.weights.participation + configRecord.config.weights.popularity;
  }, [configRecord]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configResponse, typeResponse] = await Promise.all([
        fetch('/api/performance-management?mode=config', { headers: { 'x-user-role': 'admin' } }),
        fetch('/api/performance-management?mode=penalty-types&activeOnly=0', { headers: { 'x-user-role': 'admin' } }),
      ]);

      const configPayload = await configResponse.json();
      const typePayload = await typeResponse.json();

      if (!configResponse.ok) throw new Error(configPayload?.error || 'Failed to load config');
      if (!typeResponse.ok) throw new Error(typePayload?.error || 'Failed to load penalty types');

      setConfigRecord(configPayload?.config || null);
      setPenaltyTypes(typePayload?.penaltyTypes || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load 3Ps setup');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const updateConfig = (updater: (draft: ConfigPayload) => ConfigPayload) => {
    setConfigRecord(prev => {
      if (!prev) return prev;
      return updater({ ...prev, config: { ...prev.config } });
    });
  };

  const saveConfig = async () => {
    if (!configRecord) return;
    if (weightSum !== 100) {
      toast.error('Weights must sum to 100');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/performance-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          action: 'upsert-config',
          actor: 'admin-ui',
          config: configRecord.config,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to save config');

      setConfigRecord(payload?.config || configRecord);
      toast.success('3Ps config updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const addPenaltyType = async () => {
    if (!newType.typeCode.trim() || !newType.typeName.trim()) {
      toast.error('typeCode and typeName are required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...newType,
        id: newType.id || `PT-${newType.typeCode.trim().toUpperCase()}`,
        typeCode: newType.typeCode.trim().toUpperCase(),
        typeName: newType.typeName.trim(),
      };

      const response = await fetch('/api/performance-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          action: 'upsert-penalty-type',
          actor: 'admin-ui',
          payload,
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'Failed to upsert penalty type');

      toast.success('Penalty type saved');
      setNewType({
        id: '',
        typeCode: '',
        typeName: '',
        defaultSeverity: 'medium',
        active: true,
      });
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save penalty type');
    } finally {
      setSaving(false);
    }
  };

  const runCalculator = async () => {
    try {
      setSaving(true);
      const inputResponse = await fetch('/api/performance-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          action: 'upsert-input',
          actor: 'admin-ui',
          employeeId: calcForm.employeeId,
          employeeName: calcForm.employeeName,
          department: calcForm.department,
          periodType: calcForm.periodType,
          periodYear: calcForm.periodYear,
          periodNo: calcForm.periodNo,
          kpiAchieved: calcForm.kpiAchieved,
          kpiTotal: calcForm.kpiTotal,
          tasksAchieved: calcForm.tasksAchieved,
          tasksTotal: calcForm.tasksTotal,
          qualityTotalTasks: calcForm.qualityTotalTasks,
          qualityErrors: calcForm.qualityErrors,
          participation: {
            PLAY_ATTENDANCE: calcForm.playAttendance,
            PLAY_WINNER: calcForm.playWinner,
            LEARN_ATTENDANCE: calcForm.learnAttendance,
            HCM_STICKERS: calcForm.hcmStickers,
          },
          popularity: {
            GRATITUDE_STICKER: calcForm.gratitudeSticker,
            VOTING_FORM: calcForm.votingForm,
          },
        }),
      });

      const inputPayload = await inputResponse.json();
      if (!inputResponse.ok) throw new Error(inputPayload?.error || 'Failed to save calculator input');

      const scoreResponse = await fetch('/api/performance-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          action: 'calculate-score',
          actor: 'admin-ui',
          employeeId: calcForm.employeeId,
          periodType: calcForm.periodType,
          periodYear: calcForm.periodYear,
          periodNo: calcForm.periodNo,
        }),
      });

      const scorePayload = await scoreResponse.json();
      if (!scoreResponse.ok) throw new Error(scorePayload?.error || 'Failed to calculate score');

      setCalcResult(scorePayload?.score || null);
      toast.success('Score calculated successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to run calculator');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !configRecord) {
    return (
      <div className="rounded-xl p-12 flex flex-col items-center justify-center gap-3" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <span className="text-xs font-medium" style={{ color: 'rgb(var(--text-muted))' }}>Loading 3Ps configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <h3 className="text-base font-semibold mb-3">3Ps Formula and Policy Config</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          <input className="input-base text-xs" type="number" value={configRecord.config.weights.performance}
            onChange={event => updateConfig(draft => ({ ...draft, config: { ...draft.config, weights: { ...draft.config.weights, performance: Number(event.target.value) || 0 } } }))} />
          <input className="input-base text-xs" type="number" value={configRecord.config.weights.participation}
            onChange={event => updateConfig(draft => ({ ...draft, config: { ...draft.config, weights: { ...draft.config.weights, participation: Number(event.target.value) || 0 } } }))} />
          <input className="input-base text-xs" type="number" value={configRecord.config.weights.popularity}
            onChange={event => updateConfig(draft => ({ ...draft, config: { ...draft.config, weights: { ...draft.config.weights, popularity: Number(event.target.value) || 0 } } }))} />
          <input className="input-base text-xs" type="number" value={configRecord.config.performance.qualityMinPercent}
            onChange={event => updateConfig(draft => ({ ...draft, config: { ...draft.config, performance: { ...draft.config.performance, qualityMinPercent: Number(event.target.value) || 0 } } }))} />
          <input className="input-base text-xs" type="number" value={configRecord.config.leavePolicy.annualLeave.serviceYears2To5}
            onChange={event => updateConfig(draft => ({ ...draft, config: { ...draft.config, leavePolicy: { ...draft.config.leavePolicy, annualLeave: { ...draft.config.leavePolicy.annualLeave, serviceYears2To5: Number(event.target.value) || 0 } } } }))} />
          <input className="input-base text-xs" type="number" value={configRecord.config.leavePolicy.annualLeave.serviceYearsGT5}
            onChange={event => updateConfig(draft => ({ ...draft, config: { ...draft.config, leavePolicy: { ...draft.config.leavePolicy, annualLeave: { ...draft.config.leavePolicy.annualLeave, serviceYearsGT5: Number(event.target.value) || 0 } } } }))} />
          <input className="input-base text-xs" type="number" value={configRecord.config.leavePolicy.carryForwardExpiryMonth}
            onChange={event => updateConfig(draft => ({ ...draft, config: { ...draft.config, leavePolicy: { ...draft.config.leavePolicy, carryForwardExpiryMonth: Number(event.target.value) || 2 } } }))} />
          <input className="input-base text-xs" type="number" value={configRecord.config.leavePolicy.carryForwardExpiryDay}
            onChange={event => updateConfig(draft => ({ ...draft, config: { ...draft.config, leavePolicy: { ...draft.config.leavePolicy, carryForwardExpiryDay: Number(event.target.value) || 28 } } }))} />
        </div>

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <label className="text-xs flex items-center gap-2">
            <input
              type="checkbox"
              checked={configRecord.config.workflow.allowManagerSelfApproval}
              onChange={event => updateConfig(draft => ({ ...draft, config: { ...draft.config, workflow: { ...draft.config.workflow, allowManagerSelfApproval: event.target.checked } } }))}
            />
            Allow Manager Self Approval
          </label>
          <input
            className="input-base text-xs"
            style={{ width: 220 }}
            value={configRecord.config.workflow.selfApprovalFallbackApproverId}
            onChange={event => updateConfig(draft => ({ ...draft, config: { ...draft.config, workflow: { ...draft.config.workflow, selfApprovalFallbackApproverId: event.target.value } } }))}
            placeholder="Fallback approver id"
          />
          <span className="text-xs" style={{ color: weightSum === 100 ? 'rgb(52 211 153)' : 'rgb(248 113 113)' }}>
            Weight sum: {weightSum}
          </span>
          <button className="btn-primary text-xs" onClick={saveConfig} disabled={saving}>
            {saving ? 'Saving...' : 'Save 3Ps Config'}
          </button>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <h4 className="text-sm font-semibold mb-3">Penalty Types</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className="input-base text-xs" placeholder="Type Code" value={newType.typeCode} onChange={event => setNewType(prev => ({ ...prev, typeCode: event.target.value }))} />
          <input className="input-base text-xs md:col-span-2" placeholder="Type Name" value={newType.typeName} onChange={event => setNewType(prev => ({ ...prev, typeName: event.target.value }))} />
          <select className="input-base text-xs" value={newType.defaultSeverity} onChange={event => setNewType(prev => ({ ...prev, defaultSeverity: event.target.value as 'low' | 'medium' | 'high' }))}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="mt-2">
          <button className="btn-primary text-xs" onClick={addPenaltyType} disabled={saving}>{saving ? 'Saving...' : 'Add / Update Penalty Type'}</button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                <th className="text-left px-2 py-1">Code</th>
                <th className="text-left px-2 py-1">Name</th>
                <th className="text-left px-2 py-1">Severity</th>
              </tr>
            </thead>
            <tbody>
              {penaltyTypes.map(item => (
                <tr key={`ptype-${item.id}`} style={{ borderBottom: '1px solid rgb(var(--border))' }}>
                  <td className="px-2 py-1">{item.typeCode}</td>
                  <td className="px-2 py-1">{item.typeName}</td>
                  <td className="px-2 py-1">{item.defaultSeverity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <h4 className="text-sm font-semibold mb-3">Score Calculator Tool</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input className="input-base text-xs" placeholder="Employee Id" value={calcForm.employeeId} onChange={event => setCalcForm(prev => ({ ...prev, employeeId: event.target.value }))} />
          <input className="input-base text-xs" placeholder="Employee Name" value={calcForm.employeeName} onChange={event => setCalcForm(prev => ({ ...prev, employeeName: event.target.value }))} />
          <input className="input-base text-xs" placeholder="Department" value={calcForm.department} onChange={event => setCalcForm(prev => ({ ...prev, department: event.target.value }))} />
          <input className="input-base text-xs" type="number" placeholder="Period Year" value={calcForm.periodYear} onChange={event => setCalcForm(prev => ({ ...prev, periodYear: Number(event.target.value) || new Date().getFullYear() }))} />
          <input className="input-base text-xs" type="number" placeholder="KPI Achieved" value={calcForm.kpiAchieved} onChange={event => setCalcForm(prev => ({ ...prev, kpiAchieved: Number(event.target.value) || 0 }))} />
          <input className="input-base text-xs" type="number" placeholder="KPI Total" value={calcForm.kpiTotal} onChange={event => setCalcForm(prev => ({ ...prev, kpiTotal: Number(event.target.value) || 0 }))} />
          <input className="input-base text-xs" type="number" placeholder="Tasks Achieved" value={calcForm.tasksAchieved} onChange={event => setCalcForm(prev => ({ ...prev, tasksAchieved: Number(event.target.value) || 0 }))} />
          <input className="input-base text-xs" type="number" placeholder="Tasks Total" value={calcForm.tasksTotal} onChange={event => setCalcForm(prev => ({ ...prev, tasksTotal: Number(event.target.value) || 0 }))} />
          <input className="input-base text-xs" type="number" placeholder="Quality Total Tasks" value={calcForm.qualityTotalTasks} onChange={event => setCalcForm(prev => ({ ...prev, qualityTotalTasks: Number(event.target.value) || 0 }))} />
          <input className="input-base text-xs" type="number" placeholder="Quality Errors" value={calcForm.qualityErrors} onChange={event => setCalcForm(prev => ({ ...prev, qualityErrors: Number(event.target.value) || 0 }))} />
          <input className="input-base text-xs" type="number" placeholder="PLAY Attendance" value={calcForm.playAttendance} onChange={event => setCalcForm(prev => ({ ...prev, playAttendance: Number(event.target.value) || 0 }))} />
          <input className="input-base text-xs" type="number" placeholder="Voting Form" value={calcForm.votingForm} onChange={event => setCalcForm(prev => ({ ...prev, votingForm: Number(event.target.value) || 0 }))} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button className="btn-primary text-xs" onClick={runCalculator} disabled={saving}>{saving ? 'Calculating...' : 'Run Calculator'}</button>
          {calcResult && (
            <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
              Final: {calcResult.finalScore} (P60 {calcResult.performance60}, P25 {calcResult.participation25}, P15 {calcResult.popularity15}, Penalty {calcResult.penaltyDeduction})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
