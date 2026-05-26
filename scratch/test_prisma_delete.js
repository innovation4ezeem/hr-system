const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const fs = require('fs');
const path = require('path');

try {
  const envContent = fs.readFileSync('c:/Users/weish/Downloads/hr-system/.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let val = parts.slice(1).join('=').trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
      process.env[key] = val;
    }
  });
} catch (err) { console.error("Failed to load .env:", err.message); }

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set"); return; }
  const urlObj = new URL(url);
  const adapter = new PrismaMariaDb({
    host: urlObj.hostname, port: parseInt(urlObj.port) || 3306,
    user: decodeURIComponent(urlObj.username), password: decodeURIComponent(urlObj.password),
    database: urlObj.pathname.substring(1), connectionLimit: 5,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    // Check if there's any foreign key constraint that fails when we try to delete an activity score entry
    const existing = await prisma.activity_score_entries.findFirst();
    if (!existing) {
      console.log("No entries found");
      return;
    }
    console.log("Found entry to test delete:", existing.id);
    
    // Instead of actually deleting, we just want to know if there's a Prisma error
    // We can wrap it in a transaction that always rolls back, or just do a manual test.
    // Let's actually delete one and see what happens (we can restore it, or just let it be deleted)
    // Actually, maybe the error is in the NextRequest `.clone()`?
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(console.error);
