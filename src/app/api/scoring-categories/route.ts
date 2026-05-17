import { NextRequest, NextResponse } from 'next/server';
import {
  getScoringCategoriesController,
  saveScoringCategoriesController,
} from '@/controllers/scoringCategoryController';
import { assertWritableYear } from '@/lib/archivePolicy';

function parseYear(value: string | null) {
  const year = Number(value);
  if (!Number.isInteger(year)) return new Date().getFullYear();
  return year;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseYear(searchParams.get('year'));
    const categories = await getScoringCategoriesController(year);
    return NextResponse.json({ categories }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const year = parseYear(String(body?.year || ''));
    const categories = body?.categories;

    if (!Array.isArray(categories)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    assertWritableYear(year);

    await saveScoringCategoriesController(year, categories);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
