import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getRequestUserId, getRequestDepartment } from '@/lib/apiAuth';
import { 
  listEvaluationAttachments, 
  createEvaluationAttachment, 
  deleteEvaluationAttachment, 
  getSelfEvaluation, 
  upsertSelfEvaluation,
  listPerformanceComments,
  createPerformanceComment,
  deletePerformanceComment
} from '@/models/evaluationModel';
import { listUsers, getUser } from '@/models/userModel';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'reflections';
    const employeeId = searchParams.get('employeeId');
    const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
    const defaultPeriodLabel = `Q${currentQuarter} ${new Date().getFullYear()}`;
    const periodLabel = searchParams.get('periodLabel') || defaultPeriodLabel;

    const auth = requireRole(request, ['employee', 'hod', 'admin', 'intern', 'probation']);
    if (auth.response) return auth.response;

    const requesterId = getRequestUserId(request);
    
    // Authorization check
    let targetId = employeeId;
    if (auth.role === 'employee' || auth.role === 'intern' || auth.role === 'probation') {
      targetId = requesterId;
    }

    if (mode === 'attachments') {
      const attachments = await listEvaluationAttachments(targetId || undefined);
      return NextResponse.json({ attachments });
    }
    
    if (mode === 'reflections') {
      if (!targetId) return NextResponse.json({ error: 'employeeId is required for reflections' }, { status: 400 });
      const evaluation = await getSelfEvaluation(targetId, periodLabel);
      return NextResponse.json({ evaluation });
    }
    
    if (mode === 'comments') {
      if (!targetId) return NextResponse.json({ error: 'employeeId is required for comments' }, { status: 400 });
      const comments = await listPerformanceComments(targetId, periodLabel);
      return NextResponse.json({ comments });
    }

    if (mode === 'employees') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;
      
      const dept = getRequestDepartment(request);
      const allUsers = await listUsers();
      
      // Filtering: 
      // 1. Only active users
      // 2. Only employee roles (exclude Admins/HODs from the evaluation list itself unless Admin)
      // 3. Match department if requester is HOD
      const filtered = allUsers.filter(u => {
        const isActive = u.status === 'active';
        const isEmployeeRole = u.role === 'employee' || u.role === 'intern' || u.role === 'probation';
        const matchesDept = !dept || u.dept === dept;
        
        if (auth.role === 'admin') {
          return isActive && isEmployeeRole; // Admins see all employees
        }
        return isActive && isEmployeeRole && matchesDept; // HODs see their dept employees
      });
      
      return NextResponse.json({ employees: filtered.map(u => ({ id: u.id, name: u.name })) });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('Evaluations GET error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const auth = requireRole(request, ['employee', 'hod', 'admin', 'intern', 'probation']);
    if (auth.response) return auth.response;

    const requesterId = getRequestUserId(request);
    const requesterName = requesterId; // Ideally get name from auth or profiles

    if (action === 'upsert-reflection') {
      const { employeeId, periodLabel, reflection, hodComment } = body;
      
      // Employees can only save their own reflection
      if (auth.role === 'employee' && employeeId !== requesterId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      const result = await upsertSelfEvaluation({
        employeeId,
        periodLabel,
        reflection: reflection || '',
        hodComment: hodComment || '',
      });
      return NextResponse.json({ evaluation: result });
    }

    if (action === 'create-attachment') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;

      const { employeeId, fileName, fileUrl, note } = body;
      const result = await createEvaluationAttachment({
        employeeId,
        fileName,
        fileUrl: fileUrl || '#',
        note: note || '',
        uploadedBy: requesterId || 'HOD',
      });
      return NextResponse.json({ attachment: result });
    }

    if (action === 'delete-attachment') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;

      const { id } = body;
      await deleteEvaluationAttachment(id);
      return NextResponse.json({ success: true });
    }

    if (action === 'post-comment') {
      const { employeeId, periodLabel, content } = body;
      if (!employeeId || !content) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }
      
      // Get actual author name from DB if possible
      let authorName = requesterId || 'User';
      if (requesterId) {
        const profile = await getUser(requesterId);
        if (profile?.name) authorName = profile.name;
      }

      try {
        const result = await createPerformanceComment({
          employeeId,
          periodLabel: periodLabel || `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`,
          content,
          authorId: requesterId || 'System',
          authorName: authorName,
        });
        return NextResponse.json({ comment: result });
      } catch (dbErr) {
        console.error('post-comment: DB Error', dbErr);
        return NextResponse.json({ 
          error: 'Database Error: Ensure the performance_comments table exists in MySQL. Check your Prisma migrations or database schema.' 
        }, { status: 500 });
      }
    }

    if (action === 'delete-comment') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
      try {
        const result = await deletePerformanceComment(id);
        if (result.count === 0) {
          return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true });
      } catch (err) {
        console.error('delete-comment Error:', err);
        return NextResponse.json({ error: 'Database error during deletion' }, { status: 500 });
      }
    }

    if (action === 'update-general-settings') {
      const auth = requireRole(request, ['hod', 'admin']);
      if (auth.response) return auth.response;

      const { performanceFormUrl, performanceFormLabel, evaluationSections } = body;
      const { getSystemSettings, saveSystemSettings } = await import('@/models/systemSettingsModel');
      const settings = await getSystemSettings();
      
      settings.general.performanceFormUrl = performanceFormUrl !== undefined ? performanceFormUrl : settings.general.performanceFormUrl;
      settings.general.performanceFormLabel = performanceFormLabel !== undefined ? performanceFormLabel : settings.general.performanceFormLabel;
      
      if (evaluationSections !== undefined) {
        settings.general.evaluationSections = evaluationSections;
      }
      
      await saveSystemSettings(settings);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Evaluations POST error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
