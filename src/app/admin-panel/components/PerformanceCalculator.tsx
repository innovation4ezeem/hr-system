'use client';
import React, { useState, useMemo } from 'react';
import {
  calculateKPIAttendance,
  calculateKPIDelivery,
  calculateKPIThirdComponent,
  calculateTasksBasedScore,
  calculateQualityScore,
  calculateTotalPerformanceScore,
  getGradeFromScore,
  generatePerformanceRemark,
  type PerformanceScoreBreakdown,
} from '@/models/performanceCalculatorModel';
import Icon from '@/components/ui/AppIcon';

interface CalculatorInputs {
  attendanceDays: number;
  workingDays: number;
  completedDeliverables: number;
  plannedDeliverables: number;
  overdueItems: number;
  defects: number;
  totalOutput: number;
  achievedTasks: number;
  totalTasks: number;
  errors: number;
}

const defaultInputs: CalculatorInputs = {
  attendanceDays: 20,
  workingDays: 22,
  completedDeliverables: 8,
  plannedDeliverables: 10,
  overdueItems: 1,
  defects: 2,
  totalOutput: 50,
  achievedTasks: 15,
  totalTasks: 20,
  errors: 1,
};

export default function PerformanceCalculator() {
  const [inputs, setInputs] = useState<CalculatorInputs>(defaultInputs);

  const breakdown = useMemo<PerformanceScoreBreakdown>(() => {
    const kpiAttendance = calculateKPIAttendance(inputs.attendanceDays, inputs.workingDays);
    const kpiDelivery = calculateKPIDelivery(inputs.completedDeliverables, inputs.plannedDeliverables, inputs.overdueItems);
    const kpiQuality = calculateKPIThirdComponent(inputs.defects, inputs.totalOutput);
    const kpiScore = kpiAttendance + kpiDelivery + kpiQuality;
    const tasksBasedScore = calculateTasksBasedScore(inputs.achievedTasks, inputs.totalTasks);
    const qualityScore = calculateQualityScore(inputs.totalTasks, inputs.errors);
    const totalScore = calculateTotalPerformanceScore({ kpiScore, tasksBasedScore, qualityScore });

    return {
      kpiScore,
      kpiAttendance,
      kpiDelivery,
      kpiQuality,
      tasksBasedScore,
      qualityScore,
      totalScore,
    };
  }, [inputs]);

  const grade = getGradeFromScore(breakdown.totalScore);
  const remark = generatePerformanceRemark(breakdown.totalScore, grade);

  const handleInputChange = (field: keyof CalculatorInputs, value: number) => {
    setInputs(prev => ({ ...prev, [field]: Math.max(0, value) }));
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
      {/* Header */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
        <h2 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Performance Score Calculator</h2>
        <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
          Formula: KPI (60) + Tasks Based (25) + Quality (15) = Total (100)
        </p>
      </div>

      <div className="p-5 space-y-6">
        {/* KPI Section (0-60) */}
        <div className="rounded-lg p-4" style={{ background: 'rgba(79, 127, 255, 0.08)', border: '1px solid rgba(79, 127, 255, 0.2)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'rgb(79 127 255)' }}>KPI Score (0-60 points)</h3>

          {/* Attendance (0-20) */}
          <div className="mb-4 pb-4 border-b" style={{ borderColor: 'rgba(79, 127, 255, 0.1)' }}>
            <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-secondary))' }}>Attendance (0-20)</label>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <input
                type="number"
                placeholder="Attendance Days"
                className="input-base text-sm"
                value={inputs.attendanceDays}
                onChange={(e) => handleInputChange('attendanceDays', Number(e.target.value))}
              />
              <input
                type="number"
                placeholder="Working Days"
                className="input-base text-sm"
                value={inputs.workingDays}
                onChange={(e) => handleInputChange('workingDays', Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Score: {breakdown.kpiAttendance.toFixed(2)} / 20</span>
              <div className="w-24 h-2 rounded-full" style={{ background: 'rgba(79, 127, 255, 0.2)' }}>
                <div className="h-full rounded-full" style={{ width: `${(breakdown.kpiAttendance / 20) * 100}%`, background: 'rgb(79 127 255)' }} />
              </div>
            </div>
          </div>

          {/* Delivery (0-20) */}
          <div className="mb-4 pb-4 border-b" style={{ borderColor: 'rgba(79, 127, 255, 0.1)' }}>
            <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-secondary))' }}>Delivery (0-20)</label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input
                type="number"
                placeholder="Completed"
                className="input-base text-sm"
                value={inputs.completedDeliverables}
                onChange={(e) => handleInputChange('completedDeliverables', Number(e.target.value))}
              />
              <input
                type="number"
                placeholder="Planned"
                className="input-base text-sm"
                value={inputs.plannedDeliverables}
                onChange={(e) => handleInputChange('plannedDeliverables', Number(e.target.value))}
              />
              <input
                type="number"
                placeholder="Overdue"
                className="input-base text-sm"
                value={inputs.overdueItems}
                onChange={(e) => handleInputChange('overdueItems', Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Score: {breakdown.kpiDelivery.toFixed(2)} / 20</span>
              <div className="w-24 h-2 rounded-full" style={{ background: 'rgba(79, 127, 255, 0.2)' }}>
                <div className="h-full rounded-full" style={{ width: `${(breakdown.kpiDelivery / 20) * 100}%`, background: 'rgb(79 127 255)' }} />
              </div>
            </div>
          </div>

          {/* Quality (0-20) */}
          <div className="mb-3">
            <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-secondary))' }}>Quality (0-20)</label>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <input
                type="number"
                placeholder="Defects"
                className="input-base text-sm"
                value={inputs.defects}
                onChange={(e) => handleInputChange('defects', Number(e.target.value))}
              />
              <input
                type="number"
                placeholder="Total Output"
                className="input-base text-sm"
                value={inputs.totalOutput}
                onChange={(e) => handleInputChange('totalOutput', Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Score: {breakdown.kpiQuality.toFixed(2)} / 20</span>
              <div className="w-24 h-2 rounded-full" style={{ background: 'rgba(79, 127, 255, 0.2)' }}>
                <div className="h-full rounded-full" style={{ width: `${(breakdown.kpiQuality / 20) * 100}%`, background: 'rgb(79 127 255)' }} />
              </div>
            </div>
          </div>

          {/* KPI Total */}
          <div className="mt-4 pt-4 border-t-2" style={{ borderColor: 'rgba(79, 127, 255, 0.3)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: 'rgb(79 127 255)' }}>KPI Total</span>
              <span className="text-lg font-bold" style={{ color: 'rgb(79 127 255)' }}>{breakdown.kpiScore.toFixed(2)} / 60</span>
            </div>
          </div>
        </div>

        {/* Tasks Based (0-25) */}
        <div className="rounded-lg p-4" style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
          <label className="text-sm font-semibold mb-3 block" style={{ color: 'rgb(52 211 153)' }}>Tasks Based (0-25 points)</label>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="number"
              placeholder="Achieved Tasks"
              className="input-base text-sm"
              value={inputs.achievedTasks}
              onChange={(e) => handleInputChange('achievedTasks', Number(e.target.value))}
            />
            <input
              type="number"
              placeholder="Total Tasks"
              className="input-base text-sm"
              value={inputs.totalTasks}
              onChange={(e) => handleInputChange('totalTasks', Number(e.target.value))}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Score: {breakdown.tasksBasedScore.toFixed(2)} / 25</span>
            <div className="w-32 h-2 rounded-full" style={{ background: 'rgba(52, 211, 153, 0.2)' }}>
              <div className="h-full rounded-full" style={{ width: `${(breakdown.tasksBasedScore / 25) * 100}%`, background: 'rgb(52 211 153)' }} />
            </div>
          </div>
        </div>

        {/* Quality Score (0-15) */}
        <div className="rounded-lg p-4" style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
          <label className="text-sm font-semibold mb-3 block" style={{ color: 'rgb(248 113 113)' }}>Quality Score (0-15 points)</label>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <input
                type="number"
                placeholder="Total Tasks"
                className="input-base text-sm"
                value={inputs.totalTasks}
                onChange={(e) => handleInputChange('totalTasks', Number(e.target.value))}
              />
            </div>
            <div>
              <input
                type="number"
                placeholder="Errors"
                className="input-base text-sm"
                value={inputs.errors}
                onChange={(e) => handleInputChange('errors', Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Score: {breakdown.qualityScore.toFixed(2)} / 15</span>
            <div className="w-32 h-2 rounded-full" style={{ background: 'rgba(248, 113, 113, 0.2)' }}>
              <div className="h-full rounded-full" style={{ width: `${(breakdown.qualityScore / 15) * 100}%`, background: 'rgb(248 113 113)' }} />
            </div>
          </div>
        </div>

        {/* Total Score */}
        <div className="rounded-lg p-5" style={{ background: 'rgba(167, 139, 250, 0.08)', border: '2px solid rgba(167, 139, 250, 0.3)' }}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold" style={{ color: 'rgb(167 139 250)' }}>{breakdown.totalScore.toFixed(0)}</p>
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>Total Score</p>
            </div>
            <div>
              <p className="text-3xl font-bold" style={{ color: 'rgb(167 139 250)' }}>{grade}</p>
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>Grade</p>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>{((breakdown.totalScore / 100) * 100).toFixed(0)}%</p>
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>Percentage</p>
            </div>
          </div>
          <p className="text-xs mt-4 p-3 rounded-lg" style={{ background: 'rgba(167, 139, 250, 0.1)', color: 'rgb(var(--text-secondary))' }}>
            <span className="font-semibold">Remark:</span> {remark}
          </p>
        </div>
      </div>
    </div>
  );
}
