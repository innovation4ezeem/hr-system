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
import { prisma } from '@/lib/prisma';
import { upsertActivityScore, deleteActivityScore } from '@/models/activityScoreModel';
import { syncActivitiesIntoPerformanceSheet } from '@/controllers/activityScoreController';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'reflections';
    const employeeId = searchParams.get('employeeId');
    const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
    const defaultPeriodLabel = `Q${currentQuarter} ${new Date().getFullYear()}`;
    const periodLabel = searchParams.get('periodLabel') || defaultPeriodLabel;

    const auth = requireRole(request, ['employee', 'director', 'hod', 'admin', 'intern', 'probation']);
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

    if (mode === 'voting-candidates') {
      const allUsers = await listUsers();
      const filtered = allUsers.filter(u => u.status === 'active' && u.id !== requesterId);
      return NextResponse.json({ candidates: filtered.map(u => ({ id: u.id, name: u.name })) });
    }

    if (mode === 'votes') {
      const voterId = targetId || requesterId;
      if (!voterId) return NextResponse.json({ error: 'voterId is required' }, { status: 400 });

      const suffix = `-${periodLabel.replace(/\s+/g, '_')}`;
      const records = await prisma.activity_score_entries.findMany({
        where: {
          id: {
            startsWith: `VOTE-${voterId}-`,
            endsWith: suffix
          }
        }
      });

      const votes: Record<string, { candidateId: string; reason: string }> = {};
      const categoryKeys = ['accountability', 'sharpen_the_saw', 'innovative', 'collaboration', 'initiative'];

      for (const row of records) {
        const parts = row.id.split('-');
        if (parts.length >= 4) {
          const categoryKey = parts.find(p => categoryKeys.includes(p));
          if (categoryKey) {
            let reason = '';
            const desc = row.description || '';
            const match = desc.match(/Reason:\s*([\s\S]*)/);
            if (match) {
              reason = match[1];
            }
            votes[categoryKey] = {
              candidateId: row.assigned_to_id,
              reason: reason
            };
          }
        }
      }

      return NextResponse.json({ votes });
    }

    if (mode === 'employees') {
      const auth = requireRole(request, ['director', 'hod', 'admin']);
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

    const auth = requireRole(request, ['employee', 'director', 'hod', 'admin', 'intern', 'probation']);
    if (auth.response) return auth.response;

    const requesterId = getRequestUserId(request);
    const requesterName = requesterId; // Ideally get name from auth or profiles

    if (action === 'save-votes') {
      const { votes, periodLabel } = body;
      if (!periodLabel || !votes) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const voterId = requesterId;
      if (!voterId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const voterProfile = await getUser(voterId);
      const voterName = voterProfile?.name || voterId;

      const categoryMapping = {
        accountability: {
          bucketName: 'Voting Form - Accountability (being responsible towards own responsibility)',
          index: '1'
        },
        sharpen_the_saw: {
          bucketName: 'Voting Form - Continuous learner (sharpen the saw)',
          index: '2'
        },
        innovative: {
          bucketName: 'Voting Form - Innovative & Creativity',
          index: '3'
        },
        collaboration: {
          bucketName: 'Voting Form - Effective Collaborator',
          index: '4'
        },
        initiative: {
          bucketName: 'Voting Form - Attitude (Initiative, Proactive, Voluntary)',
          index: '5'
        }
      };

      for (const [key, mapping] of Object.entries(categoryMapping)) {
        const vote = votes[key];
        const recordId = `VOTE-${voterId}-${key}-${periodLabel.replace(/\s+/g, '_')}`;

        if (vote && vote.candidateId) {
          const candidateId = vote.candidateId;
          const reason = vote.reason || '';

          const candidateProfile = await getUser(candidateId);
          const candidateName = candidateProfile?.name || candidateId;

          const date = new Date().toISOString().split('T')[0];
          const year = new Date().getFullYear();
          const monthName = new Date().toLocaleString('en-US', { month: 'long' });

          await upsertActivityScore({
            id: recordId,
            activityName: mapping.bucketName,
            date,
            year,
            month: monthName,
            category: 'Popularity',
            scoreBucket: mapping.bucketName,
            score: 5,
            sourceFolder: 'Self Evaluation',
            description: reason ? `Reason: ${reason}` : '',
            assignedToId: candidateId,
            assignedToName: candidateName,
            attachmentName: '',
            attachmentUrl: '',
            updatedBy: 'Anonymous',
          });
        } else {
          try {
            await prisma.activity_score_entries.deleteMany({
              where: { id: recordId }
            });
          } catch (e) {
            // Ignore
          }
        }
      }
      
      syncActivitiesIntoPerformanceSheet(new Date().getFullYear()).catch(err => console.error('Background sync failed:', err));

      return NextResponse.json({ success: true });
    }

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

      // Auto-count PLGT Learn (Section 6) and PLGT PLAY (Section 7)
      try {
        if (reflection) {
          const parsed = JSON.parse(reflection);
          const employeeProfile = await getUser(employeeId);
          const employeeName = employeeProfile?.name || employeeId;
          const date = new Date().toISOString().split('T')[0];
          const year = new Date().getFullYear();
          const monthName = new Date().toLocaleString('en-US', { month: 'long' });
          const safePeriod = (periodLabel || '').replace(/\s+/g, '_');

          // Section 6: Attended Course -> LEARN Attendance
          const learnRecordId = `EVAL-LEARN-${employeeId}-${safePeriod}`;
          if (parsed.attendedCourse && parsed.attendedCourse.trim() !== '') {
            await upsertActivityScore({
              id: learnRecordId,
              activityName: 'LEARN Attendance',
              date,
              year,
              month: monthName,
              category: 'Participation',
              scoreBucket: 'LEARN Attendance',
              score: 10,
              sourceFolder: 'Self Evaluation',
              description: `Course: ${parsed.attendedCourse}`,
              assignedToId: employeeId,
              assignedToName: employeeName,
              attachmentName: parsed.courseCertName || '',
              attachmentUrl: parsed.courseCertUrl || '',
              updatedBy: 'System Auto-count',
            });
          } else {
            await prisma.activity_score_entries.deleteMany({ where: { id: learnRecordId } });
          }

          // Section 7: PLGT Play -> PLAY Attendance
          const playRecordId = `EVAL-PLAY-${employeeId}-${safePeriod}`;
          if (parsed.plgtPlay && parsed.plgtPlay.trim() !== '') {
            await upsertActivityScore({
              id: playRecordId,
              activityName: 'PLAY Attendance',
              date,
              year,
              month: monthName,
              category: 'Participation',
              scoreBucket: 'PLAY Attendance',
              score: 10,
              sourceFolder: 'Self Evaluation',
              description: `Event: ${parsed.plgtPlay}`,
              assignedToId: employeeId,
              assignedToName: employeeName,
              attachmentName: parsed.plgtPlayPhotoName || '',
              attachmentUrl: parsed.plgtPlayPhotoUrl || '',
              updatedBy: 'System Auto-count',
            });
          } else {
            await prisma.activity_score_entries.deleteMany({ where: { id: playRecordId } });
          }
        }
      } catch (err) {
        console.error('Failed to auto-count PLGT Learn/Play:', err);
      }
      
      syncActivitiesIntoPerformanceSheet(new Date().getFullYear()).catch(err => console.error('Background sync failed:', err));

      return NextResponse.json({ evaluation: result });
    }

    if (action === 'create-attachment') {
      const auth = requireRole(request, ['director', 'hod', 'admin']);
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
      const auth = requireRole(request, ['director', 'hod', 'admin']);
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
      const auth = requireRole(request, ['director', 'hod', 'admin']);
      if (auth.response) return auth.response;

      const {
        performanceFormUrl,
        performanceFormLabel,
        evaluationSections,
        showAttendedCourse,
        showColleagueVoting,
        courseTitle,
        courseDescription,
        votingTitle,
        votingDescription,
      } = body;
      const { getSystemSettings, saveSystemSettings } = await import('@/models/systemSettingsModel');
      const settings = await getSystemSettings();
      
      settings.general.performanceFormUrl = performanceFormUrl !== undefined ? performanceFormUrl : settings.general.performanceFormUrl;
      settings.general.performanceFormLabel = performanceFormLabel !== undefined ? performanceFormLabel : settings.general.performanceFormLabel;
      
      if (evaluationSections !== undefined) {
        settings.general.evaluationSections = evaluationSections;
      }

      if (showAttendedCourse !== undefined) {
        settings.general.showAttendedCourse = showAttendedCourse;
      }

      if (showColleagueVoting !== undefined) {
        settings.general.showColleagueVoting = showColleagueVoting;
      }
      
      if (courseTitle !== undefined) {
        settings.general.courseTitle = courseTitle;
      }
      if (courseDescription !== undefined) {
        settings.general.courseDescription = courseDescription;
      }
      if (votingTitle !== undefined) {
        settings.general.votingTitle = votingTitle;
      }
      if (votingDescription !== undefined) {
        settings.general.votingDescription = votingDescription;
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
