import { NextRequest, NextResponse } from 'next/server';
import {
  clearAllNotificationsController,
  getEmployeeNotificationsController,
  markNotificationReadController,
} from '@/controllers/notificationController';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    const data = await getEmployeeNotificationsController(employeeId);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body?.action || 'mark-read';

    if (action === 'mark-read') {
      const notificationId = body?.notificationId;
      if (!notificationId) {
        return NextResponse.json({ error: 'notificationId is required' }, { status: 400 });
      }

      await markNotificationReadController(notificationId);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === 'clear-all') {
      const employeeId = body?.employeeId;
      if (!employeeId) {
        return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
      }

      await clearAllNotificationsController(employeeId);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
