import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { prisma } from './src/lib/prisma';
import { ensureBalancesForEmployee } from './src/models/leaveManagementModel';

async function fixAndVerify() {
  while (true) {
    try {
      console.log('Attempting to fix AL_CARRY...');
      
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

      const balance = await prisma.leave_balances.findFirst({
        where: {
          employee_id: 'u-1778485904766',
          leave_type_code: 'AL',
          balance_year: 2026
        }
      });

      console.log('SUCCESS! Balance AL CF is now:', balance?.carry_forward_days);
      break;
    } catch (err: any) {
      console.log('Failed:', err.message);
      console.log('Retrying in 5 seconds...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

fixAndVerify();
