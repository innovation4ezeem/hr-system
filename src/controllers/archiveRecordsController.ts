import { getHistoricalRecords, type ArchiveModule } from '@/models/yearEndArchiveModel';
// Remove static XLSX import
import { round2 } from '@/data/activityScoreRules';

function escapePdfText(text: string) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ');
}

function buildSimplePdf(lines: string[]) {
  const pageWidth = 842; // Landscape
  const pageHeight = 595;
  const left = 40;
  const top = 550;
  const fontSize = 10;
  const lineHeight = 14;

  const contentLines: string[] = [];
  contentLines.push('BT');
  contentLines.push(`/F1 ${fontSize} Tf`);
  contentLines.push(`${left} ${top} Td`);

  lines.forEach((rawLine, index) => {
    const safe = escapePdfText(rawLine);
    if (index === 0) {
      contentLines.push(`(${safe}) Tj`);
    } else {
      contentLines.push(`0 -${lineHeight} Td (${safe}) Tj`);
    }
  });

  contentLines.push('ET');
  const contentStream = `${contentLines.join('\n')}\n`;
  const contentLength = Buffer.byteLength(contentStream, 'utf8');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n',
    `5 0 obj\n<< /Length ${contentLength} >>\nstream\n${contentStream}endstream\nendobj\n`,
  ];

  const header = '%PDF-1.4\n';
  const parts: string[] = [header];
  const offsets: number[] = [0];
  let currentOffset = Buffer.byteLength(header, 'utf8');

  objects.forEach((obj) => {
    offsets.push(currentOffset);
    parts.push(obj);
    currentOffset += Buffer.byteLength(obj, 'utf8');
  });

  const xrefOffset = currentOffset;
  const objectCount = objects.length;
  const xrefLines = [`xref\n0 ${objectCount + 1}\n`, '0000000000 65535 f \n'];

  for (let i = 1; i <= objectCount; i += 1) {
    xrefLines.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }

  const trailer = `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(xrefLines.join(''));
  parts.push(trailer);

  return Buffer.from(parts.join(''), 'utf8');
}

export async function getArchiveRecordsController(year: number, moduleName?: string) {
  const safeModule = moduleName as ArchiveModule | undefined;
  return getHistoricalRecords(year, safeModule);
}

export async function exportArchiveRecordsController(year: number, moduleName?: string, format = 'json') {
  const records = await getArchiveRecordsController(year, moduleName);

  if (format === 'json') {
    return {
      contentType: 'application/json; charset=utf-8',
      filename: `archive-${year}${moduleName ? `-${moduleName}` : ''}.json`,
      body: JSON.stringify({ year, module: moduleName || 'all', records }, null, 2),
    };
  }

  if (format === 'xlsx') {
    let finalRows: any[] = [];
    
    if (moduleName && records.length > 0) {
      // Specific module: Flatten and clean the inner data
      const payload = records[0].payload;
      let rawData: any[] = [];
      if (Array.isArray(payload)) rawData = payload;
      else if (payload && typeof payload === 'object') {
        const inner = (payload as any).records || (payload as any).data;
        rawData = Array.isArray(inner) ? inner : [payload];
      }

      if (moduleName === 'performance') {
        // Masterboard Transformation
        finalRows = rawData.map(row => {
          let perf = 0, part = 0, pop = 0;
          Object.entries(row).forEach(([k, v]) => {
            const val = Number(v) || 0;
            const key = k.toLowerCase();
            if (key.includes('kpi') || key.includes('task') || key.includes('quality') || key.includes('performance')) perf += val;
            else if (key.includes('attendance') || key.includes('learn') || key.includes('play') || key.includes('participation')) part += val;
            else if (key.includes('gratitude') || key.includes('sticker') || key.includes('voting') || key.includes('popularity')) pop += val;
          });
          const pContrib = perf * 0.6;
          const partContrib = part * 0.25;
          const popContrib = pop * 0.15;
          const total = pContrib + partContrib + popContrib;
          return {
            Rank: 0, // Placeholder
            Employee: row.employeeName || row.name || row.employeeId || '-',
            Dept: row.dept || row.department || '-',
            Performance: round2(pContrib),
            Participation: round2(partContrib),
            Popularity: round2(popContrib),
            Total: round2(total)
          };
        })
        .sort((a, b) => b.Total - a.Total)
        .map((r, idx) => ({ ...r, Rank: idx + 1 }));
      } else {
        // Clean headers (remove prefixes like KPI/OKR::)
        finalRows = rawData.map(row => {
          const clean: any = {};
          Object.entries(row).forEach(([k, v]) => {
            const cleanK = k.includes('::') ? k.split('::').pop() : k;
            clean[cleanK] = v;
          });
          return clean;
        });
      }
    } else {
      // Overview mode
      finalRows = records.map(item => ({
        year: item.year,
        module: item.module,
        createdAt: String(item.createdAt),
        payload: JSON.stringify(item.payload),
      }));
    }

    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(finalRows.length ? finalRows : [{ year, module: moduleName || 'all', status: 'No records found' }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ArchiveData');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    return {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${moduleName || 'archive'}-${year}.xlsx`,
      body: buffer,
    };
  }

  if (format === 'pdf') {
    const lines: string[] = [
      `ARCHIVE EXPORT - ${year}`,
      `MODULE: ${(moduleName || 'ALL').toUpperCase()}`,
      `GENERATED: ${new Date().toLocaleString()}`,
      '----------------------------------------------------------------------',
      '',
    ];

    if (!records.length) {
      lines.push('No archived records found.');
    } else if (moduleName) {
      const payload = records[0].payload;
      let rawData: any[] = [];
      if (Array.isArray(payload)) rawData = payload;
      else if (payload && typeof payload === 'object') {
        const inner = (payload as any).records || (payload as any).data;
        rawData = Array.isArray(inner) ? inner : [payload];
      }

        if (moduleName === 'performance') {
          // Masterboard Ranking PDF
          const processed = rawData.map(row => {
            let perf = 0, part = 0, pop = 0;
            Object.entries(row).forEach(([k, v]) => {
              const val = Number(v) || 0;
              const key = k.toLowerCase();
              if (key.includes('kpi') || key.includes('task') || key.includes('quality') || key.includes('performance')) perf += val;
              else if (key.includes('attendance') || key.includes('learn') || key.includes('play') || key.includes('participation')) part += val;
              else if (key.includes('gratitude') || key.includes('sticker') || key.includes('voting') || key.includes('popularity')) pop += val;
            });
            const pContrib = perf * 0.6;
            const partContrib = part * 0.25;
            const popContrib = pop * 0.15;
            const total = pContrib + partContrib + popContrib;
            return {
              emp: String(row.employeeName || row.name || row.employeeId || '-').substring(0, 18),
              perf: round2(pContrib),
              part: round2(partContrib),
              pop: round2(popContrib),
              total: round2(total)
            };
          }).sort((a, b) => b.total - a.total);

          const divider = '+------+--------------------+------+------+------+------+';
          const header  = '| RANK | EMPLOYEE           | PERF | PART | POP  | TOTAL|';
          lines.push(divider);
          lines.push(header);
          lines.push(divider);
          processed.forEach((r, i) => {
            const rank = String(i + 1).padStart(4).padEnd(5);
            const name = r.emp.padEnd(19);
            const perf = String(r.perf).padStart(4).padEnd(5);
            const part = String(r.part).padStart(4).padEnd(5);
            const pop  = String(r.pop).padStart(4).padEnd(5);
            const total = String(r.total).padStart(5).padEnd(6);
            lines.push(`| ${rank}| ${name}| ${perf}| ${part}| ${pop}| ${total}|`);
          });
          lines.push(divider);
        } else {
          // General Module PDF (Generic Table)
          const allKeys = new Set<string>();
          rawData.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
          const columns = Array.from(allKeys);
          const cleanHeaders = columns.map(k => k.includes('::') ? k.split('::').pop() : k);

          const colWidth = 20; // Increased for landscape
          const divider = '+' + columns.map(() => '-'.repeat(colWidth-1)).join('+') + '+';
          const headerRow = '|' + cleanHeaders.map(h => String(h || '').substring(0, colWidth-2).padEnd(colWidth-1)).join('|') + '|';
          lines.push(divider);
          lines.push(headerRow);
          lines.push(divider);

          rawData.forEach((row) => {
            const line = '|' + columns.map(col => String(row[col] ?? '').substring(0, colWidth-2).padEnd(colWidth-1)).join('|') + '|';
            lines.push(line);
          });
          lines.push(divider);
        }
    } else {
      records.forEach((record, index) => {
        lines.push(`${index + 1}. ${record.module} Snapshot`);
        lines.push(`   Created: ${new Date(record.createdAt).toLocaleDateString()}`);
        lines.push('');
      });
    }

    const clipped = lines.slice(0, 500); 
    const buffer = buildSimplePdf(clipped);

    return {
      contentType: 'application/pdf',
      filename: `${moduleName || 'archive'}-${year}.pdf`,
      body: buffer,
    };
  }

  return {
    contentType: 'application/json; charset=utf-8',
    filename: `archive-${year}${moduleName ? `-${moduleName}` : ''}-${format}.json`,
    body: JSON.stringify({
      message: `Export format '${format}' placeholder. Use json for now.`,
      year,
      module: moduleName || 'all',
      records,
    }, null, 2),
  };
}

export async function listAvailableYearsController() {
  const { listAvailableYears } = await import('@/models/yearEndArchiveModel');
  return listAvailableYears();
}
