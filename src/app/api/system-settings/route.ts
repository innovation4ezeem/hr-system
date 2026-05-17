import { NextRequest, NextResponse } from 'next/server';
import {
  getSystemSettingsController,
  saveSystemSettingsController,
} from '@/controllers/systemSettingsController';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    const settings = await getSystemSettingsController();

    if (mode === 'weights') {
      return NextResponse.json({
        weights: settings.performanceWeights,
        formulaName: settings.performanceFormula.name,
        formulaExpression: settings.performanceFormula.expression,
      }, { status: 200 });
    }

    if (mode === 'thresholds') {
      return NextResponse.json({ thresholds: settings.performanceThresholds }, { status: 200 });
    }

    return NextResponse.json({ settings }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body?.action;
    const actor = body?.actor ? String(body.actor) : 'admin';

    if (action === 'save-weights') {
      const settings = await getSystemSettingsController();
      const updated = await saveSystemSettingsController(
        {
          ...settings,
          performanceWeights: body.weights,
          performanceFormula: {
            ...settings.performanceFormula,
            name: body.formulaName ?? settings.performanceFormula.name,
            expression: body.formulaExpression ?? settings.performanceFormula.expression,
          },
        },
        actor
      );
      return NextResponse.json({
        weights: updated.performanceWeights,
        formulaName: updated.performanceFormula.name,
        formulaExpression: updated.performanceFormula.expression,
      }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const actor = body?.triggeredBy ? String(body.triggeredBy) : 'admin';
    const payload = body?.settings && typeof body.settings === 'object' ? body.settings : body;
    const settings = await saveSystemSettingsController(payload || {}, actor);
    return NextResponse.json({ settings }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
