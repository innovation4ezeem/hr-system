import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { prisma } from './src/lib/prisma';

async function main() {
  const requests = await prisma.leave_requests.findMany({
    where: { status: 'approved' },
    include: { leave_calendar_entries: true }
  });

  const missing = requests.filter(r => !r.leave_calendar_entries);
  console.log(`Found ${missing.length} approved leave requests missing calendar entries.`);

  for (const req of missing) {
    await prisma.leave_calendar_entries.create({
      data: {
        id: `LCAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        request_id: req.id,
        employee_id: req.employee_id,
        employee_name: req.employee_name,
        leave_type_code: req.leave_type,
        start_date: req.start_date,
        end_date: req.end_date,
        units: req.units,
        created_at: new Date()
      }
    });
  }

  console.log('Finished inserting missing calendar entries.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
