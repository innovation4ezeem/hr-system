import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { requireRole, getRequestUserId } from '@/lib/apiAuth';
import { access, constants } from 'fs/promises';
import { createEvaluationAttachment } from '@/models/evaluationModel';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Check if we can write to the local filesystem (development environment)
 */
async function canWriteToFilesystem(): Promise<boolean> {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    await access(publicDir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save file to local filesystem (development only)
 */
async function saveToFilesystem(buffer: Buffer, fileName: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'leave');
  await mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, fileName);
  await writeFile(filePath, buffer);
  return `/uploads/leave/${fileName}`;
}

/**
 * Generate file data URL for production (when filesystem not available)
 * This converts the file to a base64 data URL that can be stored and retrieved
 */
function generateDataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireRole(request, ['employee', 'director', 'hod', 'admin', 'intern', 'probation']);
    if (auth.response) return auth.response;

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only PDF, JPG, and PNG files are allowed' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size must be 5MB or less' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const extension = path.extname(file.name) || (file.type === 'application/pdf' ? '.pdf' : file.type === 'image/png' ? '.png' : '.jpg');
    const safeName = sanitizeFileName(path.basename(file.name, extension));
    const fileName = `${Date.now()}-${Math.floor(Math.random() * 100000)}-${safeName}${extension}`;

    let filePath: string;

    // Try to save to filesystem first (development environment)
    const canWrite = await canWriteToFilesystem();
    if (canWrite) {
      try {
        filePath = await saveToFilesystem(buffer, fileName);
        console.log(`[leave-attachments] File saved to filesystem: ${filePath}`);
      } catch (fsError) {
        console.warn(`[leave-attachments] Filesystem write failed, attempting DB persist:`, fsError);
        // Try to persist in DB instead of returning data URL
        const dataUrl = generateDataUrl(buffer, file.type);
        try {
          const employeeId = getRequestUserId(request) || 'unknown';
          const attachment = await createEvaluationAttachment({
            employeeId,
            fileName: file.name,
            fileUrl: dataUrl,
            note: '',
            uploadedBy: employeeId,
          });
          filePath = `/api/evaluation-attachments?id=${attachment.id}`;
          console.log(`[leave-attachments] Attachment persisted with id=${attachment.id}`);
        } catch (dbErr) {
          console.error('[leave-attachments] Failed to persist attachment in DB after FS write failure:', dbErr);
          return NextResponse.json({ error: 'Failed to store attachment. Please contact administrator.' }, { status: 503 });
        }
      }
    } else {
      // Production environment - persist attachment in DB (do not return raw data URLs)
      console.warn(`[leave-attachments] Filesystem not writable. Persisting attachment record for file: ${fileName}`);
      const dataUrl = generateDataUrl(buffer, file.type);

      // Persist attachment in DB so we can serve it later via a short URL
      try {
        const employeeId = getRequestUserId(request) || 'unknown';
        const attachment = await createEvaluationAttachment({
          employeeId,
          fileName: file.name,
          fileUrl: dataUrl,
          note: '',
          uploadedBy: employeeId,
        });

        // Return a short URL that points to our new attachment GET endpoint
        filePath = `/api/evaluation-attachments?id=${attachment.id}`;
        console.log(`[leave-attachments] Attachment persisted with id=${attachment.id}`);
      } catch (dbErr) {
        console.error('[leave-attachments] Failed to persist attachment in DB:', dbErr);
        return NextResponse.json({ error: 'Failed to store attachment. Please contact administrator.' }, { status: 503 });
      }
    }

    return NextResponse.json(
      {
        success: true,
        attachment: {
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          path: filePath,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[leave-attachments] Upload error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
