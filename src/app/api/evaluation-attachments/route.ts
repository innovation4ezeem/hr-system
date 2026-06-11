import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import path from 'path';
import { readFile } from 'fs/promises';

function getMimeTypeFromFileName(name: string) {
  const ext = (path.extname(name) || '').toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Attachment id is required' }, { status: 400 });
    }

    const rec = await prisma.evaluation_attachments.findUnique({ where: { id } });
    if (!rec) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const fileUrl: string = rec.file_url || '';
    const fileName = rec.file_name || 'attachment';

    if (fileUrl.startsWith('data:')) {
      // data URL: data:<mime>;base64,<base64data>
      const parts = fileUrl.split(',');
      if (parts.length !== 2) {
        return NextResponse.json({ error: 'Invalid data URL' }, { status: 500 });
      }
      const meta = parts[0];
      const base64 = parts[1];
      const match = meta.match(/data:([^;]+);base64/);
      const mime = match ? match[1] : getMimeTypeFromFileName(fileName);
      const buffer = Buffer.from(base64, 'base64');

      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(buffer.length),
          'Content-Disposition': `inline; filename="${fileName}"`,
        },
      });
    }

    // If fileUrl is a relative path under /uploads, serve the file from public
    if (fileUrl.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), 'public', fileUrl.replace(/^\//, ''));
      try {
        const fileBuffer = await readFile(filePath);
        const mime = getMimeTypeFromFileName(fileName);
        return new Response(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': mime,
            'Content-Length': String(fileBuffer.length),
            'Content-Disposition': `inline; filename="${fileName}"`,
          },
        });
      } catch (err) {
        console.error('[evaluation-attachments] Failed to read file from disk:', err);
        return NextResponse.json({ error: 'Failed to read attachment file' }, { status: 500 });
      }
    }

    // Otherwise return redirect to the stored URL (could be external)
    return NextResponse.redirect(fileUrl);
  } catch (err) {
    console.error('[evaluation-attachments] GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
