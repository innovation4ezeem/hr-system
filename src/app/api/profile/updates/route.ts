import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/apiAuth';
import { listPendingProfileUpdates } from '@/models/profileUpdateModel';
import { listUsers } from '@/models/userModel';

export async function GET(request: NextRequest) {
  try {
    const auth = requireRole(request, ['admin']);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'all';

    if (mode === 'pending') {
      const requests = await listPendingProfileUpdates();
      const users = await listUsers();
      
      // Map user names to requests for better UI
      const enrichedRequests = requests.map(req => {
        const user = users.find(u => u.id === req.employeeId);
        return {
          ...req,
          employeeName: user?.name || 'Unknown',
        };
      });

      return NextResponse.json({ requests: enrichedRequests }, { status: 200 });
    }

    return NextResponse.json({ requests: [] }, { status: 200 });
  } catch (error) {
    console.error('List profile updates error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
