import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: "System has migrated to Prisma/MySQL. Database setup is now managed via Prisma migrations." 
  });
}
