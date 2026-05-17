import { NextRequest, NextResponse } from 'next/server';
import {
  createDepartmentController,
  deleteDepartmentController,
  getDepartmentsController,
  updateDepartmentController,
} from '@/controllers/departmentController';

function getId(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return (searchParams.get('id') || '').trim();
}

export async function GET() {
  try {
    const departments = await getDepartmentsController();
    return NextResponse.json({ departments }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const department = await createDepartmentController(body || {});
    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const id = getId(request);
    const body = await request.json();
    const department = await updateDepartmentController(id, body || {});
    return NextResponse.json({ department }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = getId(request);
    await deleteDepartmentController(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
