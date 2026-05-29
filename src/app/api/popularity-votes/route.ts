import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getRequestUserId } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/models/userModel';
import { createActivityScoreController } from '@/controllers/activityScoreController';
import { getCache, setCache, clearCachePattern } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (!month) {
      return NextResponse.json({ error: 'Missing month parameter' }, { status: 400 });
    }

    const auth = requireRole(request, ['admin', 'hod', 'director', 'employee', 'intern', 'probation']);
    if (auth.response) return auth.response;

    const cacheKey = `popularity-votes:${month}`;
    const cached = await getCache<any[]>(cacheKey);
    if (cached !== null) {
      return NextResponse.json({ votes: cached });
    }

    const votes = await prisma.popularity_votes.findMany({
      where: { month },
      orderBy: { created_at: 'desc' },
      take: 500 // Limit to avoid massive payloads
    });

    await setCache(cacheKey, votes, 60);
    return NextResponse.json({ votes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['admin', 'hod', 'director', 'employee', 'intern', 'probation']);
    if (auth.response) return auth.response;

    const voterId = getRequestUserId(request);
    if (!voterId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { targetEmployeeId, month } = body;

    if (!targetEmployeeId || !month) {
      return NextResponse.json({ error: 'Missing targetEmployeeId or month' }, { status: 400 });
    }

    const voter = await getUser(voterId);
    if (!voter) return NextResponse.json({ error: 'Voter not found' }, { status: 404 });

    if (voter.id === targetEmployeeId) {
      return NextResponse.json({ error: 'You cannot vote for yourself' }, { status: 400 });
    }

    // Enforce 3 votes per month
    const existingVotes = await prisma.popularity_votes.count({
      where: { voter_id: voter.id, month }
    });

    if (existingVotes >= 3) {
      return NextResponse.json({ error: 'You have already used your 3 stickers for this month.' }, { status: 400 });
    }

    const targetUser = await getUser(targetEmployeeId);
    if (!targetUser) return NextResponse.json({ error: 'Target employee not found' }, { status: 404 });

    // Calculate points and assign exact sticker bucket
    let points = 0;
    let bucket = 'Executive sticker';

    if (voter.role === 'intern' || voter.role === 'probation') {
      points = 5;
      bucket = 'Intern & Probators sticker';
    } else if (voter.role === 'employee') {
      points = 10;
      bucket = 'Executive sticker';
    } else if (voter.role === 'hod') {
      points = 15;
      bucket = 'HOD sticker';
    } else if (voter.role === 'director' || voter.role === 'admin') {
      points = 40;
      bucket = 'Director sticker';
    }

    // Save vote and clear cache for this month
    const vote = await prisma.popularity_votes.create({
      data: {
        id: crypto.randomUUID(),
        voter_id: voter.id,
        voter_name: voter.name,
        voter_role: voter.role,
        target_employee_id: targetUser.id,
        target_employee_name: targetUser.name,
        points,
        month
      }
    });
    await clearCachePattern(`popularity-votes:${month}`);

    const monthParts = month.split(' ');
    const monthName = monthParts[0] || 'Jan';
    const yearStr = monthParts[1] || new Date().getFullYear().toString();

    // Run the heavy scoring updates and notification triggers in the background 
    // so the vote submission is near-instant for the user.
    createActivityScoreController({
      id: vote.id,
      activityName: `Live Popularity Vote from ${voter.name}`,
      date: new Date().toISOString().split('T')[0],
      year: parseInt(yearStr, 10),
      month: monthName,
      category: 'Popularity',
      scoreBucket: bucket,
      score: points,
      assignedToId: targetUser.id,
      assignedToName: targetUser.name,
      sourceFolder: 'Live Popularity',
      updatedBy: voter.name,
      description: 'Awarded via Live Popularity Dashboard'
    }).catch(err => {
      console.error('[popularity-votes] Background score synchronization failed:', err);
    });

    return NextResponse.json({ success: true, vote });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
