'use client';

import React, { useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import ActivitiesCrudPanel from './ActivitiesCrudPanel';
import {
  PERFORMANCE_MONTHS,
  getPerformanceSections,
  sectionsToCellMap,
} from '@/data/performanceScores';

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

const MASTERBOARD_OPTION = '__masterboard__';

const cloneColumns = (columns: string[]) => [...columns];

const createInitialSections = (): SheetSection[] => {
  return getPerformanceSections('u-001').map(section => ({
    title: section.title,
    rows: section.rows.map(row => ({ label: row.label })),
  }));
};

const createInitialCells = (employeeOptions: EmployeeOption[], columns: string[], sections: SheetSection[]) => {
  return employeeOptions.reduce((acc, employee) => {
    const sourceMap = sectionsToCellMap(getPerformanceSections(employee.id));
    acc[employee.id] = {};
    sections.forEach(section => {
      section.rows.forEach(row => {
        columns.forEach((column, columnIndex) => {
          const monthName = PERFORMANCE_MONTHS[columnIndex];
          acc[employee.id][`${row.label}::${column}`] = monthName ? (sourceMap[`${row.label}::${monthName}`] || 0) : 0;
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
  prefix: string,
) => {
  const next: Record<string, Record<string, number>> = {};
  Object.entries(cellsByEmployee).forEach(([employeeId, cells]) => {
    const nextCells: Record<string, number> = {};
    Object.entries(cells).forEach(([key, value]) => {
      if (!key.startsWith(prefix)) nextCells[key] = value;
    });
    next[employeeId] = nextCells;
  });
  return next;
};

const insertColumnDefaults = (
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

const addRowDefaults = (
  cellsByEmployee: Record<string, Record<string, number>>,
  sections: SheetSection[],
  rowLabel: string,
  columnNames: string[],
) => {
  const next: Record<string, Record<string, number>> = {};
  Object.entries(cellsByEmployee).forEach(([employeeId, cells]) => {
    const nextCells = { ...cells };
    columnNames.forEach(column => {
      nextCells[`${rowLabel}::${column}`] = 0;
    });
    next[employeeId] = nextCells;
  });
  return next;
};

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

function nextUniqueLabel(prefix: string, existing: string[]) {
  let index = 1;
  let candidate = `${prefix} ${index}`;
  while (existing.includes(candidate)) {
    index += 1;
    candidate = `${prefix} ${index}`;
  }
  return candidate;
}

export default function PerformanceScoresEditor({
  selectedYear,
  employeeOptions,
}: {
  selectedYear: number;
  employeeOptions: EmployeeOption[];
}) {
  const [columns, setColumns] = useState<string[]>(cloneColumns(PERFORMANCE_MONTHS as unknown as string[]));
  const [sections, setSections] = useState<SheetSection[]>(createInitialSections);
  const [cellsByEmployee, setCellsByEmployee] = useState<Record<string, Record<string, number>>>(() => createInitialCells(employeeOptions, PERFORMANCE_MONTHS as unknown as string[], createInitialSections()));
  const [selectedView, setSelectedView] = useState<string>(employeeOptions[0]?.id || 'u-001');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'draft' | 'saving'>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeEmployeeId = selectedView === MASTERBOARD_OPTION ? (employeeOptions[0]?.id || 'u-001') : selectedView;
  const isMasterboardSelected = selectedView === MASTERBOARD_OPTION;
  const activeCells = cellsByEmployee[activeEmployeeId] || {};

  const triggerAutoSave = () => {
    setSaveStatus('draft');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveStatus('saving');
      setTimeout(() => setSaveStatus('saved'), 600);
    }, 1000);
  };

  const updateCellsByEmployee = (updater: (prev: Record<string, Record<string, number>>) => Record<string, Record<string, number>>) => {
    setCellsByEmployee(prev => updater(prev));
    triggerAutoSave();
  };

  const allRowLabels = sections.flatMap(section => section.rows.map(row => row.label));
  const allSectionTitles = sections.map(section => section.title);

  const addSection = () => {
    const title = nextUniqueLabel('Section', allSectionTitles);
    const rowLabel = nextUniqueLabel('New Row', allRowLabels);
    setSections(prev => [...prev, { title, rows: [{ label: rowLabel }] }]);
    updateCellsByEmployee(prev => addRowDefaults(prev, sections, rowLabel, columns));
    toast.success('Section added');
  };

  const renameSection = (oldTitle: string, nextTitle: string) => {
    const trimmed = nextTitle.trim();
    if (!trimmed || trimmed === oldTitle) return;
    if (allSectionTitles.includes(trimmed)) {
      toast.error('Section name already exists');
      return;
    }
    setSections(prev => prev.map(section => (section.title === oldTitle ? { ...section, title: trimmed } : section)));
    triggerAutoSave();
  };

  const deleteSection = (title: string) => {
    setSections(prev => prev.filter(section => section.title !== title));
    updateCellsByEmployee(prev => {
      const next: Record<string, Record<string, number>> = {};
      Object.entries(prev).forEach(([employeeId, cells]) => {
        const nextCells: Record<string, number> = {};
        Object.entries(cells).forEach(([key, value]) => {
          const rowLabel = key.split('::')[0];
          const matches = sections.find(section => section.title === title)?.rows.some(row => row.label === rowLabel);
          if (!matches) nextCells[key] = value;
        });
        next[employeeId] = nextCells;
      });
      return next;
    });
    toast.success('Section deleted');
  };

  const addRow = (sectionTitle: string) => {
    const rowLabel = nextUniqueLabel('New Row', allRowLabels);
    setSections(prev => prev.map(section => (
      section.title === sectionTitle
        ? { ...section, rows: [...section.rows, { label: rowLabel }] }
        : section
    )));
    updateCellsByEmployee(prev => {
      const next: Record<string, Record<string, number>> = {};
      Object.entries(prev).forEach(([employeeId, cells]) => {
        next[employeeId] = { ...cells };
        columns.forEach(column => {
          next[employeeId][`${rowLabel}::${column}`] = 0;
        });
      });
      return next;
    });
    toast.success('Row added');
  };

  const renameRow = (oldLabel: string, nextLabel: string) => {
    const trimmed = nextLabel.trim();
    if (!trimmed || trimmed === oldLabel) return;
    if (allRowLabels.includes(trimmed)) {
      toast.error('Row name already exists');
      return;
    }
    setSections(prev => prev.map(section => ({
      ...section,
      rows: section.rows.map(row => (row.label === oldLabel ? { label: trimmed } : row)),
    })));
    setCellsByEmployee(prev => renameCellKeys(prev, `${oldLabel}::`, `${trimmed}::`));
    triggerAutoSave();
  };

  const deleteRow = (rowLabel: string) => {
    setSections(prev => prev.map(section => ({
      ...section,
      rows: section.rows.filter(row => row.label !== rowLabel),
    })).filter(section => section.rows.length > 0));
    updateCellsByEmployee(prev => deleteCellKeys(prev, `${rowLabel}::`));
    toast.success('Row deleted');
  };

  const addColumn = () => {
    const column = nextUniqueLabel('Column', columns);
    setColumns(prev => [...prev, column]);
    updateCellsByEmployee(prev => insertColumnDefaults(prev, sections, column));
    toast.success('Column added');
  };

  const renameColumn = (oldColumn: string, nextColumn: string) => {
    const trimmed = nextColumn.trim();
    if (!trimmed || trimmed === oldColumn) return;
    if (columns.includes(trimmed)) {
      toast.error('Column name already exists');
      return;
    }
    const oldPrefix = `::${oldColumn}`;
    const newPrefix = `::${trimmed}`;
    setColumns(prev => prev.map(column => (column === oldColumn ? trimmed : column)));
    setCellsByEmployee(prev => renameCellKeys(prev, oldPrefix, newPrefix));
    triggerAutoSave();
  };

  const deleteColumn = (column: string) => {
    setColumns(prev => prev.filter(item => item !== column));
    updateCellsByEmployee(prev => deleteCellKeys(prev, `::${column}`));
    toast.success('Column deleted');
  };

  const setCellValue = (rowLabel: string, column: string, raw: string) => {
    if (isMasterboardSelected) return;
    const next = raw.trim() === '' ? 0 : Number(raw);
    if (Number.isNaN(next)) return;
    setCellsByEmployee(prev => ({
      ...prev,
      [activeEmployeeId]: {
        ...(prev[activeEmployeeId] || {}),
        [`${rowLabel}::${column}`]: Math.max(0, next),
      },
    }));
    triggerAutoSave();
  };

  const activeSections = sections;

  const masterboardRows = useMemo(() => {
    return employeeOptions.map(item => {
      const employeeCells = cellsByEmployee[item.id] || {};
      const monthTotals = columns.map(column => {
        return activeSections.reduce((sumTotal, section) => {
          return sumTotal + section.rows.reduce((rowSum, row) => rowSum + (employeeCells[`${row.label}::${column}`] || 0), 0);
        }, 0);
      });
      return {
        id: item.id,
        name: item.name,
        firstHalfTotal: sum(monthTotals.slice(0, Math.ceil(columns.length / 2))),
        secondHalfTotal: sum(monthTotals.slice(Math.ceil(columns.length / 2))),
        total: sum(monthTotals),
      };
    });
  }, [activeSections, cellsByEmployee, columns, employeeOptions]);

  const cellColumnTotal = (column: string) => {
    return activeSections.reduce((sectionSum, section) => {
      return sectionSum + section.rows.reduce((rowSum, row) => rowSum + (activeCells[`${row.label}::${column}`] || 0), 0);
    }, 0);
  };

  const cellSectionTotal = (section: SheetSection) => {
    return sum(columns.map(column => section.rows.reduce((rowSum, row) => rowSum + (activeCells[`${row.label}::${column}`] || 0), 0)));
  };

  const sectionColumnTotal = (section: SheetSection, column: string) => {
    return section.rows.reduce((rowSum, row) => rowSum + (activeCells[`${row.label}::${column}`] || 0), 0);
  };

  const grandTotal = sum(columns.map(column => cellColumnTotal(column)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap p-4 rounded-xl" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
            Performance & Activities Management
          </h3>
          <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: saveStatus === 'saved' ? 'rgba(52,211,153,0.12)' : saveStatus === 'saving' ? 'rgba(79,127,255,0.12)' : 'rgba(251,191,36,0.12)', color: saveStatus === 'saved' ? 'rgb(52 211 153)' : saveStatus === 'saving' ? 'rgb(79 127 255)' : 'rgb(251 191 36)' }}>
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Draft'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="input-base text-sm font-bold text-blue-600"
            style={{ minWidth: 260 }}
            value={selectedView}
            onChange={e => setSelectedView(e.target.value)}
          >
            <option value={MASTERBOARD_OPTION}>📊 MASTERBOARD SUMMARY</option>
            {employeeOptions.filter(opt => opt.id !== 'masterboard').map(item => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          {!isMasterboardSelected && (
            <>
              <button className="btn-ghost text-xs" onClick={addSection}>+ Section</button>
              <button className="btn-ghost text-xs" onClick={addRow.bind(null, activeSections[activeSections.length - 1]?.title || sections[0]?.title || '')}>+ Row</button>
              <button className="btn-primary text-xs" onClick={addColumn}>+ Column</button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        {isMasterboardSelected ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 620 }}>
              <thead>
                <tr style={{ background: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                  <th className="px-3 py-2 text-left" style={{ color: 'rgb(var(--text-muted))' }}>Employee</th>
                  <th className="px-3 py-2 text-center" style={{ color: 'rgb(var(--text-muted))' }}>H1</th>
                  <th className="px-3 py-2 text-center" style={{ color: 'rgb(var(--text-muted))' }}>H2</th>
                  <th className="px-3 py-2 text-center" style={{ color: 'rgb(var(--text-muted))' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {masterboardRows.map((row, idx) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgb(var(--border))', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td className="px-3 py-2" style={{ color: 'rgb(var(--text-primary))' }}>{row.name}</td>
                    <td className="px-3 py-2 text-center font-mono" style={{ color: 'rgb(var(--text-secondary))' }}>{row.firstHalfTotal}</td>
                    <td className="px-3 py-2 text-center font-mono" style={{ color: 'rgb(var(--text-secondary))' }}>{row.secondHalfTotal}</td>
                    <td className="px-3 py-2 text-center font-semibold font-mono" style={{ color: 'rgb(var(--text-primary))' }}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 1320 }}>
              <thead>
                <tr style={{ background: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                  <th className="px-4 py-2 text-left text-xs font-semibold sticky left-0 z-10" style={{ color: 'rgb(var(--text-muted))', background: 'rgb(var(--bg-elevated))', minWidth: 300 }}>
                    Category / Item
                  </th>
                  {columns.map(column => (
                    <th key={column} className="px-2 py-2 text-center text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))', minWidth: 92 }}>
                      <div className="flex items-center justify-center gap-1">
                        <input
                          value={column}
                          onChange={e => renameColumn(column, e.target.value)}
                          className="input-base text-xs text-center"
                          style={{ padding: '4px 6px', minWidth: 68 }}
                        />
                        <button
                          className="p-1 rounded hover:bg-red-400/10"
                          style={{ color: 'rgb(248 113 113)' }}
                          onClick={() => deleteColumn(column)}
                          title="Delete column"
                        >
                          <Icon name="TrashIcon" size={11} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))', minWidth: 86 }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeSections.map(section => (
                  <React.Fragment key={section.title}>
                    <tr style={{ background: 'rgba(79,127,255,0.07)', borderTop: '1px solid rgb(var(--border-subtle))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                      <td className="px-4 py-2 sticky left-0 z-10" style={{ color: 'rgb(var(--text-primary))', background: 'rgba(79,127,255,0.07)' }}>
                        <div className="flex items-center gap-2">
                          <input
                            value={section.title}
                            onChange={e => renameSection(section.title, e.target.value)}
                            className="input-base text-sm font-semibold"
                            style={{ padding: '4px 8px', minWidth: 180 }}
                          />
                          <button className="btn-ghost text-xs" onClick={() => addRow(section.title)}>Add Row</button>
                          <button className="p-1 rounded hover:bg-red-400/10" style={{ color: 'rgb(248 113 113)' }} onClick={() => deleteSection(section.title)} title="Delete section">
                            <Icon name="TrashIcon" size={12} />
                          </button>
                        </div>
                      </td>
                      {columns.map(column => (
                        <td key={`${section.title}-${column}`} className="px-2 py-2 text-center" style={{ color: 'rgb(var(--text-muted))' }}>-</td>
                      ))}
                      <td className="px-2 py-2 text-center" style={{ color: 'rgb(var(--text-muted))' }}>-</td>
                    </tr>

                    {section.rows.map((row, idx) => (
                      <tr key={row.label} style={{ borderBottom: '1px solid rgb(var(--border))', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td className="px-4 py-2 sticky left-0 z-10" style={{ color: 'rgb(var(--text-secondary))', background: idx % 2 === 0 ? 'rgb(var(--bg-card))' : 'rgb(var(--bg-surface))' }}>
                          <div className="flex items-center gap-2">
                            <input
                              value={row.label}
                              onChange={e => renameRow(row.label, e.target.value)}
                              className="input-base text-sm"
                              style={{ padding: '4px 8px', minWidth: 220 }}
                            />
                            <button className="p-1 rounded hover:bg-red-400/10" style={{ color: 'rgb(248 113 113)' }} onClick={() => deleteRow(row.label)} title="Delete row">
                              <Icon name="TrashIcon" size={12} />
                            </button>
                          </div>
                        </td>
                        {columns.map(column => (
                          <td key={`${row.label}-${column}`} className="px-1 py-1">
                            <input
                              type="number"
                              min={0}
                              value={activeCells[`${row.label}::${column}`] || 0}
                              onChange={e => setCellValue(row.label, column, e.target.value)}
                              className="w-full text-center text-sm font-mono rounded px-1.5 py-1 transition-all focus:outline-none"
                              style={{
                                background: 'transparent',
                                color: 'rgb(var(--text-primary))',
                                border: '1px solid transparent',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                              onFocus={e => { e.target.style.background = 'rgba(79,127,255,0.08)'; e.target.style.borderColor = 'rgba(79,127,255,0.3)'; }}
                              onBlur={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center text-sm font-semibold font-mono" style={{ color: 'rgb(var(--text-primary))' }}>
                          {sum(columns.map(column => activeCells[`${row.label}::${column}`] || 0))}
                        </td>
                      </tr>
                    ))}

                    <tr style={{ background: 'rgba(251,191,36,0.12)', borderTop: '1px solid rgba(251,191,36,0.2)', borderBottom: '1px solid rgba(251,191,36,0.2)' }}>
                      <td className="px-4 py-2 sticky left-0 z-10" style={{ color: 'rgb(var(--text-primary))', background: 'rgba(251,191,36,0.15)' }}>
                        {section.title} Subtotal
                      </td>
                      {columns.map(column => (
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
                  {columns.map(column => (
                    <td key={`grand-${column}`} className="px-2 py-2 text-center text-sm font-semibold font-mono" style={{ color: 'rgb(79 127 255)' }}>
                      {cellColumnTotal(column)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center text-sm font-bold font-mono" style={{ color: 'rgb(79 127 255)' }}>
                    {grandTotal}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isMasterboardSelected && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1" style={{ background: 'rgb(var(--border-subtle))' }} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Detailed Activity Logs</span>
            <div className="h-px flex-1" style={{ background: 'rgb(var(--border-subtle))' }} />
          </div>
          <ActivitiesCrudPanel 
            embedded 
            externalEmployeeId={activeEmployeeId} 
            year={selectedYear}
          />
        </div>
      )}
    </div>
  );
}
