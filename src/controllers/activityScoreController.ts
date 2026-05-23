import { PERFORMANCE_MONTHS } from '@/data/performanceScores';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_MONTHS,
  ACTIVITY_SCORE_BUCKETS,
  bucketSectionTitle,
  normalizeCategory,
  normalizeScoreBucket,
} from '@/data/activityScoreRules';
import {
  deleteActivityScore,
  listActivityScores,
  type ActivityScoreRecord,
  upsertActivityScore,
} from '@/models/activityScoreModel';
import { listUsers } from '@/models/userModel';
import { getPerformanceSheetController, savePerformanceSheetController } from '@/controllers/performanceScoreController';
import { getSystemSettings } from '@/models/systemSettingsModel';
import { HRNotificationService } from '@/lib/notifications/hrNotificationService';
import { insertSystemAuditLog } from '@/models/systemAuditLogModel';
import { prisma } from '@/lib/prisma';

type ActivityPayload = Partial<ActivityScoreRecord>;

type SheetPayload = {
  columns: string[];
  sections: Array<{ title: string; rows: Array<{ label: string }> }>;
  cellsByEmployee: Record<string, Record<string, number>>;
};

function normalizeDate(value: string): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value;
}

function parseYear(value?: number | string | null) {
  const year = Number(value);
  if (!Number.isFinite(year)) return new Date().getFullYear();
  return Math.trunc(year);
}

function normalizeMonth(month: string, date: string): string {
  if (ACTIVITY_MONTHS.includes(month as (typeof ACTIVITY_MONTHS)[number])) return month;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'January';
  return parsed.toLocaleString('en-US', { month: 'long' });
}

function normalizeToColumn(month: string, columns: string[]): string {
  const aliases: Record<string, string> = {
    january: 'Jan',
    february: 'Feb',
    march: 'March',
    april: 'April',
    may: 'May',
    june: 'June',
    july: 'July',
    august: 'August',
    september: 'September',
    october: 'October',
    november: 'November',
    december: 'December',
  };

  if (columns.includes(month)) return month;
  const alias = aliases[month.toLowerCase()];
  if (alias && columns.includes(alias)) return alias;

  const short = month.slice(0, 3);
  const shortMatch = columns.find(col => col.toLowerCase().startsWith(short.toLowerCase()));
  if (shortMatch) return shortMatch;

  return columns[0] || PERFORMANCE_MONTHS[0];
}

async function resolveEmployeeId(assignedToId: string, assignedToName: string): Promise<string> {
  if (assignedToId) return assignedToId;
  if (!assignedToName) return '';

  const users = await listUsers();
  const found = users.find(user => user.name.trim().toLowerCase() === assignedToName.trim().toLowerCase());
  return found?.id || '';
}

function ensureScoreBucketExists(sheet: SheetPayload, scoreBucket: string) {
  const hasRow = sheet.sections.some(section => section.rows.some(row => row.label === scoreBucket));
  if (hasRow) return;

  const sectionTitle = bucketSectionTitle(scoreBucket);
  const section = sheet.sections.find(item => item.title === sectionTitle);
  if (section) {
    section.rows.push({ label: scoreBucket });
  } else {
    sheet.sections.push({ title: sectionTitle, rows: [{ label: scoreBucket }] });
  }
}

function ensureEmployeeCells(sheet: SheetPayload, employeeId: string) {
  if (!sheet.cellsByEmployee[employeeId]) {
    sheet.cellsByEmployee[employeeId] = {};
  }

  sheet.sections.forEach(section => {
    section.rows.forEach(row => {
      sheet.columns.forEach(column => {
        const key = `${row.label}::${column}`;
        if (typeof sheet.cellsByEmployee[employeeId][key] !== 'number') {
          sheet.cellsByEmployee[employeeId][key] = 0;
        }
      });
    });
  });
}

export async function syncActivitiesIntoPerformanceSheet(year: number) {
  const entries = await listActivityScores({ year });
  const employeeIds = Array.from(new Set(entries.map(item => item.assignedToId).filter(Boolean)));
  const sheet = (await getPerformanceSheetController(year, employeeIds.length ? employeeIds : ['u-001'])) as SheetPayload;

  const allBuckets = [...ACTIVITY_SCORE_BUCKETS];
  allBuckets.forEach(bucket => ensureScoreBucketExists(sheet, bucket));

  const allEmployeeIds = Array.from(new Set([...Object.keys(sheet.cellsByEmployee), ...employeeIds]));
  allEmployeeIds.forEach(employeeId => ensureEmployeeCells(sheet, employeeId));

  allEmployeeIds.forEach(employeeId => {
    allBuckets.forEach(bucket => {
      sheet.columns.forEach(column => {
        sheet.cellsByEmployee[employeeId][`${bucket}::${column}`] = 0;
      });
    });
  });

  entries.forEach(entry => {
    if (!entry.assignedToId || entry.sourceFolder === 'System') return;
    const column = normalizeToColumn(entry.month, sheet.columns);
    const bucket = normalizeScoreBucket(entry.scoreBucket, entry.category);
    const key = `${bucket}::${column}`;
    sheet.cellsByEmployee[entry.assignedToId][key] = (sheet.cellsByEmployee[entry.assignedToId][key] || 0) + Number(entry.score || 0);
  });

  await savePerformanceSheetController(year, sheet);
}

export async function getActivityScoresController(filters: {
  year?: number;
  employeeId?: string;
  employeeName?: string;
  startDate?: string;
  endDate?: string;
  periodType?: 'monthly' | 'quarterly' | 'yearly';
  periodNo?: number;
}) {
  return listActivityScores(filters);
}

export async function getActivityMetaController() {
  const entries = await listActivityScores({});
  const categories = Array.from(new Set(entries.map(e => e.category).filter(Boolean)));
  const years = Array.from(new Set(entries.map(e => e.year).filter(Boolean))).sort((a, b) => b - a);
  return { totalEntries: entries.length, categories, years };
}

export async function createActivityScoreController(payload: ActivityPayload) {
  const activityName = (payload.activityName || '').trim();
  const assignedToName = (payload.assignedToName || '').trim();
  if (!activityName || !assignedToName) {
    throw new Error('Activity name and assigned employee are required');
  }

  const date = normalizeDate(String(payload.date || ''));
  const category = normalizeCategory(String(payload.category || 'PLGT Activities'));
  const month = normalizeMonth(String(payload.month || ''), date);
  const year = parseYear(payload.year);
  const score = Number(payload.score || 0);
  const assignedToId = await resolveEmployeeId(String(payload.assignedToId || ''), assignedToName);
  const scoreBucket = normalizeScoreBucket(String(payload.scoreBucket || ''), category);

  const settings = await getSystemSettings();
  const performanceWeights = settings.performanceWeights;

  const record: ActivityScoreRecord = {
    id: String(payload.id || `ACT-${Date.now()}`),
    activityName,
    date,
    year,
    month,
    category,
    scoreBucket,
    score: Number.isFinite(score) ? score : 0,
    sourceFolder: String(payload.sourceFolder || 'General').trim() || 'General',
    description: String(payload.description || ''),
    assignedToName,
    assignedToId,
    attachmentName: String(payload.attachmentName || '').trim(),
    attachmentUrl: String(payload.attachmentUrl || '').trim(),
    updatedBy: String(payload.updatedBy || '').trim(),
    performanceWeights,
  };

  await upsertActivityScore(record);
  
  // Sync worksheet (INCREMENTAL)
  try {
    if (record.assignedToId && record.sourceFolder !== 'System') {
      const sheet = await getPerformanceSheetController(parseYear(record.year), []);
      if (sheet.cellsByEmployee[record.assignedToId]) {
        const column = normalizeToColumn(record.month, sheet.columns);
        const bucket = normalizeScoreBucket(record.scoreBucket, record.category);
        const key = `${bucket}::${column}`;
        sheet.cellsByEmployee[record.assignedToId][key] = (sheet.cellsByEmployee[record.assignedToId][key] || 0) + Number(record.score || 0);
        await savePerformanceSheetController(parseYear(record.year), sheet, record.assignedToId, record.month);
      }
    }
  } catch (e) {
    console.error('Incremental sync failed, full sync:', e);
    await syncActivitiesIntoPerformanceSheet(record.year);
  }

  // Audit Log
  await insertSystemAuditLog('performance-score', 'create-activity', record.updatedBy || 'Admin', {
    id: record.id,
    activityName: record.activityName,
    assignedToName: record.assignedToName,
    score: record.score,
    category: record.category
  });

  // Notify Employee
  await HRNotificationService.notifyActivityScore({
    employeeId: record.assignedToId,
    employeeName: record.assignedToName,
    activityName: record.activityName,
    score: record.score,
    category: record.category,
    bucket: record.scoreBucket,
    date: record.date,
    actorName: record.updatedBy || 'Admin'
  });

  return record;
}

export async function createActivityScoresBatchController(payload: ActivityPayload & { assignedToIds: string[] }) {
  const activityName = (payload.activityName || '').trim();
  const assignedToIds = payload.assignedToIds || [];
  if (!activityName || assignedToIds.length === 0) {
    throw new Error('Activity name and at least one employee are required');
  }

  const date = normalizeDate(String(payload.date || ''));
  const category = normalizeCategory(String(payload.category || 'PLGT Activities'));
  const month = normalizeMonth(String(payload.month || ''), date);
  const year = parseYear(payload.year);
  const score = Number(payload.score || 0);
  const scoreBucket = normalizeScoreBucket(String(payload.scoreBucket || ''), category);

  const settings = await getSystemSettings();
  const performanceWeights = settings.performanceWeights;
  const users = await listUsers();

  const records: ActivityScoreRecord[] = assignedToIds.map(eid => {
    const user = users.find(u => u.id === eid);
    const assignedToName = user?.name || 'Unknown';
    
    return {
      id: `ACT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      activityName,
      date,
      year,
      month,
      category,
      scoreBucket,
      score: Number.isFinite(score) ? score : 0,
      sourceFolder: String(payload.sourceFolder || 'General').trim() || 'General',
      description: String(payload.description || ''),
      assignedToName,
      assignedToId: eid,
      attachmentName: String(payload.attachmentName || '').trim(),
      attachmentUrl: String(payload.attachmentUrl || '').trim(),
      updatedBy: String(payload.updatedBy || '').trim(),
      performanceWeights,
    };
  });

  // Batch Upsert
  
  for (const record of records) {
    await prisma.activity_score_entries.upsert({
      where: { id: record.id },
      update: {
        activity_name: record.activityName,
        date: record.date,
        year: record.year,
        month: record.month,
        category: record.category,
        score_bucket: record.scoreBucket,
        score: record.score,
        source_folder: record.sourceFolder,
        description: record.description,
        assigned_to_name: record.assignedToName,
        assigned_to_id: record.assignedToId,
        attachment_name: record.attachmentName,
        attachment_url: record.attachmentUrl,
        updated_by: record.updatedBy,
        updated_at: new Date(),
        performance_weights: record.performanceWeights as any,
      },
      create: {
        id: record.id,
        activity_name: record.activityName,
        date: record.date,
        year: record.year,
        month: record.month,
        category: record.category,
        score_bucket: record.scoreBucket,
        score: record.score,
        source_folder: record.sourceFolder,
        description: record.description,
        assigned_to_name: record.assignedToName,
        assigned_to_id: record.assignedToId,
        attachment_name: record.attachmentName,
        attachment_url: record.attachmentUrl,
        updated_by: record.updatedBy,
        created_at: new Date(),
        updated_at: new Date(),
        performance_weights: record.performanceWeights as any,
      }
    });
  }

  // Sync worksheet (INCREMENTAL BATCH)
  try {
    const sheet = await getPerformanceSheetController(parseYear(year), []);
    let modified = false;
    for (const record of records) {
      if (record.assignedToId && record.sourceFolder !== 'System') {
        if (sheet.cellsByEmployee[record.assignedToId]) {
          const column = normalizeToColumn(record.month, sheet.columns);
          const bucket = normalizeScoreBucket(record.scoreBucket, record.category);
          const key = `${bucket}::${column}`;
          sheet.cellsByEmployee[record.assignedToId][key] = (sheet.cellsByEmployee[record.assignedToId][key] || 0) + Number(record.score || 0);
          modified = true;
        }
      }
    }
    if (modified) {
      await savePerformanceSheetController(parseYear(year), sheet);
    }
  } catch (e) {
    console.error('Batch incremental sync failed, full sync:', e);
    await syncActivitiesIntoPerformanceSheet(year);
  }

  // Audit Log & Notify in background
  Promise.all(records.map(async record => {
    try {
      await insertSystemAuditLog('performance-score', 'create-activity', record.updatedBy || 'Admin', {
        id: record.id,
        activityName: record.activityName,
        assignedToName: record.assignedToName,
        score: record.score,
        category: record.category
      });

      await HRNotificationService.notifyActivityScore({
        employeeId: record.assignedToId,
        employeeName: record.assignedToName,
        activityName: record.activityName,
        score: record.score,
        category: record.category,
        bucket: record.scoreBucket,
        date: record.date,
        actorName: record.updatedBy || 'Admin'
      });
    } catch (e) {
      console.error('Background log/notify failed for record', record.id, e);
    }
  })).catch(e => console.error('Batch background processing failed', e));

  return records;
}

export async function updateActivityScoreController(id: string, payload: ActivityPayload) {
  if (!id) throw new Error('Activity id is required');

  const existing = (await listActivityScores()).find(item => item.id === id);
  if (!existing) throw new Error('Activity record not found');

  const merged = { ...existing, ...payload, id };
  const assignedToName = String(merged.assignedToName || '').trim();
  if (!assignedToName) throw new Error('Assigned employee is required');

  const date = normalizeDate(String(merged.date || ''));
  const category = normalizeCategory(String(merged.category || 'PLGT Activities'));
  const month = normalizeMonth(String(merged.month || ''), date);
  const year = parseYear(merged.year);
  const assignedToId = await resolveEmployeeId(String(merged.assignedToId || ''), assignedToName);

  let performanceWeights = existing.performanceWeights;
  if (!performanceWeights) {
    const settings = await getSystemSettings();
    performanceWeights = settings.performanceWeights;
  }

  const record: ActivityScoreRecord = {
    id,
    activityName: String(merged.activityName || '').trim(),
    date,
    year,
    month,
    category,
    scoreBucket: normalizeScoreBucket(String(merged.scoreBucket || ''), category),
    score: Number(merged.score || 0),
    sourceFolder: String(merged.sourceFolder || 'General').trim() || 'General',
    description: String(merged.description || ''),
    assignedToName,
    assignedToId,
    attachmentName: String(merged.attachmentName || '').trim(),
    attachmentUrl: String(merged.attachmentUrl || '').trim(),
    updatedBy: String(payload.updatedBy || '').trim(),
    performanceWeights,
  };

  if (!record.activityName) throw new Error('Activity name is required');

  await upsertActivityScore(record);
  
  // Sync worksheet (INCREMENTAL UPDATE)
  try {
    const sheet = await getPerformanceSheetController(parseYear(record.year), []);
    let modified = false;

    // Deduct old
    if (existing.assignedToId && existing.sourceFolder !== 'System') {
      if (sheet.cellsByEmployee[existing.assignedToId]) {
        const column = normalizeToColumn(existing.month, sheet.columns);
        const bucket = normalizeScoreBucket(existing.scoreBucket, existing.category);
        const key = `${bucket}::${column}`;
        if (typeof sheet.cellsByEmployee[existing.assignedToId][key] === 'number') {
          sheet.cellsByEmployee[existing.assignedToId][key] -= Number(existing.score || 0);
          modified = true;
        }
      }
    }

    // Add new
    if (record.assignedToId && record.sourceFolder !== 'System') {
      if (sheet.cellsByEmployee[record.assignedToId]) {
        const column = normalizeToColumn(record.month, sheet.columns);
        const bucket = normalizeScoreBucket(record.scoreBucket, record.category);
        const key = `${bucket}::${column}`;
        sheet.cellsByEmployee[record.assignedToId][key] = (sheet.cellsByEmployee[record.assignedToId][key] || 0) + Number(record.score || 0);
        modified = true;
      }
    }

    if (modified) {
      if (existing.assignedToId === record.assignedToId && existing.month === record.month) {
        await savePerformanceSheetController(parseYear(record.year), sheet, record.assignedToId, record.month);
      } else {
        await savePerformanceSheetController(parseYear(record.year), sheet);
      }
    }
  } catch (e) {
    console.error('Update incremental sync failed, full sync:', e);
    await syncActivitiesIntoPerformanceSheet(record.year);
  }

  // Audit Log with Diffs
  const diffs: Record<string, { from: any, to: any }> = {};
  const trackableFields = ['activityName', 'date', 'month', 'category', 'scoreBucket', 'score', 'description', 'assignedToName'];
  
  trackableFields.forEach(field => {
    const oldVal = (existing as any)[field];
    const newVal = (record as any)[field];
    if (oldVal !== newVal) {
      diffs[field] = { from: oldVal, to: newVal };
    }
  });

  if (Object.keys(diffs).length > 0) {
    await insertSystemAuditLog('performance-score', 'update-activity', record.updatedBy || 'Admin', {
      id: record.id,
      activityName: record.activityName,
      diffs
    });
  }

  // Notify Employee
  await HRNotificationService.notifyActivityScore({
    employeeId: record.assignedToId,
    employeeName: record.assignedToName,
    activityName: record.activityName,
    score: record.score,
    category: record.category,
    bucket: record.scoreBucket,
    date: record.date,
    actorName: record.updatedBy || 'Admin'
  });

  return record;
}

export async function deleteActivityScoreController(idOrIds: string | string[], year: number, actor = 'Admin') {
  const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
  if (ids.length === 0) return;

  const existings = await prisma.activity_score_entries.findMany({
    where: { id: { in: ids } }
  });

  if (existings.length === 0) return;

  // Cleanup corresponding popularity_votes if any of the deleted items are Popularity votes
  for (const existing of existings) {
    if (existing.category === 'Popularity' && existing.activity_name.startsWith('Live Popularity Vote from ')) {
      const voterName = existing.activity_name.replace('Live Popularity Vote from ', '').trim();
      const monthStr = `${existing.month} ${existing.year}`;
      const matchingVotes = await prisma.popularity_votes.findMany({
        where: {
          voter_name: voterName,
          target_employee_id: existing.assigned_to_id,
          month: monthStr
        },
        take: 1
      });
      if (matchingVotes.length > 0) {
        await prisma.popularity_votes.delete({
          where: { id: matchingVotes[0].id }
        });
      }
    }
  }

  // 1. Delete the actual records
  await prisma.activity_score_entries.deleteMany({
    where: { id: { in: ids } }
  });

  // 2. Syncing the worksheet (INCREMENTAL)
  try {
    const sheet = await getPerformanceSheetController(parseYear(year), []);
    let sheetModified = false;

    for (const existing of existings) {
      if (existing.assigned_to_id && existing.source_folder !== 'System') {
        if (sheet.cellsByEmployee[existing.assigned_to_id]) {
          const column = normalizeToColumn(existing.month, sheet.columns);
          const bucket = normalizeScoreBucket(existing.score_bucket, existing.category);
          const key = `${bucket}::${column}`;
          if (typeof sheet.cellsByEmployee[existing.assigned_to_id][key] === 'number') {
            sheet.cellsByEmployee[existing.assigned_to_id][key] -= Number(existing.score || 0);
            sheetModified = true;
          }
        }
      }
    }

    if (sheetModified) {
      if (existings.length === 1) {
        await savePerformanceSheetController(parseYear(year), sheet, existings[0].assigned_to_id, existings[0].month);
      } else {
        await savePerformanceSheetController(parseYear(year), sheet);
      }
    }
  } catch (e) {
    console.error('Incremental sync failed, falling back to full sync:', e);
    await syncActivitiesIntoPerformanceSheet(parseYear(year));
  }

  // 3. Audit Logs
  for (const existing of existings) {
    insertSystemAuditLog('performance-score', 'delete-activity', actor, {
      id: existing.id,
      activityName: existing.activity_name,
      assignedToName: existing.assigned_to_name
    }).catch(auditError => {
      console.error('Failed to save audit log for delete activity:', auditError);
    });
  }
}

export async function cleanupSystemAdjustments(year: number) {
  const entries = await listActivityScores({ year });
  const systemEntries = entries.filter(e => e.sourceFolder === 'System' || e.activityName.startsWith('Worksheet Adjustment:'));
  for (const entry of systemEntries) {
    await deleteActivityScore(entry.id);
  }
}

export async function syncSheetIntoActivities(year: number, sheet: SheetPayload) {
  console.log(`[Sync] Starting worksheet sync for year ${year}...`);
  const allEntries = await listActivityScores({ year });
  const users = await listUsers();
  
  // 1. Group existing activities by (employeeId, bucket, column)
  // We separate "Adjustment" activities so we can calculate the "Natural" sum
  const naturalSums: Record<string, number> = {};
  const adjustmentRecords: Record<string, ActivityScoreRecord> = {};

  const columnToMonth: Record<string, string> = {
    'Jan': 'January',
    'Feb': 'February',
    'March': 'March',
    'April': 'April',
    'May': 'May',
    'June': 'June',
    'July': 'July',
    'Aug': 'August',
    'Sept': 'September',
    'Oct': 'October',
    'Nov': 'November',
    'Dec': 'December',
  };

  allEntries.forEach(entry => {
    if (!entry.assignedToId) return;
    const column = normalizeToColumn(entry.month, sheet.columns);
    const key = `${entry.assignedToId}::${entry.scoreBucket}::${column}`;

    if (entry.activityName.startsWith('Worksheet Adjustment:')) {
      adjustmentRecords[key] = entry;
    } else {
      naturalSums[key] = (naturalSums[key] || 0) + Number(entry.score || 0);
    }
  });

  // 2. Iterate through sheet cells and compare with natural sums
  const promises: Promise<any>[] = [];

  for (const [employeeId, cells] of Object.entries(sheet.cellsByEmployee)) {
    const user = users.find(u => u.id === employeeId);
    if (!user) continue;

    for (const [cellKey, targetScore] of Object.entries(cells)) {
      const [bucket, column] = cellKey.split('::');
      if (!ACTIVITY_SCORE_BUCKETS.includes(bucket as any)) continue;

      const key = `${employeeId}::${bucket}::${column}`;
      const naturalSum = naturalSums[key] || 0;
      const adjustmentNeeded = Number(targetScore) - naturalSum;

      const existingAdjustment = adjustmentRecords[key];

      if (adjustmentNeeded === 0) {
        // If adjustment is 0 but we have a record, delete it to keep list clean
        if (existingAdjustment) {
          promises.push(deleteActivityScore(existingAdjustment.id));
        }
      } else {
        // Upsert adjustment record
        const month = columnToMonth[column] || column;
        const category = bucketSectionTitle(bucket);
        
        const record: ActivityScoreRecord = {
          id: existingAdjustment?.id || `ADJ-${employeeId}-${bucket}-${column}-${year}`,
          activityName: `Worksheet Adjustment: ${bucket} (${column})`,
          date: existingAdjustment?.date || `${year}-${String(ACTIVITY_MONTHS.indexOf(month as any) + 1).padStart(2, '0')}-01`,
          year,
          month,
          category,
          scoreBucket: bucket,
          score: adjustmentNeeded,
          sourceFolder: 'System',
          description: `Automatically created adjustment from Performance Worksheet entry.`,
          assignedToName: user.name,
          assignedToId: employeeId,
          attachmentName: '',
          attachmentUrl: '',
          updatedBy: 'System Sync',
        };
        promises.push(upsertActivityScore(record).then(() => {
          return HRNotificationService.notifyActivityScore({
            employeeId: record.assignedToId,
            employeeName: record.assignedToName,
            activityName: record.activityName,
            score: record.score,
            category: record.category,
            bucket: record.scoreBucket,
            date: record.date,
            actorName: 'Admin'
          });
        }));
      }
    }
  }

  await Promise.all(promises);
}
