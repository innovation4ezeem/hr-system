export const ACTIVITY_CATEGORIES = [
  'Performance',
  'Participation',
  'Popularity',
] as const;

export const ACTIVITY_SCORE_BUCKETS = [
  'KPI',
  'Tasks Based',
  'Quality',
  'PLAY Attendance',
  'PLAY Winner',
  'LEARN Attendance',
  'HCM Stickers',
  'Voting Form - Attitude (Initiative, Proactive, Voluntary)',
  'Voting Form - Continuous learner (sharpen the saw)',
  'Voting Form - Accountability (being responsible towards own responsibility)',
  'Voting Form - Innovative & Creativity',
  'Voting Form - Effective Collaborator',
  'Intern & Probators sticker',
  'Executive sticker',
  'HOD sticker',
  'Director sticker',
] as const;

export const STANDARD_MARKS: Record<string, number> = {
  'KPI': 10,
  'Tasks Based': 10,
  'Quality': 10,
  'PLAY Attendance': 10,
  'PLAY Winner': 10,
  'LEARN Attendance': 10,
  'HCM Stickers': 3,
  'Voting Form - Attitude (Initiative, Proactive, Voluntary)': 5,
  'Voting Form - Continuous learner (sharpen the saw)': 5,
  'Voting Form - Accountability (being responsible towards own responsibility)': 5,
  'Voting Form - Innovative & Creativity': 5,
  'Voting Form - Effective Collaborator': 5,
  'Intern & Probators sticker': 5,
  'Executive sticker': 10,
  'HOD sticker': 15,
  'Director sticker': 40,
};

export const ACTIVITY_MONTHS = [
  'January',
  'February',
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

export const DEFAULT_BUCKET_BY_CATEGORY: Record<string, string> = {
  Performance: 'KPI',
  Participation: 'PLAY Attendance',
  Popularity: 'Executive sticker',
};

export function bucketSectionTitle(bucket: string): string {
  const performanceBuckets = [
    'KPI',
    'Tasks Based',
    'Quality',
  ];
  const participationBuckets = [
    'PLAY Attendance',
    'PLAY Winner',
    'LEARN Attendance',
    'HCM Stickers',
  ];

  if (performanceBuckets.includes(bucket)) return 'Performance';
  if (participationBuckets.includes(bucket)) return 'Participation';
  return 'Popularity';
}

export function normalizeCategory(category: string): string {
  if (!category) return 'Performance';
  const cat = String(category);
  if ((ACTIVITY_CATEGORIES as unknown as string[]).includes(cat)) return cat;
  
  const lower = cat.toLowerCase();
  if (lower.includes('participation')) return 'Participation';
  if (lower.includes('popularity')) return 'Popularity';
  if (lower.includes('performance')) return 'Performance';
  
  // Legacy PLGT fallbacks
  if (lower.includes('activities') || lower.includes('play') || lower.includes('learn')) return 'Participation';
  
  return 'Performance';
}

export function normalizeScoreBucket(scoreBucket: string, category: string): string {
  if ((ACTIVITY_SCORE_BUCKETS as unknown as string[]).includes(scoreBucket)) {
    return scoreBucket;
  }

  const lower = scoreBucket.toLowerCase();
  if (lower.includes('kpi')) return 'KPI / OKR';
  if (lower.includes('activities (participation)')) return 'PLAY Attendance';
  if (lower.includes('play (attendance)')) return 'PLAY Attendance';
  if (lower.includes('learn (attendance)')) return 'LEARN Attendance';
  if (lower.includes('hcm sticker')) return 'HCM Sticker';
  if (lower.includes('gratitude')) return 'Gratitude sticker';

  return DEFAULT_BUCKET_BY_CATEGORY[category] || 'KPI / OKR';
}

export function round2(value: number) { 
  return Math.round(value * 100) / 100; 
}
