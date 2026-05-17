import { prisma } from '@/lib/prisma';

export type ScoringCategoryRecord = {
  id: string;
  name: string;
  weight: number;
  description: string;
  color: string;
  order: number;
};

export async function listScoringCategories(year: number): Promise<ScoringCategoryRecord[]> {
  const data = await prisma.scoring_categories.findMany({
    where: { year },
    orderBy: [
      { display_order: 'asc' },
      { created_at: 'asc' }
    ]
  });

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    weight: Number(row.weight || 0),
    description: row.description || '',
    color: row.color || '',
    order: Number(row.display_order || 0),
  }));
}

export async function replaceScoringCategories(year: number, categories: ScoringCategoryRecord[]) {
  // Use a transaction to ensure atomicity
  await prisma.$transaction(async (tx) => {
    // 1. Delete existing for this year
    await tx.scoring_categories.deleteMany({
      where: { year }
    });

    // 2. Insert new ones
    if (categories.length > 0) {
      const rows = categories.map((item) => ({
        year,
        id: item.id,
        name: item.name,
        weight: item.weight,
        description: item.description,
        color: item.color,
        display_order: item.order,
        created_at: new Date(),
        updated_at: new Date(),
      }));

      await tx.scoring_categories.createMany({
        data: rows
      });
    }
  });
}
