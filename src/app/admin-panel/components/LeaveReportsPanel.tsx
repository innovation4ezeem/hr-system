'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { buildClientAuthHeaders, readClientIdentity } from '@/lib/clientAuth';

type ReportRow = Record<string, unknown>;

type ReportMode = 'monthly' | 'yearly' | 'balance' | 'utilization' | 'leave-performance';

const TABS: { key: ReportMode; label: string; icon: string; description: string }[] = [
  { key: 'monthly',           label: 'Monthly',              icon: '📅', description: 'Leave taken per employee this month' },
  { key: 'yearly',            label: 'Yearly',               icon: '📆', description: 'Full year leave summary per employee' },
  { key: 'balance',           label: 'Balance Snapshot',     icon: '⚖️', description: 'Current balance, used, entitled per employee' },
  { key: 'utilization',       label: 'Utilization',          icon: '📊', description: 'Leave utilization rates by department' },
  { key: 'leave-performance', label: 'Leave vs Performance', icon: '🔗', description: 'Correlation between leave taken & 3Ps score' },
];

function exportCSV(rows: ReportRow[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  
  // Format headers to be human readable (e.g. employeeName -> Employee Name)
  const displayHeaders = headers.map(h => 
    h.replace(/([A-Z])/g, ' $1')
     .replace(/_/g, ' ')
     .replace(/^\w/, c => c.toUpperCase())
     .trim()
  );

  const csvContent = [
    displayHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map(row => headers.map(h => {
      const val = row[h];
      const str = val === null || val === undefined ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(',')),
  ].join('\n');
  
  const csvWithBOM = "\ufeff" + csvContent;
  const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  
  // Use a slight delay to ensure the browser registers the click and filename properly
  setTimeout(() => {
    link.click();
    document.body.removeChild(link);
    // Delay revocation to allow the download to initialize
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 100);
}

function exportExcel(rows: ReportRow[], filename: string) {
  if (!rows.length) return;
  
  // Format data for Excel
  const worksheetData = rows.map(row => {
    const newRow: any = {};
    Object.keys(row).forEach(key => {
      const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()).trim();
      newRow[displayKey] = row[key];
    });
    return newRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leave Report");
  
  // Export file
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename.split('.')[0]}.xlsx`);
}

function exportPDF(rows: ReportRow[], title: string, filename: string) {
  if (!rows.length) {
    toast.error('No data to export');
    return;
  }
  
  try {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const headers = Object.keys(rows[0]);
    const displayHeaders = headers.map(h => 
      h.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()).trim()
    );

    const tableData = rows.map(row => headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      return String(val);
    }));

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(title, 14, 22);
    
    // Metadata
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Total Records: ${rows.length}`, 14, 35);

    autoTable(doc, {
      head: [displayHeaders],
      body: tableData,
      startY: 40,
      margin: { top: 40, right: 14, bottom: 20, left: 14 },
      styles: { 
        fontSize: 8, 
        cellPadding: 3,
        overflow: 'linebreak',
        font: 'helvetica'
      },
      headStyles: { 
        fillColor: [79, 127, 255], 
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: { 
        fillColor: [248, 250, 252] 
      },
      columnStyles: {
        // Adjust column widths if needed, but auto-layout is usually fine
      }
    });

    const finalFilename = filename.endsWith('.pdf') ? filename : `${filename.split('.')[0]}.pdf`;
    doc.save(finalFilename);
    toast.success(`Report exported as ${finalFilename}`);
  } catch (err) {
    console.error('PDF Export Error:', err);
    toast.error('Failed to generate PDF report. Please try Excel or CSV instead.');
  }
}

function TableView({ rows }: { rows: ReportRow[] }) {
  if (!rows.length) return <p className="text-sm p-4 text-center" style={{ color: 'rgb(var(--text-muted))' }}>No data for the selected period.</p>;
  const keys = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
            {keys.map(k => (
              <th key={k} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>
                {k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgb(var(--border))' }}>
              {keys.map(k => {
                const val = row[k];
                const str = val === null || val === undefined ? '—' : String(val);
                const isNum = typeof val === 'number';
                return (
                  <td key={k} className="px-4 py-2.5 text-sm" style={{ color: isNum ? 'rgb(var(--text-primary))' : 'rgb(var(--text-secondary))' }}>
                    {isNum ? <span className="font-mono font-semibold">{str}</span> : str}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LeaveReportsPanel() {
  const now = new Date();
  const identity = useMemo(() => readClientIdentity('admin'), []);
  const authHeaders = useMemo(
    () => buildClientAuthHeaders(identity),
    [identity.department, identity.role, identity.userId],
  );

  const [activeTab, setActiveTab] = useState<ReportMode>('monthly');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [department, setDepartment] = useState('');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  const monthStr = useMemo(() => new Date(2000, month - 1).toLocaleString('default', { month: 'long' }), [month]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setRows([]);
    try {
      let url: string;

      if (activeTab === 'leave-performance') {
        const params = new URLSearchParams({
          mode: 'report',
          reportMode: 'dept-leave-performance-correlation',
          year: String(year),
        });
        if (department) params.append('department', department);
        url = `/api/performance-management?${params}`;
      } else if (activeTab === 'balance') {
        // Fetch all users and aggregate balances — use a shared employee list
        // For simplicity call the leave-management balances report
        const params = new URLSearchParams({ mode: 'reports', reportMode: 'balance', year: String(year) });
        if (department) params.append('department', department);
        url = `/api/leave-management?${params}`;
      } else {
        const reportMode = activeTab === 'utilization' ? 'utilization' : activeTab;
        const params = new URLSearchParams({ mode: 'reports', reportMode, year: String(year) });
        if (activeTab === 'monthly') {
          params.set('month', `${year}-${String(month).padStart(2, '0')}`);
        }
        if (department) params.append('department', department);
        url = `/api/leave-management?${params}`;
      }

      const res = await fetch(url, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load report');

      const raw = data.report || data.rows || data.balances || [];
      const normalized = Array.isArray(raw) ? raw : [];
      setRows(normalized as ReportRow[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [activeTab, year, month, department, authHeaders]);

  useEffect(() => { void loadReport(); }, [loadReport]);

  const activeTabMeta = TABS.find(t => t.key === activeTab)!;

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
            style={{
              background: activeTab === tab.key ? 'rgb(79 127 255)' : 'transparent',
              color: activeTab === tab.key ? 'white' : 'rgb(var(--text-secondary))',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: 'rgb(var(--text-muted))' }}>{activeTabMeta.description}</p>
          </div>
          <div className="flex flex-wrap gap-3 ml-auto items-end">
            {/* Year */}
            <div>
              <label className="text-xs block mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Year</label>
              <select className="input-base text-sm" value={year} onChange={e => setYear(Number(e.target.value))}>
                {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Month (only for monthly tab) */}
            {activeTab === 'monthly' && (
              <div>
                <label className="text-xs block mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Month</label>
                <select className="input-base text-sm" value={month} onChange={e => setMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Department */}
            <div>
              <label className="text-xs block mb-1" style={{ color: 'rgb(var(--text-secondary))' }}>Department</label>
              <input
                type="text"
                className="input-base text-sm"
                placeholder="All departments"
                value={department}
                onChange={e => setDepartment(e.target.value)}
              />
            </div>

            {/* Export Buttons */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-500/5 border border-slate-500/10">
              <button
                className="btn-ghost text-[10px] py-1 px-2 flex items-center gap-1 transition-all hover:bg-emerald-500/10 hover:text-emerald-500"
                onClick={() => exportExcel(rows, `leave-${activeTab}-${activeTab === 'monthly' ? monthStr : year}.xlsx`)}
                disabled={!rows.length}
                title="Export to Excel"
              >
                <Icon name="DocumentArrowDownIcon" size={14} />
                Excel
              </button>

              <div className="w-[1px] h-4 bg-slate-500/20 mx-0.5" />

              <button
                className="btn-ghost text-[10px] py-1 px-2 flex items-center gap-1 transition-all hover:bg-red-500/10 hover:text-red-500"
                onClick={() => exportPDF(rows, `Leave Report - ${activeTabMeta.label} (${activeTab === 'monthly' ? monthStr : year})`, `leave-report-${activeTab}.pdf`)}
                disabled={!rows.length}
                title="Export to PDF"
              >
                <Icon name="DocumentTextIcon" size={14} />
                PDF
              </button>

              <div className="w-[1px] h-4 bg-slate-500/20 mx-0.5" />

              <button
                className="btn-ghost text-[10px] py-1 px-2 flex items-center gap-1 transition-all hover:bg-blue-500/10 hover:text-blue-500"
                onClick={() => exportCSV(rows, `leave-${activeTab}-${activeTab === 'monthly' ? monthStr : year}.csv`)}
                disabled={!rows.length}
                title="Export to CSV"
              >
                <Icon name="TableCellsIcon" size={14} />
                CSV
              </button>
            </div>

            <button className="btn-primary text-xs" onClick={loadReport} disabled={loading}>
              {loading ? 'Loading...' : '↻ Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {rows.length > 0 && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(79,127,255,0.08)', border: '1px solid rgba(79,127,255,0.2)' }}>
            <p className="text-xs mb-1" style={{ color: 'rgb(var(--text-muted))' }}>Records</p>
            <p className="text-xl font-bold" style={{ color: 'rgb(79 127 255)' }}>{rows.length}</p>
          </div>
          {activeTab === 'leave-performance' && (() => {
            const typedRows = rows as Array<{ leave_units?: number; avg_final_score?: number }>;
            const totalUnits = typedRows.reduce((s, r) => s + Number(r.leave_units || 0), 0);
            const avgScore = typedRows.length ? (typedRows.reduce((s, r) => s + Number(r.avg_final_score || 0), 0) / typedRows.length) : 0;
            return (
              <>
                <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  <p className="text-xs mb-1" style={{ color: 'rgb(var(--text-muted))' }}>Total Leave Units</p>
                  <p className="text-xl font-bold" style={{ color: 'rgb(248 113 113)' }}>{totalUnits.toFixed(1)}</p>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <p className="text-xs mb-1" style={{ color: 'rgb(var(--text-muted))' }}>Avg Performance</p>
                  <p className="text-xl font-bold" style={{ color: 'rgb(52 211 153)' }}>{avgScore.toFixed(1)}</p>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
            <div className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
            Generating report...
          </div>
        ) : (
          <TableView rows={rows} />
        )}
      </div>
    </div>
  );
}
