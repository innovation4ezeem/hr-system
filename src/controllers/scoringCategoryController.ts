import {
  listScoringCategories,
  replaceScoringCategories,
  type ScoringCategoryRecord,
} from '@/models/scoringCategoryModel';

const fallbackCategories: ScoringCategoryRecord[] = [
  { id: 'sc-001', name: 'KPI Achievement', weight: 40, description: 'Measured against set KPI targets', color: 'rgb(79 127 255)', order: 1 },
  { id: 'sc-002', name: 'Task Completion Rate', weight: 25, description: 'Percentage of tasks completed on time', color: 'rgb(52 211 153)', order: 2 },
  { id: 'sc-003', name: 'Quality of Work', weight: 20, description: 'Accuracy and quality assessment by HOD', color: 'rgb(167 139 250)', order: 3 },
  { id: 'sc-004', name: 'Attendance & Punctuality', weight: 10, description: 'Attendance record and punctuality score', color: 'rgb(251 191 36)', order: 4 },
  { id: 'sc-005', name: 'Behavioural Compliance', weight: 5, description: 'Adherence to company policies and conduct', color: 'rgb(248 113 113)', order: 5 },
];

function sanitizeCategories(items: ScoringCategoryRecord[]): ScoringCategoryRecord[] {
  return items.map((item, index) => ({
    id: (item.id || `sc-${Date.now()}-${index}`).trim(),
    name: (item.name || '').trim(),
    weight: Number(item.weight || 0),
    description: (item.description || '').trim(),
    color: (item.color || 'rgb(79 127 255)').trim() || 'rgb(79 127 255)',
    order: Number(item.order || index + 1),
  })).filter(item => item.name);
}

export async function getScoringCategoriesController(year: number) {
  const categories = await listScoringCategories(year);
  if (!categories.length) {
    await replaceScoringCategories(year, fallbackCategories);
    return fallbackCategories;
  }
  return categories;
}

export async function saveScoringCategoriesController(year: number, items: ScoringCategoryRecord[]) {
  const normalized = sanitizeCategories(items);
  await replaceScoringCategories(year, normalized);
}
