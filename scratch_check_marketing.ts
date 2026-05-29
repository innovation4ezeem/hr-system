import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { prisma } from './src/lib/prisma';

async function main() {
  const entries = await prisma.leave_calendar_entries.findMany({
    where: {
      leave_requests: {
        dept: 'Marketing'
      }
    },
    include: {
      leave_requests: true
    }
  });

  console.log(`Found ${entries.length} calendar entries for Marketing department.`);
  if (entries.length > 0) {
    console.log('Sample entry:', entries[0]);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
