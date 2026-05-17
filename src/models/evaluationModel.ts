import { prisma } from '@/lib/prisma';
import { randomId } from '@/lib/utils';

export interface EvaluationAttachment {
  id: string;
  employeeId: string;
  fileName: string;
  fileUrl: string;
  note: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface SelfEvaluation {
  id: string;
  employeeId: string;
  periodLabel: string;
  reflection: string;
  hodComment: string;
  savedAt: string;
}

export interface PerformanceComment {
  id: string;
  employeeId: string;
  periodLabel: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export async function listEvaluationAttachments(employeeId?: string): Promise<EvaluationAttachment[]> {
  const data = await prisma.evaluation_attachments.findMany({
    where: employeeId ? { employee_id: employeeId } : undefined,
    orderBy: { uploaded_at: 'desc' }
  });

  return (data || []).map(row => ({
    id: row.id,
    employeeId: row.employee_id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    note: row.note || '',
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at.toISOString(),
  }));
}

export async function createEvaluationAttachment(attachment: Omit<EvaluationAttachment, 'id' | 'uploadedAt'>) {
  const id = randomId('EATT');
  const now = new Date();
  const data = await prisma.evaluation_attachments.create({
    data: {
      id,
      employee_id: attachment.employeeId,
      file_name: attachment.fileName,
      file_url: attachment.fileUrl,
      note: attachment.note,
      uploaded_by: attachment.uploadedBy,
      uploaded_at: now
    }
  });

  return data;
}

export async function deleteEvaluationAttachment(id: string) {
  await prisma.evaluation_attachments.delete({
    where: { id }
  });
}

export async function getSelfEvaluation(employeeId: string, periodLabel: string): Promise<SelfEvaluation | null> {
  const data = await prisma.self_evaluations.findFirst({
    where: {
      employee_id: employeeId,
      period_label: periodLabel
    }
  });

  if (!data) return null;

  return {
    id: data.id,
    employeeId: data.employee_id,
    periodLabel: data.period_label,
    reflection: data.reflection || '',
    hodComment: data.hod_comment || '',
    savedAt: data.saved_at.toISOString(),
  };
}

export async function upsertSelfEvaluation(evalData: Omit<SelfEvaluation, 'id' | 'savedAt'>) {
  const existing = await prisma.self_evaluations.findFirst({
    where: {
      employee_id: evalData.employeeId,
      period_label: evalData.periodLabel
    }
  });

  const id = existing?.id || randomId('SEVAL');
  const now = new Date();

  const data = await prisma.self_evaluations.upsert({
    where: { id },
    update: {
      reflection: evalData.reflection,
      hod_comment: evalData.hodComment,
      saved_at: now
    },
    create: {
      id,
      employee_id: evalData.employeeId,
      period_label: evalData.periodLabel,
      reflection: evalData.reflection,
      hod_comment: evalData.hodComment,
      saved_at: now
    }
  });

  return data;
}

export async function listPerformanceComments(employeeId: string, periodLabel: string): Promise<PerformanceComment[]> {
  const data = await prisma.performance_comments.findMany({
    where: {
      employee_id: employeeId,
      period_label: periodLabel
    },
    orderBy: { created_at: 'asc' }
  });

  return (data || []).map(row => ({
    id: row.id,
    employeeId: row.employee_id,
    periodLabel: row.period_label,
    authorId: row.author_id,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function createPerformanceComment(comment: Omit<PerformanceComment, 'id' | 'createdAt'>) {
  const id = randomId('PCMT');
  const now = new Date();
  const data = await prisma.performance_comments.create({
    data: {
      id,
      employee_id: comment.employeeId,
      period_label: comment.periodLabel,
      author_id: comment.authorId,
      author_name: comment.authorName,
      content: comment.content,
      created_at: now
    }
  });

  return data;
}

export async function deletePerformanceComment(id: string) {
  try {
    return await prisma.performance_comments.deleteMany({
      where: { id }
    });
  } catch (err) {
    // Log to a file for diagnosis
    const fs = require('fs');
    fs.appendFileSync('scratch/db_errors.log', `[${new Date().toISOString()}] Delete Comment ${id} Error: ${err}\n`);
    throw err;
  }
}
