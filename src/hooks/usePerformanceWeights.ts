'use client';

import { useEffect, useState } from 'react';

export type PerformanceWeights = {
  performanceWeight: number;
  competencyWeight: number;
  attitudeWeight: number;
  kpiWithinPerformanceWeight: number;
  taskWithinPerformanceWeight: number;
  qualityWithinPerformanceWeight: number;
};

export type PerformanceFormula = {
  name: string;
  expression: string;
};

export type ScoringCategory = {
  id: string;
  name: string;
  weight: number;
  description: string;
  color: string;
  order: number;
};

const defaultWeights: PerformanceWeights = {
  performanceWeight: 60,
  competencyWeight: 25,
  attitudeWeight: 15,
  kpiWithinPerformanceWeight: 50,
  taskWithinPerformanceWeight: 25,
  qualityWithinPerformanceWeight: 25,
};

const defaultFormula: PerformanceFormula = {
  name: 'Scoring Formula',
  expression: 'Total Score = Performance (KPI 50% + Tasks 25% + Quality 25%) × 0.6 + Participation × 0.25 + Popularity × 0.15.',
};

const defaultCategories: ScoringCategory[] = [
  { id: 'sc-001', name: 'KPI Achievement', weight: 40, description: 'Measured against set KPI targets', color: 'rgb(79 127 255)', order: 1 },
  { id: 'sc-002', name: 'Task Completion Rate', weight: 25, description: 'Percentage of tasks completed on time', color: 'rgb(52 211 153)', order: 2 },
  { id: 'sc-003', name: 'Quality of Work', weight: 20, description: 'Accuracy and quality assessment by HOD', color: 'rgb(167 139 250)', order: 3 },
  { id: 'sc-004', name: 'Attendance & Punctuality', weight: 10, description: 'Attendance record and punctuality score', color: 'rgb(251 191 36)', order: 4 },
  { id: 'sc-005', name: 'Behavioural Compliance', weight: 5, description: 'Adherence to company policies and conduct', color: 'rgb(248 113 113)', order: 5 },
];

export function usePerformanceWeights(year?: number) {
  const [weights, setWeights] = useState<PerformanceWeights>(defaultWeights);
  const [formula, setFormula] = useState<PerformanceFormula>(defaultFormula);
  const [categories, setCategories] = useState<ScoringCategory[]>(defaultCategories);
  const [isLoading, setIsLoading] = useState(true);
  const currentYear = year || new Date().getFullYear();

  useEffect(() => {
    let isActive = true;

    const fetchData = async () => {
      try {
        const [weightsRes, categoriesRes] = await Promise.all([
          fetch('/api/system-settings?mode=weights'),
          fetch(`/api/scoring-categories?year=${currentYear}`),
        ]);

        const weightsData = await weightsRes.json();
        const categoriesData = await categoriesRes.json();

        if (!isActive) return;

        if (weightsData.weights) {
          setWeights(weightsData.weights);
        }
        if (weightsData.formulaName) {
          setFormula({
            name: String(weightsData.formulaName),
            expression: String(weightsData.formulaExpression || defaultFormula.expression),
          });
        }
        if (Array.isArray(categoriesData.categories)) {
          setCategories(categoriesData.categories);
        }
      } catch (err) {
        console.error('Fetch performance data error:', err);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isActive = false;
    };
  }, [currentYear]);

  const saveWeights = async (newWeights: PerformanceWeights, newFormulaName?: string, newFormulaExpression?: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/system-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-weights',
          weights: newWeights,
          formulaName: newFormulaName ?? formula.name,
          formulaExpression: newFormulaExpression ?? formula.expression,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.weights) {
          setWeights(data.weights);
          if (data.formulaName || data.formulaExpression) {
            setFormula({
              name: String(data.formulaName || formula.name),
              expression: String(data.formulaExpression || formula.expression),
            });
          }
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Save performance weights error:', err);
      return false;
    }
  };

  const saveCategories = async (newCategories: ScoringCategory[]): Promise<boolean> => {
    try {
      const res = await fetch('/api/scoring-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: currentYear, categories: newCategories }),
      });

      if (res.ok) {
        setCategories(newCategories);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Save categories error:', err);
      return false;
    }
  };

  return { weights, setWeights, formula, setFormula, categories, setCategories, isLoading, saveWeights, saveCategories };
}

export function generateFormulaString(weights: PerformanceWeights): string {
  const perf = weights.performanceWeight;
  const comp = weights.competencyWeight;
  const att = weights.attitudeWeight;
  const kpi = weights.kpiWithinPerformanceWeight;
  const task = weights.taskWithinPerformanceWeight;
  const quality = weights.qualityWithinPerformanceWeight;

  return `Total Score = Performance (KPI ${kpi}% + Tasks ${task}% + Quality ${quality}%) × ${perf / 100} + Participation × ${comp / 100} + Popularity × ${att / 100}.`;
}

function toPercent(value: string) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed);
}

export function parseFormulaExpression(expression: string): Partial<PerformanceWeights> {
  const normalized = expression.replace(/\s+/g, ' ').trim();

  const performanceMatch = normalized.match(/Performance\s*\(\s*KPI\s*([\d.]+)%\s*\+\s*Tasks\s*([\d.]+)%\s*\+\s*Quality\s*([\d.]+)%\s*\)\s*[×x*]\s*([\d.]+)/i);
  const participationMatch = normalized.match(/Participation\s*[×x*]\s*([\d.]+)/i);
  const popularityMatch = normalized.match(/Popularity\s*[×x*]\s*([\d.]+)/i);

  const nextWeights: Partial<PerformanceWeights> = {};

  if (performanceMatch) {
    nextWeights.kpiWithinPerformanceWeight = toPercent(performanceMatch[1]) ?? 0;
    nextWeights.taskWithinPerformanceWeight = toPercent(performanceMatch[2]) ?? 0;
    nextWeights.qualityWithinPerformanceWeight = toPercent(performanceMatch[3]) ?? 0;
    nextWeights.performanceWeight = toPercent(performanceMatch[4]) ?? 0;
  }

  if (participationMatch) {
    nextWeights.competencyWeight = toPercent(participationMatch[1]) ?? 0;
  }

  if (popularityMatch) {
    nextWeights.attitudeWeight = toPercent(popularityMatch[1]) ?? 0;
  }

  return nextWeights;
}
