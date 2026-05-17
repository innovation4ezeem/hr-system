export type ScoreRow = {
  label: string;
  monthly: number[];
};

export type ScoreSection = {
  title: string;
  rows: ScoreRow[];
};

export const PERFORMANCE_MONTHS = [
  'Jan',
  'Feb',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const baseSections: ScoreSection[] = [
  {
    title: 'Performance',
    rows: [
      { label: 'KPI / OKR', monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { label: 'Tasks Based', monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { label: 'Quality', monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    ],
  },
  {
    title: 'Participation',
    rows: [
      { label: 'PLAY Attendance', monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { label: 'PLAY Winner', monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { label: 'LEARN Attendance', monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { label: 'HCM Sticker', monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    ],
  },
  {
    title: 'Popularity',
    rows: [
      { label: 'Gratitude sticker', monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { label: 'Voting form', monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    ],
  },
];

const scoreByEmployee: Record<string, ScoreSection[]> = {
  'u-001': baseSections,
  'u-002': baseSections,
  'u-003': baseSections,
  'u-004': baseSections,
  'u-005': baseSections,
  'u-006': baseSections,
};

const employeeIdByName: Record<string, string> = {
  'zulaikha razak': 'u-001',
  'nurul ain': 'u-002',
  'ahmad faris': 'u-003',
  'hafiz zulkifli': 'u-004',
  'siti rahmah': 'u-005',
  'mohd azri': 'u-006',
  'firdaus hamzah': 'u-007',
  'aqilah nordin': 'u-008',
  'hakim iskandar': 'u-009',
};

function cloneSections(sections: ScoreSection[]): ScoreSection[] {
  return sections.map(section => ({
    title: section.title,
    rows: section.rows.map(row => ({ label: row.label, monthly: [...row.monthly] })),
  }));
}

export function getPerformanceSections(userId: string): ScoreSection[] {
  return cloneSections(scoreByEmployee[userId] || scoreByEmployee['u-001'] || baseSections);
}

export function resolveEmployeeIdByName(name: string): string {
  const normalized = name.trim().toLowerCase();
  return employeeIdByName[normalized] || 'u-002';
}

export function sectionsToCellMap(sections: ScoreSection[]): Record<string, number> {
  const map: Record<string, number> = {};
  sections.forEach(section => {
    section.rows.forEach(row => {
      PERFORMANCE_MONTHS.forEach((month, monthIdx) => {
        map[`${row.label}::${month}`] = row.monthly[monthIdx] || 0;
      });
    });
  });
  return map;
}

export function cellMapToSections(templateSections: ScoreSection[], cellMap: Record<string, number>): ScoreSection[] {
  return templateSections.map(section => ({
    title: section.title,
    rows: section.rows.map(row => ({
      label: row.label,
      monthly: PERFORMANCE_MONTHS.map(month => cellMap[`${row.label}::${month}`] || 0),
    })),
  }));
}
