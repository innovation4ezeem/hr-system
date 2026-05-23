import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemSettings } from '@/models/systemSettingsModel';
import { runYearEndArchiveController } from '@/controllers/yearEndArchiveController';
import { sendDualNotification } from '@/controllers/notificationController';

async function handleSchedulerCheck(simulatedStr: string) {
  let today = new Date();
  if (simulatedStr) {
    today = new Date(simulatedStr);
    if (isNaN(today.getTime())) {
      return { status: 400, data: { error: `Invalid date format: "${simulatedStr}"` } };
    }
  }

  // Calculate UTC today at midnight
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  // Fetch settings
  const settings = await getSystemSettings();
  const { autoBackupEnabled, autoBackupDay, autoBackupMonth } = settings.maintenance;

  // Target backup date for the current year
  const targetYear = today.getFullYear();
  const utcTarget = Date.UTC(targetYear, autoBackupMonth - 1, autoBackupDay);

  // Calculate diff in days
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((utcTarget - utcToday) / msPerDay);

  const scheduledBackupStr = `${targetYear}-${String(autoBackupMonth).padStart(2, '0')}-${String(autoBackupDay).padStart(2, '0')}`;

  let actionTaken = 'none';
  let message = '';

  if (autoBackupEnabled) {
    if (diffDays === 3) {
      actionTaken = 'warning-reminder';
      message = `Calculated diffDays is exactly 3. Triggered 3-day pre-due-date reminders to all active administrators.`;

      // Get active admins
      const admins = await prisma.users.findMany({
        where: { role: 'admin', status: 'active' }
      });

      for (const admin of admins) {
        try {
          await sendDualNotification({
            recipientId: admin.id,
            recipientEmail: admin.email,
            type: 'system-backup-warning',
            title: `Upcoming Automated Year-End Backup Warning`,
            emailMessage: `The scheduled automated year-end backup & archive for year ${targetYear} is due in 3 days on ${scheduledBackupStr}. Please ensure all active leave records and performance scoring are updated.`,
            inAppMessage: `Warning: Automated year-end backup & archive is due in 3 days on ${scheduledBackupStr}.`,
            relatedId: `backup-warn-${targetYear}`,
            provider: 'smtp'
          });
        } catch (err) {
          console.error(`Failed to send reminder notification to ${admin.email}:`, err);
        }
      }
    } else if (diffDays === 0) {
      actionTaken = 'auto-backup';
      
      // Check if already completed
      const existingRun = await prisma.archive_runs.findFirst({
        where: { from_year: targetYear }
      });

      if (existingRun) {
        message = `Automated backup scheduled for today, but an archive for year ${targetYear} has already been run. Skipping to prevent duplicate runs.`;
      } else {
        message = `Automated backup scheduled for today is triggered successfully. Executing year-end archive for year ${targetYear}.`;
        
        // Execute archive run
        await runYearEndArchiveController(targetYear, 'system-scheduler-auto-backup', { clearActive: true });

        // Notify active admins
        const admins = await prisma.users.findMany({
          where: { role: 'admin', status: 'active' }
        });

        for (const admin of admins) {
          try {
            await sendDualNotification({
              recipientId: admin.id,
              recipientEmail: admin.email,
              type: 'system-backup-completed',
              title: `Automated Year-End Backup Completed Successfully`,
              emailMessage: `The scheduled automated year-end backup & archive for year ${targetYear} has been executed successfully.`,
              inAppMessage: `Success: Scheduled automated year-end backup & archive has completed successfully.`,
              relatedId: `backup-done-${targetYear}`,
              provider: 'smtp'
            });
          } catch (err) {
            console.error(`Failed to send completion notification to ${admin.email}:`, err);
          }
        }
      }
    } else {
      message = `Automated backup is enabled, but no action was needed. Today is ${today.toISOString().split('T')[0]}, due date is ${scheduledBackupStr} (${diffDays} days remaining).`;
    }
  } else {
    message = `Automated backup scheduler is disabled in system settings. Today is ${today.toISOString().split('T')[0]}, due date is ${scheduledBackupStr} (${diffDays} days remaining).`;
  }

  return {
    status: 200,
    data: {
      success: true,
      simulated: !!simulatedStr,
      simulatedDate: simulatedStr || null,
      today: today.toISOString().split('T')[0],
      scheduledDate: scheduledBackupStr,
      diffDays,
      autoBackupEnabled,
      actionTaken,
      message
    }
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const simulatedStr = searchParams.get('simulatedDate') || searchParams.get('asOfDate') || '';
    const result = await handleSchedulerCheck(simulatedStr);
    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let simulatedStr = '';
    try {
      const body = await request.json();
      simulatedStr = body?.simulatedDate || body?.asOfDate || '';
    } catch {
      // No JSON body present
    }
    const result = await handleSchedulerCheck(simulatedStr);
    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
