'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

type EmployeeLite = {
  id: string;
  name: string;
  dept: string;
  role: 'admin' | 'hod' | 'employee';
};

type PerformanceEntry = { year: number; score: number; grade: string };
type CareerEntry = { year: string; title: string; dept: string; duration: string };
type RewardEntry = { year: string; title: string; description: string };

type ProfileRecords = {
  performanceHistory: PerformanceEntry[];
  careerHistory: CareerEntry[];
  rewards: RewardEntry[];
};

const seedRecords = (employee: EmployeeLite): ProfileRecords => {
  const currentYear = new Date().getFullYear();
  return {
    performanceHistory: [
      { year: currentYear, score: 88, grade: 'A' },
      { year: currentYear - 1, score: 84, grade: 'A-' },
    ],
    careerHistory: [
      { year: `${currentYear - 2} - Present`, title: employee.role === 'hod' ? 'Manager' : 'Executive', dept: employee.dept, duration: '2y' },
    ],
    rewards: [
      { year: String(currentYear - 1), title: 'Top Contributor', description: `Recognized in ${employee.dept} for consistent delivery.` },
    ],
  };
};

export default function AdminEmployeeRecordsPanel({ employees }: { employees: EmployeeLite[] }) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employees[0]?.id || '');
  const [recordsByEmployee, setRecordsByEmployee] = useState<Record<string, ProfileRecords>>(() => {
    const map: Record<string, ProfileRecords> = {};
    employees.forEach(e => {
      map[e.id] = seedRecords(e);
    });
    return map;
  });

  const selectedEmployee = useMemo(
    () => employees.find(e => e.id === selectedEmployeeId),
    [employees, selectedEmployeeId],
  );

  const selectedRecords = useMemo(() => {
    if (!selectedEmployeeId) return { performanceHistory: [], careerHistory: [], rewards: [] };
    return recordsByEmployee[selectedEmployeeId] ?? { performanceHistory: [], careerHistory: [], rewards: [] };
  }, [recordsByEmployee, selectedEmployeeId]);

  const updateRecords = (updater: (prev: ProfileRecords) => ProfileRecords) => {
    if (!selectedEmployeeId) return;
    setRecordsByEmployee(prev => ({
      ...prev,
      [selectedEmployeeId]: updater(prev[selectedEmployeeId]),
    }));
  };

  const addPerformance = () => {
    updateRecords(prev => ({
      ...prev,
      performanceHistory: [...prev.performanceHistory, { year: new Date().getFullYear(), score: 0, grade: 'N/A' }],
    }));
    toast.success('Performance history row added');
  };

  const addCareer = () => {
    updateRecords(prev => ({
      ...prev,
      careerHistory: [...prev.careerHistory, { year: `${new Date().getFullYear()} - Present`, title: 'New Role', dept: selectedEmployee?.dept || 'Operations', duration: '0y' }],
    }));
    toast.success('Career history row added');
  };

  const addReward = () => {
    updateRecords(prev => ({
      ...prev,
      rewards: [...prev.rewards, { year: String(new Date().getFullYear()), title: 'New Reward', description: 'Describe achievement...' }],
    }));
    toast.success('Reward row added');
  };

  if (employees.length === 0) return null;

  return (
    <div className="space-y-4 rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Employee Profile Records (Admin CRUD)</h4>
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Manage performance history, career history and rewards.</p>
        </div>
        <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="input-base text-xs" style={{ width: 260 }}>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.name} - {e.dept}</option>
          ))}
        </select>
      </div>

      {selectedEmployee && (
        <div className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
          Selected: <span style={{ color: 'rgb(var(--text-primary))' }}>{selectedEmployee.name}</span> ({selectedEmployee.id})
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-lg p-3" style={{ border: '1px solid rgb(var(--border))', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold" style={{ color: 'rgb(79 127 255)' }}>Performance History</p>
            <button className="btn-ghost text-xs" onClick={addPerformance}><Icon name="PlusIcon" size={12} /> Add</button>
          </div>
          <div className="space-y-2">
            {selectedRecords.performanceHistory.map((row, idx) => (
              <div key={`ph-${idx}`} className="grid grid-cols-3 gap-2 items-center">
                <input type="number" className="input-base text-xs" value={row.year}
                  onChange={e => updateRecords(prev => ({ ...prev, performanceHistory: prev.performanceHistory.map((x, i) => i === idx ? { ...x, year: Number(e.target.value) } : x) }))} />
                <input type="number" className="input-base text-xs" value={row.score}
                  onChange={e => updateRecords(prev => ({ ...prev, performanceHistory: prev.performanceHistory.map((x, i) => i === idx ? { ...x, score: Number(e.target.value) } : x) }))} />
                <div className="flex gap-1">
                  <input className="input-base text-xs" value={row.grade}
                    onChange={e => updateRecords(prev => ({ ...prev, performanceHistory: prev.performanceHistory.map((x, i) => i === idx ? { ...x, grade: e.target.value } : x) }))} />
                  <button className="p-1 rounded hover:bg-red-400/10" style={{ color: 'rgb(248 113 113)' }}
                    onClick={() => updateRecords(prev => ({ ...prev, performanceHistory: prev.performanceHistory.filter((_, i) => i !== idx) }))}>
                    <Icon name="TrashIcon" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg p-3" style={{ border: '1px solid rgb(var(--border))', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold" style={{ color: 'rgb(167 139 250)' }}>Career History</p>
            <button className="btn-ghost text-xs" onClick={addCareer}><Icon name="PlusIcon" size={12} /> Add</button>
          </div>
          <div className="space-y-2">
            {selectedRecords.careerHistory.map((row, idx) => (
              <div key={`ch-${idx}`} className="space-y-1">
                <input className="input-base text-xs" value={row.year} onChange={e => updateRecords(prev => ({ ...prev, careerHistory: prev.careerHistory.map((x, i) => i === idx ? { ...x, year: e.target.value } : x) }))} />
                <input className="input-base text-xs" value={row.title} onChange={e => updateRecords(prev => ({ ...prev, careerHistory: prev.careerHistory.map((x, i) => i === idx ? { ...x, title: e.target.value } : x) }))} />
                <div className="grid grid-cols-[1fr_1fr_auto] gap-1">
                  <input className="input-base text-xs" value={row.dept} onChange={e => updateRecords(prev => ({ ...prev, careerHistory: prev.careerHistory.map((x, i) => i === idx ? { ...x, dept: e.target.value } : x) }))} />
                  <input className="input-base text-xs" value={row.duration} onChange={e => updateRecords(prev => ({ ...prev, careerHistory: prev.careerHistory.map((x, i) => i === idx ? { ...x, duration: e.target.value } : x) }))} />
                  <button className="p-1 rounded hover:bg-red-400/10" style={{ color: 'rgb(248 113 113)' }}
                    onClick={() => updateRecords(prev => ({ ...prev, careerHistory: prev.careerHistory.filter((_, i) => i !== idx) }))}>
                    <Icon name="TrashIcon" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg p-3" style={{ border: '1px solid rgb(var(--border))', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold" style={{ color: 'rgb(251 191 36)' }}>Rewards</p>
            <button className="btn-ghost text-xs" onClick={addReward}><Icon name="PlusIcon" size={12} /> Add</button>
          </div>
          <div className="space-y-2">
            {selectedRecords.rewards.map((row, idx) => (
              <div key={`rw-${idx}`} className="space-y-1">
                <div className="grid grid-cols-[80px_1fr_auto] gap-1">
                  <input className="input-base text-xs" value={row.year} onChange={e => updateRecords(prev => ({ ...prev, rewards: prev.rewards.map((x, i) => i === idx ? { ...x, year: e.target.value } : x) }))} />
                  <input className="input-base text-xs" value={row.title} onChange={e => updateRecords(prev => ({ ...prev, rewards: prev.rewards.map((x, i) => i === idx ? { ...x, title: e.target.value } : x) }))} />
                  <button className="p-1 rounded hover:bg-red-400/10" style={{ color: 'rgb(248 113 113)' }}
                    onClick={() => updateRecords(prev => ({ ...prev, rewards: prev.rewards.filter((_, i) => i !== idx) }))}>
                    <Icon name="TrashIcon" size={12} />
                  </button>
                </div>
                <input className="input-base text-xs" value={row.description} onChange={e => updateRecords(prev => ({ ...prev, rewards: prev.rewards.map((x, i) => i === idx ? { ...x, description: e.target.value } : x) }))} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
