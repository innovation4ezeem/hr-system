const fs = require('fs');
const path = require('path');

// Manually parse .env
try {
  const envContent = fs.readFileSync('c:/Users/weish/Downloads/hr-system/.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let val = parts.slice(1).join('=').trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      if (val.startsWith("'") && val.endsWith("'")) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  });
} catch (err) {
  console.error("Failed to load .env manually:", err.message);
}

const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

async function main() {
  const url = process.env.DATABASE_URL;
  console.log("DATABASE_URL is:", url ? "SET (length: " + url.length + ")" : "NOT SET");
  if (!url) return;

  const urlObj = new URL(url);
  const poolConfig = {
    host: urlObj.hostname,
    port: parseInt(urlObj.port) || 3306,
    user: decodeURIComponent(urlObj.username),
    password: decodeURIComponent(urlObj.password),
    database: urlObj.pathname.substring(1),
    connectionLimit: 10,
  };
  
  const adapter = new PrismaMariaDb(poolConfig);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Starting DB Repair for inconsistent half-day requests...");

    // Find all leave requests where session is 'AM' or 'PM'
    const halfDayRequests = await prisma.leave_requests.findMany({
      where: {
        session: { in: ['AM', 'PM'] },
        status: { in: ['pending', 'approved'] }
      }
    });

    console.log(`Found ${halfDayRequests.length} active half-day requests.`);

    for (const req of halfDayRequests) {
      console.log(`\nReviewing Request: ${req.id} (Employee: ${req.employee_name}, Type: ${req.leave_type}, Session: ${req.session}, Units: ${req.units})`);
      
      const slots = await prisma.leave_request_days.findMany({
        where: { request_id: req.id }
      });

      console.log(`Current locked slots count: ${slots.length}`);
      slots.forEach(s => console.log(` - Slot: ${s.slot}, Date: ${s.leave_date}`));

      // If session is AM, we should only have AM slot locked
      // If session is PM, we should only have PM slot locked
      const incorrectSlot = req.session === 'AM' ? 'PM' : 'AM';
      
      const hasIncorrectSlot = slots.some(s => s.slot === incorrectSlot);
      if (hasIncorrectSlot) {
        console.log(`-> Inconsistency found! Deleting slot '${incorrectSlot}' for request '${req.id}'`);
        
        // Delete incorrect slot
        const deleteRes = await prisma.leave_request_days.deleteMany({
          where: {
            request_id: req.id,
            slot: incorrectSlot
          }
        });
        console.log(`    Deleted slots count: ${deleteRes.count}`);

        // Update units of the slot to 0.5 in leave_request_days for the remaining slot if needed
        await prisma.leave_request_days.updateMany({
          where: {
            request_id: req.id,
            slot: req.session
          },
          data: {
            units: 0.5
          }
        });

        // Update units in leave_requests table
        if (Number(req.units) !== 0.5) {
          console.log(`-> Updating leave_requests.units to 0.5 (was ${req.units})`);
          await prisma.leave_requests.update({
            where: { id: req.id },
            data: { units: 0.5 }
          });
          
          // Refund 0.5 days back to the employee's balance!
          const balance = await prisma.leave_balances.findFirst({
            where: {
              employee_id: req.employee_id,
              leave_type_code: req.leave_type,
              balance_year: 2026 // assuming year 2026 as per our findings
            }
          });
          
          if (balance) {
            const currentUsed = Number(balance.used_days || 0);
            const newUsed = Math.max(0, currentUsed - 0.5);
            console.log(`-> Updating leave_balances for ${req.employee_name} (${req.leave_type}): used_days ${currentUsed} -> ${newUsed}`);
            await prisma.leave_balances.update({
              where: { id: balance.id },
              data: { used_days: newUsed }
            });
          }
        }
      } else {
        console.log(`-> Request ${req.id} is consistent.`);
      }
    }

    console.log("\nRepair completed successfully.");
  } catch (e) {
    console.error("Repair failed:", e);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
