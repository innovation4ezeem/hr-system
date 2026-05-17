'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import InlineEditableField from '@/components/ui/InlineEditableField';
import { PERFORMANCE_MONTHS, getPerformanceSections, sectionsToCellMap } from '@/data/performanceScores';
import ActivitiesCrudPanel from './ActivitiesCrudPanel';
import { useAppContext } from '@/context/AppContext';

type EmployeeOption = {
  id: string;
  name: string;
};

type SheetRow = {
  label: string;
};

type SheetSection = {
  title: string;
  rows: SheetRow[];
};

type MasterboardMode = 'ranking' | 'bar' | 'gantt' | 'pie' | 'filter' | 'activities';
type SortDirection = 'desc' | 'asc';

type SheetState = {
  columns: string[];
  sections: SheetSection[];
  cellsByEmployee: Record<string, Record<string, number>>;
  selectedView: string;
  masterboardMode: MasterboardMode;
  masterboardQuery: string;
  masterboardMinScore: number;
  masterboardSort: SortDirection;
};

type EmployeeScore = EmployeeOption & {
  h1: number;
  h2: number;
  total: number;
  average: number;
};

const INITIAL_COLUMNS = [...PERFORMANCE_MONTHS];

const cloneSheet = (sheet: SheetState): SheetState => ({
  columns: [...sheet.columns],
  sections: sheet.sections.map(section => ({
    title: section.title,
    rows: section.rows.map(row => ({ label: row.label })),
  })),
  cellsByEmployee: Object.fromEntries(
    Object.entries(sheet.cellsByEmployee).map(([employeeId, cells]) => [employeeId, { ...cells }]),
  ),
  selectedView: sheet.selectedView,
  masterboardMode: 'activities',
  masterboardQuery: sheet.masterboardQuery,
  masterboardMinScore: sheet.masterboardMinScore,
  masterboardSort: sheet.masterboardSort,
});

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

const nextUniqueLabel = (prefix: string, existing: string[]) => {
  let index = 1;
  let candidate = `${prefix} ${index}`;
  while (existing.includes(candidate)) {
    index += 1;
    candidate = `${prefix} ${index}`;
  }
  return candidate;
};

const buildInitialSections = (): SheetSection[] => {
  return getPerformanceSections('u-001').map(section => ({
    title: section.title,
    rows: section.rows.map(row => ({ label: row.label })),
  }));
};

const buildInitialCells = (employeeOptions: EmployeeOption[], sections: SheetSection[], columns: string[]) => {
  return employeeOptions.reduce((acc, employee) => {
    const sourceMap = sectionsToCellMap(getPerformanceSections(employee.id));
    acc[employee.id] = {};
    sections.forEach(section => {
      section.rows.forEach(row => {
        columns.forEach((column, columnIndex) => {
          const monthName = PERFORMANCE_MONTHS[columnIndex];
          acc[employee.id][`${row.label}::${column}`] = monthName ? sourceMap[`${row.label}::${monthName}`] || 0 : 0;
        });
      });
    });
    return acc;
  }, {} as Record<string, Record<string, number>>);
};

const renameCellKeys = (
  cellsByEmployee: Record<string, Record<string, number>>,
  oldPrefix: string,
  newPrefix: string,
) => {
  const next: Record<string, Record<string, number>> = {};
  Object.entries(cellsByEmployee).forEach(([employeeId, cells]) => {
    const nextCells: Record<string, number> = {};
    Object.entries(cells).forEach(([key, value]) => {
      if (key.startsWith(oldPrefix)) {
        nextCells[key.replace(oldPrefix, newPrefix)] = value;
      } else {
        nextCells[key] = value;
      }
    });
    next[employeeId] = nextCells;
  });
  return next;
};

const deleteCellKeys = (
  cellsByEmployee: Record<string, Record<string, number>>,
  matchPrefix: string,
) => {
  const next: Record<string, Record<string, number>> = {};
  Object.entries(cellsByEmployee).forEach(([employeeId, cells]) => {
    const nextCells: Record<string, number> = {};
    Object.entries(cells).forEach(([key, value]) => {
      if (!key.startsWith(matchPrefix)) nextCells[key] = value;
    });
    next[employeeId] = nextCells;
  });
  return next;
};

const addRowDefaults = (
  cellsByEmployee: Record<string, Record<string, number>>,
  columns: string[],
  rowLabel: string,
) => {
  const next: Record<string, Record<string, number>> = {};
  Object.entries(cellsByEmployee).forEach(([employeeId, cells]) => {
    const nextCells = { ...cells };
    columns.forEach(column => {
      nextCells[`${rowLabel}::${column}`] = 0;
    });
    next[employeeId] = nextCells;
  });
  return next;
};

const addColumnDefaults = (
  cellsByEmployee: Record<string, Record<string, number>>,
  sections: SheetSection[],
  column: string,
) => {
  const next: Record<string, Record<string, number>> = {};
  Object.entries(cellsByEmployee).forEach(([employeeId, cells]) => {
    const nextCells = { ...cells };
    sections.forEach(section => {
      section.rows.forEach(row => {
        nextCells[`${row.label}::${column}`] = 0;
      });
    });
    next[employeeId] = nextCells;
  });
  return next;
};

const computeEmployeeScores = (
  sheet: SheetState,
  employeeOptions: EmployeeOption[],
): EmployeeScore[] => {
  const halfIndex = Math.ceil(sheet.columns.length / 2);
  const actualEmployees = employeeOptions.filter(emp => emp.id !== 'masterboard');

  const scores = actualEmployees.map(employee => {
    const employeeCells = sheet.cellsByEmployee[employee.id] || {};
    const columnTotals = sheet.columns.map(column => {
      return sheet.sections.reduce((sectionSum, section) => {
        return sectionSum + section.rows.reduce((rowSum, row) => rowSum + (employeeCells[`${row.label}::${column}`] || 0), 0);
      }, 0);
    });

    return {
      ...employee,
      h1: sum(columnTotals.slice(0, halfIndex)),
      h2: sum(columnTotals.slice(halfIndex)),
      total: sum(columnTotals),
      average: sheet.columns.length === 0 ? 0 : Number((sum(columnTotals) / sheet.columns.length).toFixed(1)),
    };
  });

  const filtered = scores.filter(score => {
    const query = sheet.masterboardQuery.trim().toLowerCase();
    if (!query) return true;
    return score.name.toLowerCase().includes(query) || String(score.total).includes(query);
  });

  const thresholdFiltered = filtered.filter(score => score.total >= sheet.masterboardMinScore);
  const sorted = [...thresholdFiltered].sort((a, b) =>
    sheet.masterboardSort === 'desc' ? b.total - a.total : a.total - b.total,
  );

  return sorted.map((score, index) => ({ ...score, total: score.total, h1: score.h1, h2: score.h2, average: score.average }));
};

function MasterboardBars({ employees }: { employees: EmployeeScore[] }) {
  const max = Math.max(...employees.map(item => item.total), 1);
  return (
    <div className="space-y-3">
      {employees.map((item, index) => (
        <div key={item.id} className="rounded-xl p-3" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>#{index + 1} {item.name}</p>
              <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Jan-Jun {item.h1} | Jul-Dec {item.h2} | Avg {item.average}</p>
            </div>
            <p className="text-sm font-bold font-mono" style={{ color: 'rgb(79 127 255)' }}>{item.total}</p>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full" style={{ width: `${(item.total / max) * 100}%`, background: 'linear-gradient(90deg, rgb(79 127 255), rgb(52 211 153))' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MasterboardGantt({ employees }: { employees: EmployeeScore[] }) {
  const max = Math.max(...employees.map(item => item.total), 1);
  return (
    <div className="space-y-3">
      {employees.map(item => (
        <div key={item.id} className="rounded-xl p-3" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{item.name}</p>
            <p className="text-xs font-mono" style={{ color: 'rgb(var(--text-secondary))' }}>Jan-Jun {item.h1} | Jul-Dec {item.h2}</p>
          </div>
          <div className="flex h-4 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full"
              style={{ width: `${(item.h1 / max) * 100}%`, background: 'rgba(79,127,255,0.85)' }}
              title={`H1 ${item.h1}`}
            />
            <div
              className="h-full"
              style={{ width: `${(item.h2 / max) * 100}%`, background: 'rgba(52,211,153,0.85)' }}
              title={`H2 ${item.h2}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MasterboardPie({ employees }: { employees: EmployeeScore[] }) {
  const total = Math.max(sum(employees.map(item => item.total)), 1);
  const palette = ['rgb(79 127 255)', 'rgb(52 211 153)', 'rgb(251 191 36)', 'rgb(167 139 250)', 'rgb(248 113 113)', 'rgb(34 211 238)'];
  let start = 0;
  const slices = employees.slice(0, 6).map((item, index) => {
    const pct = (item.total / total) * 100;
    const slice = `${palette[index % palette.length]} ${start}% ${start + pct}%`;
    start += pct;
    return slice;
  });
  const gradient = `conic-gradient(${slices.join(', ')})`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
      <div className="rounded-full aspect-square mx-auto w-full max-w-[280px]" style={{ background: gradient, border: '1px solid rgb(var(--border-subtle))' }} />
      <div className="space-y-2">
        {employees.map((item, index) => (
          <div key={item.id} className="rounded-lg px-3 py-2 flex items-center justify-between" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
            <span className="text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{index + 1}. {item.name}</span>
            <span className="text-xs font-mono" style={{ color: 'rgb(var(--text-secondary))' }}>{item.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MasterboardFilter({
  employees,
  query,
  setQuery,
  minScore,
  setMinScore,
}: {
  employees: EmployeeScore[];
  query: string;
  setQuery: (value: string) => void;
  minScore: number;
  setMinScore: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="input-base"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search employee name or score"
        />
        <input
          className="input-base"
          type="number"
          value={minScore}
          onChange={e => setMinScore(Number(e.target.value) || 0)}
          min={0}
          placeholder="Minimum score"
        />
      </div>
      <div className="space-y-2">
        {employees.map((item, index) => (
          <div key={item.id} className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>#{index + 1} {item.name}</p>
              <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Jan-Jun {item.h1} | Jul-Dec {item.h2}</p>
            </div>
            <p className="text-sm font-bold font-mono" style={{ color: 'rgb(79 127 255)' }}>{item.total}</p>
          </div>
        ))}
        {employees.length === 0 && (
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>No employees match the filter.</p>
        )}
      </div>
    </div>
  );
}

export default function PerformanceScoresCrudEditor({
  selectedYear,
  employeeOptions,
  preSelectedUserId,
}: {
  selectedYear: number;
  employeeOptions: EmployeeOption[];
  preSelectedUserId?: string;
}) {
  const initialState = useMemo<SheetState>(() => {
    const sections = buildInitialSections();
    const cellsByEmployee = buildInitialCells(employeeOptions, sections, INITIAL_COLUMNS);
    return {
      columns: [...INITIAL_COLUMNS],
      sections,
      cellsByEmployee,
      selectedView: preSelectedUserId || employeeOptions[0]?.id || 'u-001',
      masterboardMode: 'ranking',
      masterboardQuery: '',
      masterboardMinScore: 0,
      masterboardSort: 'desc',
    };
  }, [employeeOptions, preSelectedUserId]);

  const { userRole, userId, userDepartment, silentMode } = useAppContext();
  const [sheet, setSheet] = useState<SheetState>(initialState);
  const [past, setPast] = useState<SheetState[]>([]);
  const [future, setFuture] = useState<SheetState[]>([]);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'draft' | 'saving'>('saved');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [systemWeights, setSystemWeights] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const authHeaders = useMemo(() => {
    return {
      'x-user-id': userId,
      'x-user-role': userRole,
      'x-user-dept': userDepartment,
      'x-silent-mode': silentMode ? 'true' : 'false'
    };
  }, [userId, userRole, userDepartment, silentMode]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetRef = useRef(sheet);

  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadFromDatabase = async () => {
      setIsBootstrapping(true);
      setLoadError(null);

      try {
        const employees = employeeOptions.map(item => item.id).join(',');
        const [scoresRes, settingsRes] = await Promise.all([
          fetch(`/api/performance-scores?year=${selectedYear}&employees=${encodeURIComponent(employees)}`, { headers: authHeaders }),
          fetch('/api/system-settings?mode=weights', { headers: authHeaders })
        ]);

        if (!scoresRes.ok) {
          const body = await scoresRes.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load performance sheet');
        }

        const payload = await scoresRes.json();
        const settings = await settingsRes.json();
        if (cancelled) return;

        const weights = settings.weights;
        setSystemWeights(weights);

        let sections = Array.isArray(payload?.sections) && payload.sections.length
          ? payload.sections
          : initialState.sections;

        // Apply dynamic labels to default sections if no record found
        if (!payload?.sections && weights) {
          sections = sections.map((s: any) => {
            if (s.title === 'Performance') return { ...s, title: weights.performanceLabel || s.title };
            if (s.title === 'Participation') return { ...s, title: weights.participationLabel || s.title };
            if (s.title === 'Popularity') return { ...s, title: weights.popularityLabel || s.title };
            return s;
          });
        }

        const columns = Array.isArray(payload?.columns) && payload.columns.length
          ? payload.columns
          : initialState.columns;
        const cellsByEmployee = payload?.cellsByEmployee && typeof payload.cellsByEmployee === 'object'
          ? payload.cellsByEmployee
          : initialState.cellsByEmployee;

        setSheet(prev => ({
          ...prev,
          columns,
          sections,
          cellsByEmployee,
        }));
        setPast([]);
        setFuture([]);
        setSaveStatus('saved');
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Failed to load from Database';
        setLoadError(message);
        toast.error('Database load failed, fallback to local defaults');
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    };

    void loadFromDatabase();

    return () => {
      cancelled = true;
    };
  }, [employeeOptions, initialState.cellsByEmployee, initialState.columns, initialState.sections, selectedYear]);

  const persistToDatabase = async (nextSheet: SheetState) => {
    const response = await fetch('/api/performance-scores', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({
        year: selectedYear,
        sheet: {
          columns: nextSheet.columns,
          sections: nextSheet.sections,
          cellsByEmployee: nextSheet.cellsByEmployee,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to save performance sheet');
    }
  };

  const triggerAutoSave = () => {
    setSaveStatus('draft');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await persistToDatabase(sheetRef.current);
        setSaveStatus('saved');
        // Trigger a fresh sync to ensure heatmap and other components are updated
        await handleSync();
      } catch {
        setSaveStatus('draft');
        toast.error('Auto-save failed. Check database connection.');
      }
    }, 900);
  };

  const commit = (next: SheetState) => {
    setPast(prev => [...prev, cloneSheet(sheetRef.current)]);
    setFuture([]);
    setSheet(next);
    triggerAutoSave();
  };

  const undo = () => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setPast(prev => prev.slice(0, -1));
    setFuture(prev => [cloneSheet(sheetRef.current), ...prev]);
    setSheet(cloneSheet(previous));
    setSaveStatus('draft');
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setFuture(prev => prev.slice(1));
    setPast(prev => [...prev, cloneSheet(sheetRef.current)]);
    setSheet(cloneSheet(next));
    setSaveStatus('draft');
  };

  const activeEmployeeId = sheet.selectedView || (employeeOptions[0]?.id || 'u-001');
  const isMasterboardSelected = sheet.selectedView === 'masterboard';

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(`/api/performance-scores?year=${selectedYear}&sync=1`, { headers: authHeaders });
      if (!response.ok) throw new Error('Sync failed');
      const data = await response.json();

      setSheet(prev => ({
        ...prev,
        columns: data.columns || prev.columns,
        sections: data.sections || prev.sections,
        cellsByEmployee: data.cellsByEmployee || prev.cellsByEmployee,
      }));

      toast.success('Synced successfully from activity records');
    } catch (error) {
      toast.error('Failed to sync from activities');
    } finally {
      setIsSyncing(false);
    }
  };
  const activeCells = sheet.cellsByEmployee[activeEmployeeId] || {};
  const allRowLabels = sheet.sections.flatMap(section => section.rows.map(row => row.label));
  const allSectionTitles = sheet.sections.map(section => section.title);
  const employeeScores = useMemo(() => computeEmployeeScores(sheet, employeeOptions), [employeeOptions, sheet]);
  const updateSheet = (updater: (draft: SheetState) => SheetState) => {
    const next = updater(cloneSheet(sheetRef.current));
    commit(next);
  };

  const addSection = () => {
    const title = nextUniqueLabel('Section', allSectionTitles);
    const rowLabel = nextUniqueLabel('New Row', allRowLabels);
    updateSheet(draft => ({
      ...draft,
      sections: [...draft.sections, { title, rows: [{ label: rowLabel }] }],
      cellsByEmployee: addRowDefaults(draft.cellsByEmployee, draft.columns, rowLabel),
    }));
    toast.success('Section added');
  };

  const renameSection = (oldTitle: string, nextTitle: string) => {
    const trimmed = nextTitle.trim();
    if (!trimmed || trimmed === oldTitle) return;
    if (allSectionTitles.includes(trimmed)) {
      toast.error('Section name already exists');
      return;
    }
    updateSheet(draft => ({
      ...draft,
      sections: draft.sections.map(section => (section.title === oldTitle ? { ...section, title: trimmed } : section)),
    }));
  };

  const deleteSection = (title: string) => {
    const section = sheet.sections.find(item => item.title === title);
    if (!section) return;
    updateSheet(draft => {
      const nextCells: Record<string, Record<string, number>> = {};
      Object.entries(draft.cellsByEmployee).forEach(([employeeId, cells]) => {
        const filteredCells: Record<string, number> = {};
        Object.entries(cells).forEach(([key, value]) => {
          const rowLabel = key.split('::')[0];
          if (!section.rows.some(row => row.label === rowLabel)) filteredCells[key] = value;
        });
        nextCells[employeeId] = filteredCells;
      });
      return {
        ...draft,
        sections: draft.sections.filter(item => item.title !== title),
        cellsByEmployee: nextCells,
      };
    });
    toast.success('Section deleted');
  };

  const addRow = (sectionTitle: string) => {
    const rowLabel = nextUniqueLabel('New Row', allRowLabels);
    updateSheet(draft => ({
      ...draft,
      sections: draft.sections.map(section => (
        section.title === sectionTitle ? { ...section, rows: [...section.rows, { label: rowLabel }] } : section
      )),
      cellsByEmployee: addRowDefaults(draft.cellsByEmployee, draft.columns, rowLabel),
    }));
    toast.success('Row added');
  };

  const renameRow = (oldLabel: string, nextLabel: string) => {
    const trimmed = nextLabel.trim();
    if (!trimmed || trimmed === oldLabel) return;
    if (allRowLabels.includes(trimmed)) {
      toast.error('Row name already exists');
      return;
    }
    updateSheet(draft => ({
      ...draft,
      sections: draft.sections.map(section => ({
        ...section,
        rows: section.rows.map(row => (row.label === oldLabel ? { label: trimmed } : row)),
      })),
      cellsByEmployee: renameCellKeys(draft.cellsByEmployee, `${oldLabel}::`, `${trimmed}::`),
    }));
  };

  const deleteRow = (rowLabel: string) => {
    updateSheet(draft => ({
      ...draft,
      sections: draft.sections.map(section => ({
        ...section,
        rows: section.rows.filter(row => row.label !== rowLabel),
      })).filter(section => section.rows.length > 0),
      cellsByEmployee: deleteCellKeys(draft.cellsByEmployee, `${rowLabel}::`),
    }));
    toast.success('Row deleted');
  };

  const addColumn = () => {
    const column = nextUniqueLabel('Column', sheet.columns);
    updateSheet(draft => ({
      ...draft,
      columns: [...draft.columns, column],
      cellsByEmployee: addColumnDefaults(draft.cellsByEmployee, draft.sections, column),
    }));
    toast.success('Column added');
  };

  const renameColumn = (oldColumn: string, nextColumn: string) => {
    const trimmed = nextColumn.trim();
    if (!trimmed || trimmed === oldColumn) return;
    if (sheet.columns.includes(trimmed)) {
      toast.error('Column name already exists');
      return;
    }
    updateSheet(draft => ({
      ...draft,
      columns: draft.columns.map(column => (column === oldColumn ? trimmed : column)),
      cellsByEmployee: renameCellKeys(draft.cellsByEmployee, `::${oldColumn}`, `::${trimmed}`),
    }));
  };

  const deleteColumn = (column: string) => {
    updateSheet(draft => ({
      ...draft,
      columns: draft.columns.filter(item => item !== column),
      cellsByEmployee: deleteCellKeys(draft.cellsByEmployee, `::${column}`),
    }));
    toast.success('Column deleted');
  };

  const setCellValue = (rowLabel: string, column: string, raw: string) => {
    if (isMasterboardSelected) return;
    const next = raw.trim() === '' ? 0 : Number(raw);
    if (Number.isNaN(next)) return;
    updateSheet(draft => ({
      ...draft,
      cellsByEmployee: {
        ...draft.cellsByEmployee,
        [activeEmployeeId]: {
          ...(draft.cellsByEmployee[activeEmployeeId] || {}),
          [`${rowLabel}::${column}`]: Math.max(0, next),
        },
      },
    }));
  };

  const handleAsyncSave = async (fn: () => void) => {
    fn();
    // Since triggerAutoSave is debounced, we resolve immediately to satisfy InlineEditableField
    // The parent's saveStatus indicator will handle the global saving state.
    return Promise.resolve();
  };


  const cellColumnTotal = (column: string) => {
    return sheet.sections.reduce((sectionSum, section) => {
      return sectionSum + section.rows.reduce((rowSum, row) => rowSum + (activeCells[`${row.label}::${column}`] || 0), 0);
    }, 0);
  };

  const cellSectionTotal = (section: SheetSection) => {
    return sum(sheet.columns.map(column => section.rows.reduce((rowSum, row) => rowSum + (activeCells[`${row.label}::${column}`] || 0), 0)));
  };

  const sectionColumnTotal = (section: SheetSection, column: string) => {
    return section.rows.reduce((rowSum, row) => rowSum + (activeCells[`${row.label}::${column}`] || 0), 0);
  };

  const grandTotal = sum(sheet.columns.map(column => cellColumnTotal(column)));

  const renderMasterboard = () => {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-500">
        <ActivitiesCrudPanel
          embedded
          showFilters
          showAddButton
          year={selectedYear}
          onMutation={handleSync}
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.08)', color: 'rgb(var(--text-secondary))' }}>
          Database warning: {loadError}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
            Employee Performance Scores
          </h3>
          <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: saveStatus === 'saved' ? 'rgba(52,211,153,0.12)' : saveStatus === 'saving' ? 'rgba(79,127,255,0.12)' : 'rgba(251,191,36,0.12)', color: saveStatus === 'saved' ? 'rgb(52 211 153)' : saveStatus === 'saving' ? 'rgb(79 127 255)' : 'rgb(251 191 36)' }}>
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Draft'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Year {selectedYear}</span>
          <select
            className="input-base text-sm"
            style={{ minWidth: 240 }}
            value={sheet.selectedView}
            onChange={e => updateSheet(draft => ({ ...draft, selectedView: e.target.value }))}
          >
            {employeeOptions.map(item => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          {!isMasterboardSelected && (
            <>
              <button
                className="btn-ghost text-xs flex items-center gap-1.5"
                onClick={handleSync}
                disabled={isSyncing}
                title="Pull latest scores from activity entries"
              >
                <Icon name="ArrowPathIcon" size={12} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Syncing...' : 'Sync Activities'}
              </button>
              <button className="btn-ghost text-xs" onClick={addSection}>Add Section</button>
              <button className="btn-primary text-xs" onClick={addColumn}>Add Column</button>
            </>
          )}
        </div>
      </div>

      {(isBootstrapping || isSyncing) && (
        <div className="p-8 flex flex-col items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
          <p className="text-xs font-medium" style={{ color: 'rgb(var(--text-muted))' }}>
            {isSyncing ? 'Synchronizing with Database...' : 'Loading Score Worksheet...'}
          </p>
        </div>
      )}

      {!isMasterboardSelected && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 220 }}>
              <thead>
                <tr style={{ background: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                  <th className="px-4 py-2 text-left text-xs font-semibold sticky left-0 z-10" style={{ color: 'rgb(var(--text-primary))', background: 'rgb(var(--bg-elevated))', minWidth: 300 }}>
                    Category / Item
                  </th>
                  {sheet.columns.map(column => (
                    <th key={column} className="px-2 py-2 text-center text-xs font-semibold" style={{ color: 'rgb(var(--text-primary))', minWidth: 92 }}>
                      <div className="flex items-center justify-center gap-1 group/header">
                        <InlineEditableField
                          initialValue={column}
                          onSave={(val) => handleAsyncSave(() => renameColumn(column, val))}
                          className="w-20"
                          inputClassName="text-center"
                          textClassName="text-center font-mono"
                        />
                        <button className="p-1 rounded hover:bg-red-400/10 opacity-0 group-hover/header:opacity-100 transition-opacity" style={{ color: 'rgb(248 113 113)' }} onClick={() => deleteColumn(column)} title="Delete column">
                          <Icon name="TrashIcon" size={11} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center text-xs font-semibold" style={{ color: 'rgb(var(--text-primary))', minWidth: 86 }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {sheet.sections.map(section => (
                  <React.Fragment key={section.title}>
                    <tr style={{ background: 'rgba(79,127,255,0.07)', borderTop: '1px solid rgb(var(--border-subtle))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                      <td className="px-4 py-2 sticky left-0 z-10" style={{ color: 'rgb(var(--text-primary))', background: 'rgba(79,127,255,0.07)' }}>
                        <div className="flex items-center gap-2 flex-wrap group/section">
                          <InlineEditableField
                            initialValue={section.title}
                            onSave={(val) => handleAsyncSave(() => renameSection(section.title, val))}
                            className="min-w-[180px]"
                            textClassName="font-semibold text-sm"
                          />
                          <button className="btn-ghost text-[10px] py-1 px-2 opacity-0 group-hover/section:opacity-100 transition-opacity" onClick={() => addRow(section.title)}>Add Row</button>
                          <button className="p-1 rounded hover:bg-red-400/10 opacity-0 group-hover/section:opacity-100 transition-opacity" style={{ color: 'rgb(248 113 113)' }} onClick={() => deleteSection(section.title)} title="Delete section">
                            <Icon name="TrashIcon" size={12} />
                          </button>
                        </div>
                      </td>
                      {sheet.columns.map(column => (
                        <td key={`${section.title}-${column}`} className="px-2 py-2 text-center" style={{ color: 'rgb(var(--text-muted))' }}>-</td>
                      ))}
                      <td className="px-2 py-2 text-center" style={{ color: 'rgb(var(--text-muted))' }}>-</td>
                    </tr>

                    {section.rows.map((row, idx) => (
                      <tr key={row.label} style={{ borderBottom: '1px solid rgb(var(--border))', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td className="px-4 py-2 sticky left-0 z-10" style={{ color: 'rgb(var(--text-secondary))', background: idx % 2 === 0 ? 'rgb(var(--bg-card))' : 'rgb(var(--bg-surface))' }}>
                          <div className="flex items-center gap-2 group/row">
                            <InlineEditableField
                              initialValue={row.label}
                              onSave={(val) => handleAsyncSave(() => renameRow(row.label, val))}
                              className="min-w-[220px]"
                              textClassName="text-sm font-medium"
                              style={{ color: 'rgb(var(--text-primary))' }}
                            />
                            <button className="p-1 rounded hover:bg-red-400/10 opacity-0 group-hover/row:opacity-100 transition-opacity" style={{ color: 'rgb(248 113 113)' }} onClick={() => deleteRow(row.label)} title="Delete row">
                              <Icon name="TrashIcon" size={12} />
                            </button>
                          </div>
                        </td>
                        {sheet.columns.map(column => (
                          <td key={`${row.label}-${column}`} className="px-1 py-1">
                            <InlineEditableField
                              type="number"
                              initialValue={String(activeCells[`${row.label}::${column}`] ?? 0)}
                              onSave={(val) => handleAsyncSave(() => setCellValue(row.label, column, val))}
                              inputClassName="text-center font-mono"
                              textClassName="text-center font-mono text-sm block w-full"
                              style={{ color: 'rgb(var(--text-primary))' }}
                              className="w-full justify-center"
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center text-sm font-semibold font-mono" style={{ color: 'rgb(var(--text-primary))' }}>
                          {sum(sheet.columns.map(column => activeCells[`${row.label}::${column}`] || 0))}
                        </td>
                      </tr>
                    ))}

                    <tr style={{ background: 'rgba(250,204,21,0.16)', borderTop: '1px solid rgba(250,204,21,0.35)', borderBottom: '1px solid rgba(250,204,21,0.35)' }}>
                      <td className="px-4 py-2 sticky left-0 z-10" style={{ color: 'rgb(var(--text-primary))', background: 'rgba(250,204,21,0.16)' }}>
                        {section.title} Subtotal
                      </td>
                      {sheet.columns.map(column => (
                        <td key={`${section.title}-subtotal-${column}`} className="px-2 py-2 text-center text-sm font-mono" style={{ color: 'rgb(var(--text-primary))' }}>
                          {sectionColumnTotal(section, column)}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center text-sm font-semibold font-mono" style={{ color: 'rgb(var(--text-primary))' }}>
                        {cellSectionTotal(section)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}

                <tr style={{ background: 'rgba(79,127,255,0.1)', borderTop: '2px solid rgba(79,127,255,0.35)' }}>
                  <td className="px-4 py-2 sticky left-0 z-10" style={{ color: 'rgb(var(--text-primary))', background: 'rgba(79,127,255,0.1)' }}>
                    Individual - Total Month
                  </td>
                  {sheet.columns.map(column => (
                    <td key={`grand-${column}`} className="px-2 py-2 text-center text-sm font-semibold font-mono" style={{ color: 'rgb(79 127 255)' }}>
                      {cellColumnTotal(column)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center text-sm font-bold font-mono" style={{ color: 'rgb(79 127 255)' }}>
                    {grandTotal}
                  </td>
                </tr>

                {/* Half-year Summaries */}
                <tr style={{ background: 'rgba(52,211,153,0.08)', borderTop: '1px solid rgba(52,211,153,0.2)' }}>
                  <td className="px-4 py-2 sticky left-0 z-10 font-medium" style={{ color: 'rgb(52 211 153)', background: 'rgb(var(--bg-card))' }}>
                    January - June (H1) Total
                  </td>
                  <td colSpan={sheet.columns.length + 1} className="px-4 py-2 text-left text-sm font-bold font-mono" style={{ color: 'rgb(52 211 153)' }}>
                    {sum(sheet.columns.slice(0, Math.ceil(sheet.columns.length / 2)).map(c => cellColumnTotal(c)))}
                  </td>
                </tr>
                <tr style={{ background: 'rgba(167,139,250,0.08)', borderTop: '1px solid rgba(167,139,250,0.2)' }}>
                  <td className="px-4 py-2 sticky left-0 z-10 font-medium" style={{ color: 'rgb(167 139 250)', background: 'rgb(var(--bg-card))' }}>
                    July - December (H2) Total
                  </td>
                  <td colSpan={sheet.columns.length + 1} className="px-4 py-2 text-left text-sm font-bold font-mono" style={{ color: 'rgb(167 139 250)' }}>
                    {sum(sheet.columns.slice(Math.ceil(sheet.columns.length / 2)).map(c => cellColumnTotal(c)))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Masterboard Summary at the Bottom */}
      {isMasterboardSelected && (
        <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Activities Management</h4>
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                Create, manage, and assign activities to employees. Activities sync to their performance score records automatically.
              </p>
            </div>
          </div>

          {renderMasterboard()}
        </div>
      )}
    </div>
  );
}
