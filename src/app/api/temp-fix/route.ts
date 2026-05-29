import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureBalancesForEmployee } from '@/models/leaveManagementModel';

export async function GET(request: NextRequest) {
  try {
    const existing = await prisma.employee_leave_entitlements.findFirst({
      where: {
        employee_id: 'u-1778485904766',
        leave_type_code: 'AL_CARRY',
        balance_year: 2026
      }
    });

    if (existing) {
      await prisma.employee_leave_entitlements.update({
        where: { id: existing.id },
        data: { override_days: '5', updated_at: new Date() }
      });
    } else {
      await prisma.employee_leave_entitlements.create({
        data: {
          id: 'ent-vivian-al-carry-2026',
          employee_id: 'u-1778485904766',
          leave_type_code: 'AL_CARRY',
          balance_year: 2026,
          override_days: '5'
        }
      });
    }
    
    await ensureBalancesForEmployee('u-1778485904766', 2026);
    
    return NextResponse.json({ success: true, message: 'Fixed Vivian CF override and synced balances' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
