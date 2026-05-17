'use client';

import { useEffect, useState } from 'react';

export type PerformanceThresholds = {
  high: number;
  mid: number;
};

const defaultThresholds: PerformanceThresholds = {
  high: 80,
  mid: 50,
};

export function usePerformanceThresholds() {
  const [thresholds, setThresholds] = useState<PerformanceThresholds>(defaultThresholds);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const fetchThresholds = async () => {
      try {
        const res = await fetch('/api/performance-management?mode=thresholds');
        const data = await res.json();

        if (!isActive) return;

        if (data.thresholds) {
          setThresholds(data.thresholds);
        }
      } catch (err) {
        console.error('Fetch thresholds error:', err);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    fetchThresholds();

    return () => {
      isActive = false;
    };
  }, []);

  return { thresholds, setThresholds, isLoading };
}