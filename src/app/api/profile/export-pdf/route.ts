import { NextRequest, NextResponse } from 'next/server';
import { listUsers } from '@/models/userModel';
import { getPerformanceSheetByYear } from '@/models/performanceScoreModel';

type ProfilePayload = {
  name: string;
  id: string;
  role: string;
  dept: string;
  joinDate: string;
  yearsService: number;
  monthsService: number;
  status: string;
  reportTo: string;
  email: string;
  phone: string;
  experiences: { year: string; title: string; dept: string; duration: string }[];
  rewards: { year: string; title: string; description: string }[];
  performanceHistory: { year: number; score: number; grade: string }[];
};

function sanitizeText(value: string) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim();
}

function calculateTenure(joinDate: string | null) {
  if (!joinDate) return { years: 0, months: 0 };
  const join = new Date(joinDate);
  const now = new Date();
  let years = now.getFullYear() - join.getFullYear();
  let months = now.getMonth() - join.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  return { years, months };
}

function getGrade(score: number) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

async function fetchRealProfile(employeeId: string): Promise<ProfilePayload> {
  const users = await listUsers();
  const user = users.find(u => u.id === employeeId);
  
  if (!user) {
    throw new Error('Employee not found');
  }

  const reportsTo = users.find(u => u.id === user.reportsToId);
  const tenure = calculateTenure(user.joinDate);

  // Fetch performance history for last 3 years
  const currentYear = new Date().getFullYear();
  const performanceHistory = [];
  for (let y = currentYear; y >= currentYear - 3; y--) {
    const sheet = await getPerformanceSheetByYear(y);
    if (sheet && sheet.cellsByEmployee[employeeId]) {
      const cells = sheet.cellsByEmployee[employeeId];
      const totalScore = Object.values(cells).reduce((sum, val) => sum + (Number(val) || 0), 0);
      // This is a simplified calculation for the PDF
      performanceHistory.push({
        year: y,
        score: Math.min(100, totalScore), // Cap at 100 for display
        grade: getGrade(totalScore)
      });
    }
  }

  return {
    name: user.name,
    id: user.id,
    role: user.role.toUpperCase(),
    dept: user.dept,
    joinDate: user.joinDate || 'N/A',
    yearsService: tenure.years,
    monthsService: tenure.months,
    status: user.status.toUpperCase(),
    reportTo: reportsTo ? reportsTo.name : 'N/A',
    email: user.email,
    phone: user.phoneNumber || 'N/A',
    experiences: (user.experienceInOffice || []).map((exp: any) => ({
      year: exp.year || 'N/A',
      title: exp.title || 'N/A',
      dept: exp.dept || 'N/A',
      duration: exp.duration || 'N/A'
    })),
    rewards: (user.rewards || []).map((r: any) => ({
      year: r.year || 'N/A',
      title: r.title || 'N/A',
      description: r.description || ''
    })),
    performanceHistory: performanceHistory.length ? performanceHistory : [
      { year: currentYear, score: 0, grade: 'N/A' }
    ]
  };
}

async function generateProfilePdf(profile: ProfilePayload): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const chunks: Buffer[] = [];

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 72;

    doc.rect(0, 0, pageWidth, 150).fill('#1f4bd8');
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('Employee Profile Report', 36, 28);
    doc.fontSize(11).font('Helvetica').text('Generated from EzeemOps', 36, 58);

    doc.roundedRect(36, 86, contentWidth, 52, 10).fill('#2f5cf2');
    doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text(profile.name, 48, 102, { width: 300 });
    doc.fontSize(10).font('Helvetica').text(`${profile.role} | ${profile.dept}`, 48, 122, { width: 280 });
    doc.fontSize(15).font('Helvetica-Bold').text(`${profile.performanceHistory[0]?.score || 0}%`, pageWidth - 130, 106, { width: 80, align: 'right' });

    let y = 170;

    doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold').text('Profile Overview', 36, y);
    y += 18;

    doc.roundedRect(36, y, contentWidth, 74, 8).fill('#eef3ff');
    doc.fillColor('#1f2937').fontSize(10).font('Helvetica-Bold').text('Employee ID', 48, y + 12);
    doc.font('Helvetica').text(profile.id, 48, y + 28);
    doc.font('Helvetica-Bold').text('Status', 220, y + 12);
    doc.font('Helvetica').text(profile.status, 220, y + 28);
    doc.font('Helvetica-Bold').text('Tenure', 350, y + 12);
    doc.font('Helvetica').text(`${profile.yearsService}y ${profile.monthsService}m`, 350, y + 28);
    doc.font('Helvetica-Bold').text('Reports To', 480, y + 12);
    doc.font('Helvetica').fontSize(9).text(profile.reportTo, 480, y + 28, { width: 90 });
    y += 92;

    doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold').text('Contact', 36, y);
    y += 18;
    doc.roundedRect(36, y, contentWidth, 48, 8).fill('#f6f8ff');
    doc.fillColor('#1f2937').fontSize(10).font('Helvetica').text(`Email: ${profile.email}`, 48, y + 12);
    doc.text(`Phone: ${profile.phone}`, 320, y + 12);
    y += 70;

    doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold').text('Performance History', 36, y);
    y += 18;

    profile.performanceHistory.slice(0, 6).forEach((item, idx) => {
      const rowY = y + idx * 22;
      const barColor = item.score >= 85 ? '#10b981' : item.score >= 70 ? '#f59e0b' : '#ef4444';
      const barWidth = Math.max(10, Math.min(360, (item.score / 100) * 360));

      doc.fillColor('#374151').fontSize(9).font('Helvetica-Bold').text(String(item.year), 48, rowY + 6);
      doc.roundedRect(96, rowY + 5, 360, 10, 5).fill('#e5e7eb');
      doc.roundedRect(96, rowY + 5, barWidth, 10, 5).fill(barColor);
      doc.fillColor('#111827').font('Helvetica-Bold').text(`${item.score}%`, 468, rowY + 6, { width: 45, align: 'right' });
      doc.fillColor('#1d4ed8').font('Helvetica').text(item.grade, 520, rowY + 6);
    });

    y += Math.min(profile.performanceHistory.length, 6) * 22 + 16;

    doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold').text('Career History at Company', 36, y);
    y += 18;

    profile.experiences.slice(0, 5).forEach((exp, idx) => {
      const boxY = y + idx * 44;
      doc.roundedRect(36, boxY, contentWidth, 38, 8).fill('#f8fafc');
      doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold').text(exp.title, 48, boxY + 8);
      doc.fillColor('#4b5563').font('Helvetica').text(`${exp.dept} | ${exp.duration}`, 48, boxY + 22);
      doc.fillColor('#1d4ed8').font('Helvetica-Bold').text(exp.year, pageWidth - 180, boxY + 14, { width: 130, align: 'right' });
    });

    y += Math.min(profile.experiences.length, 5) * 44 + 10;

    if (y > 720) {
      doc.addPage();
      y = 40;
    }

    doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold').text('Rewards & Recognition', 36, y);
    y += 18;

    profile.rewards.slice(0, 8).forEach((reward, idx) => {
      const boxY = y + idx * 46;
      if (boxY > 760) return;

      doc.roundedRect(36, boxY, contentWidth, 40, 8).fill('#fff7ed');
      doc.fillColor('#9a3412').fontSize(10).font('Helvetica-Bold').text(reward.title, 48, boxY + 8, { width: 380 });
      doc.fillColor('#7c2d12').font('Helvetica').fontSize(9).text(reward.description, 48, boxY + 22, { width: 420 });
      doc.fillColor('#ea580c').font('Helvetica-Bold').fontSize(10).text(reward.year, pageWidth - 110, boxY + 15, { width: 50, align: 'right' });
    });

    doc.fillColor('#6b7280').fontSize(8).font('Helvetica').text('Confidential - EzeemOps HR Performance Report', 36, doc.page.height - 24);

    doc.end();
  });
}

async function respondWithPdf(profile: ProfilePayload) {
  const pdf = await generateProfilePdf(profile);
  const body = new Uint8Array(pdf);
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${profile.name.replace(/\s+/g, '_')}_Profile.pdf"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }
    const profile = await fetchRealProfile(employeeId);
    return await respondWithPdf(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.profile?.id) {
       // Allow overriding or fetching by ID from body
       const profile = await fetchRealProfile(body.profile.id);
       return await respondWithPdf({ ...profile, ...body.profile });
    }
    return NextResponse.json({ error: 'Valid profile data or employeeId required' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
