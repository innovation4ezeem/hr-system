import { PERFORMANCE_MONTHS, getPerformanceSections, sectionsToCellMap } from '@/data/performanceScores';
import {
  getPerformanceSheetByYear,
  upsertPerformanceSheet,
  type PerformanceSheetRecord,
} from '@/models/performanceScoreModel';
import { syncSheetIntoActivities } from '@/controllers/activityScoreController';

type SheetSection = {
  title: string;
  rows: Array<{ label: string }>;
};

type SheetPayload = {
  columns: string[];
  sections: SheetSection[];
  cellsByEmployee: Record<string, Record<string, number>>;
};

function createDefaultPayload(employeeIds: string[]): SheetPayload {
  const sections = getPerformanceSections('u-001').map(section => ({
    title: section.title,
    rows: section.rows.map(row => ({ label: row.label })),
  }));

  const columns = [...PERFORMANCE_MONTHS];
  const cellsByEmployee: Record<string, Record<string, number>> = {};

  employeeIds.forEach(employeeId => {
    const sourceMap = sectionsToCellMap(getPerformanceSections(employeeId));
    const cells: Record<string, number> = {};

    sections.forEach(section => {
      section.rows.forEach(row => {
        columns.forEach((column, idx) => {
          const month = PERFORMANCE_MONTHS[idx];
          cells[`${row.label}::${column}`] = month ? sourceMap[`${row.label}::${month}`] || 0 : 0;
        });
      });
    });

    cellsByEmployee[employeeId] = cells;
  });

  return { columns, sections, cellsByEmployee };
}

function normalizePayload(payload: SheetPayload, employeeIds: string[]): SheetPayload {
  const columns = payload.columns?.length ? payload.columns : [...PERFORMANCE_MONTHS];
  const sections = payload.sections?.length ? payload.sections : createDefaultPayload(employeeIds).sections;
  const cellsByEmployee: Record<string, Record<string, number>> = payload.cellsByEmployee || {};

  employeeIds.forEach(employeeId => {
    if (!cellsByEmployee[employeeId]) {
      cellsByEmployee[employeeId] = {};
    }
    sections.forEach(section => {
      section.rows.forEach(row => {
        columns.forEach(column => {
          const key = `${row.label}::${column}`;
          if (typeof cellsByEmployee[employeeId][key] !== 'number') {
            cellsByEmployee[employeeId][key] = 0;
          }
        });
      });
    });
  });

  return { columns, sections, cellsByEmployee };
}

export async function getPerformanceSheetController(year: number, employeeIds: string[]) {
  const safeYear = Number.isInteger(year) ? year : new Date().getFullYear();
  const ids = employeeIds.length ? employeeIds : ['u-001'];

  const record = await getPerformanceSheetByYear(safeYear);
  if (!record) {
    return createDefaultPayload(ids);
  }

  return normalizePayload(
    {
      columns: record.columns,
      sections: record.sections,
      cellsByEmployee: record.cellsByEmployee,
    },
    ids,
  );
}

export async function savePerformanceSheetController(
  year: number, 
  payload: SheetPayload, 
  targetEmployeeId?: string, 
  targetMonth?: string
) {
  const safeYear = Number.isInteger(year) ? year : new Date().getFullYear();

  const record: PerformanceSheetRecord = {
    year: safeYear,
    columns: payload.columns || [],
    sections: payload.sections || [],
    cellsByEmployee: payload.cellsByEmployee || {},
  };

  await upsertPerformanceSheet(record);
  await syncSheetIntoActivities(safeYear, payload, targetEmployeeId, targetMonth);
  // NEW: Trigger deep sync to update performance_inputs and performance_scores
  await syncSheetToPerformanceResults(safeYear, payload, targetEmployeeId, targetMonth);
}

async function syncSheetToPerformanceResults(
  year: number, 
  payload: SheetPayload, 
  targetEmployeeId?: string, 
  targetMonth?: string
) {
  const { upsertPerformanceInput, calculateAndSavePerformanceScore } = await import('@/models/performanceManagementModel');
  const { listUsers } = await import('@/models/userModel');
  const users = await listUsers();
 
  const monthNames = [...PERFORMANCE_MONTHS];
 
  for (const [employeeId, cells] of Object.entries(payload.cellsByEmployee)) {
    if (targetEmployeeId && employeeId !== targetEmployeeId) continue;
 
    const user = users.find(u => u.id === employeeId);
    if (!user) continue;
 
    for (let mIdx = 0; mIdx < monthNames.length; mIdx++) {
      const month = monthNames[mIdx];
      if (targetMonth && month !== targetMonth) continue;
 
      const periodNo = mIdx + 1;
 
      // Extract values from cells for this specific month
      const kpi = Number(cells[`KPI / OKR::${month}`] || cells[`KPI::${month}`] || 0);
      const tasks = Number(cells[`Tasks Based::${month}`] || 0);
      const quality = Number(cells[`Quality::${month}`] || 0);
 
      const participation: Record<string, number> = {
        PLAY_ATTENDANCE: Number(cells[`PLAY Attendance::${month}`] || 0),
        PLAY_WINNER: Number(cells[`PLAY Winner::${month}`] || 0),
        HCM_STICKERS: Number(cells[`HCM Sticker::${month}`] || cells[`HCM sticker::${month}`] || 0),
        LEARN_ATTENDANCE: Number(cells[`LEARN Attendance::${month}`] || 0),
      };
 
      const popularity: Record<string, number> = {
        GRATITUDE_STICKER: Number(cells[`Gratitude sticker::${month}`] || 0),
        VOTING_FORM: Number(cells[`Voting form::${month}`] || 0),
      };
 
      try {
        // 1. Update the Performance Input table (source for calculations)
        await upsertPerformanceInput({
          employeeId,
          employeeName: user.name,
          department: user.dept,
          periodType: 'monthly',
          periodYear: year,
          periodNo,
          kpiAchieved: kpi,
          kpiTotal: 100, // Treat KPI point as percentage
          tasksAchieved: tasks,
          tasksTotal: 100,
          qualityTotalTasks: 100,
          qualityErrors: 100 - quality,
          participation,
          popularity,
          updatedBy: 'System Sync',
        });
 
        // 2. Trigger calculation to update the performance_scores table (source for Heatmap)
        await calculateAndSavePerformanceScore({
          employeeId,
          periodType: 'monthly',
          periodYear: year,
          periodNo,
          actor: 'System Sync',
        });
      } catch (err) {
        console.error(`[Sync] Failed to update results for ${user.name} (${month}):`, err);
      }
    }
  }
}
