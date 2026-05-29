import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { prisma } from './src/lib/prisma';
import { ensureBalancesForEmployee } from './src/models/leaveManagementModel';

async function fixAndVerify() {
  await prisma.employee_leave_entitlements.update({
    where: { id: 'OVER-u-1778485904766-AL_CARRY-2026' },
    data: { override_days: '5', updated_at: new Date() }
  });

  await ensureBalancesForEmployee('u-1778485904766', 2026);

  const balance = await prisma.leave_balances.findFirst({
    where: {
      employee_id: 'u-1778485904766',
      leave_type_code: 'AL',
      balance_year: 2026
    }
  });

  console.log('Balance AL CF is now:', balance?.carry_forward_days);
}

fixAndVerify();
