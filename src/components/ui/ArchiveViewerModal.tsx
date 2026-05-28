'use client';

import React, { useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Icon from './AppIcon';

interface ArchiveViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  module: string;
  year: number;
  payload: any;
}

export default function ArchiveViewerModal({ isOpen, onClose, module, year, payload }: ArchiveViewerModalProps) {
  if (!isOpen) return null;

  const [viewMode, setViewMode] = React.useState<'table' | 'ranking'>(module === 'performance' ? 'ranking' : 'table');

  // Normalize payload to an array
  const data = useMemo(() => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
      // If it's a wrapper, try to find the actual list
      if (Array.isArray(payload.records)) return payload.records;
      if (Array.isArray(payload.data)) return payload.data;
      return [payload]; // Single object
    }
    return [];
  }, [payload]);

  const rankingData = useMemo(() => {
    if (module !== 'performance' || data.length === 0) return [];
    
    return data.map(row => {
      let performance = 0;
      let participation = 0;
      let popularity = 0;
      
      Object.keys(row).forEach(key => {
        const val = Number(row[key]) || 0;
        const k = key.toLowerCase();
        
        if (k.includes('kpi') || k.includes('task') || k.includes('quality') || k.includes('performance')) {
          performance += val;
        } else if (k.includes('attendance') || k.includes('learn') || k.includes('play') || k.includes('participation')) {
          participation += val;
        } else if (k.includes('gratitude') || k.includes('sticker') || k.includes('voting') || k.includes('popularity')) {
          popularity += val;
        }
      });
      
      const pContrib = performance * 0.6;
      const partContrib = participation * 0.25;
      const popContrib = popularity * 0.15;
      const total = pContrib + partContrib + popContrib;
      
      return {
        id: row.employeeId || row.id,
        name: row.employeeName || row.name || 'Unknown',
        dept: row.dept || row.department || '-',
        performance: pContrib,
        participation: partContrib,
        popularity: popContrib,
        total: total
      };
    }).sort((a, b) => b.total - a.total);
  }, [data, module]);

  const columns = useMemo(() => {
    if (data.length === 0) return [];
    // Collect all unique non-object keys from all records to ensure no columns are missed
    const allKeys = new Set<string>();
    data.forEach(row => {
      Object.keys(row).forEach(k => {
        if (typeof row[k] !== 'object' || row[k] === null) {
          allKeys.add(k);
        }
      });
    });
    return Array.from(allKeys);
  }, [data]);

  const handleExport = () => {
    if (data.length === 0) return;
    
    const headers = columns.map(col => {
      const clean = col.includes('::') ? col.split('::').pop() : col;
      const prefix = col.includes('::') ? col.split('::')[0] : '';
      const finalHeader = prefix ? `${clean} (${prefix})` : clean;
      return `"${String(finalHeader).replace(/"/g, '""')}"`;
    }).join(',');
    const rows = data.map(row => 
      columns.map(col => {
        const val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',')
    );
    
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${module}-archive-${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    if (data.length === 0) return;
    
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const title = `${getModuleLabel(module)} Archive (${year})`;
      const headers = columns;
      const displayHeaders = headers.map(h => {
        const clean = h.includes('::') ? h.split('::').pop() : h.replace(/([A-Z])/g, ' $1').trim();
        const prefix = h.includes('::') ? h.split('::')[0] : '';
        const final = prefix ? `${clean} (${prefix})` : clean;
        return final.replace(/^\w/, c => c.toUpperCase());
      });

      const tableData = data.map(row => headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '-';
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
      doc.text(`Total Records: ${data.length}`, 14, 35);

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
        }
      });

      doc.save(`${module}-archive-${year}.pdf`);
    } catch (err) {
      console.error('Archive PDF Export Error:', err);
      window.alert('Failed to generate PDF. Falling back to server export.');
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const url = `${basePath}/api/archive-records?mode=export&year=${year}&module=${module}&format=pdf`;
      window.location.href = url;
    }
  };

  const handleDownloadXLSX = () => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const url = `${basePath}/api/archive-records?mode=export&year=${year}&module=${module}&format=xlsx`;
    window.location.href = url;
  };

  const getModuleLabel = (m: string) => {
    switch (m) {
      case 'leave-control-state': return 'Leave Settings';
      case 'leave-summaries': return 'Leave Records';
      case 'performance': return 'Performance Scores';
      case 'penalty-records': return 'Penalties History';
      case 'scoring-categories': return 'Scoring Rules';
      default: return m;
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-6xl bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Icon name="ArchiveBoxIcon" size={20} className="text-blue-400" />
                {getModuleLabel(module)} Archive ({year})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Historical snapshot from the {year} Year-End Freeze.
              </p>
            </div>
            
            {module === 'performance' && data.length > 0 && (
              <div className="ml-4 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Masterboard Ranking View</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data.length > 0 && (
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5 mr-2">
                <button 
                  onClick={() => handleExport()} 
                  className="px-3 py-1.5 rounded-md hover:bg-white/5 text-[10px] font-bold text-white/60 hover:text-white transition-all flex items-center gap-1.5"
                  title="Download CSV"
                >
                  <Icon name="DocumentTextIcon" size={12} />
                  CSV
                </button>
                <div className="w-px h-3 bg-white/10" />
                <button 
                  onClick={() => handleDownloadXLSX()} 
                  className="px-3 py-1.5 rounded-md hover:bg-white/5 text-[10px] font-bold text-white/60 hover:text-white transition-all flex items-center gap-1.5"
                  title="Download Excel"
                >
                  <Icon name="TableCellsIcon" size={12} />
                  Excel
                </button>
                <div className="w-px h-3 bg-white/10" />
                <button 
                  onClick={() => handleDownloadPDF()} 
                  className="px-3 py-1.5 rounded-md hover:bg-white/5 text-[10px] font-bold text-white/60 hover:text-white transition-all flex items-center gap-1.5"
                  title="Download PDF"
                >
                  <Icon name="DocumentIcon" size={12} />
                  PDF
                </button>
              </div>
            )}
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-white"
            >
              <Icon name="XMarkIcon" size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
          {data.length > 0 ? (
            viewMode === 'table' ? (
              <div className="rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5">
                      {columns.map(col => {
                        const clean = col.includes('::') ? col.split('::').pop() : col.replace(/([A-Z])/g, ' $1').trim();
                        const prefix = col.includes('::') ? col.split('::')[0] : '';
                        return (
                          <th key={col} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-white/5">
                            {prefix ? `${clean} (${prefix})` : clean}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.map((row, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        {columns.map(col => (
                          <td key={col} className="px-4 py-3 text-xs text-white/80 whitespace-nowrap">
                            {String(row[col] ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-white/5">Rank</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-white/5">Employee</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-white/5">Dept</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-orange-400 border-b border-white/5">Performance</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-green-400 border-b border-white/5">Participation</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-purple-400 border-b border-white/5">Popularity</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-blue-400 border-b border-white/5">Total Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rankingData.map((row, i) => (
                      <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-slate-500">#{i + 1}</td>
                        <td className="px-4 py-3 text-xs font-bold text-white">{row.name}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{row.dept}</td>
                        <td className="px-4 py-3 text-center text-xs font-mono font-bold text-orange-400">{(Math.round(row.performance * 100) / 100)}</td>
                        <td className="px-4 py-3 text-center text-xs font-mono font-bold text-green-400">{(Math.round(row.participation * 100) / 100)}</td>
                        <td className="px-4 py-3 text-center text-xs font-mono font-bold text-purple-400">{(Math.round(row.popularity * 100) / 100)}</td>
                        <td className="px-4 py-3 text-center text-xs font-mono font-bold text-blue-400 bg-blue-400/5">{(Math.round(row.total * 100) / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground italic">
              <Icon name="DocumentMagnifyingGlassIcon" size={48} className="opacity-20 mb-4" />
              <p>No records found in this archive module.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex justify-between items-center bg-white/[0.01]">
          <span className="text-[10px] text-muted-foreground">
            Total Records: <span className="text-blue-400 font-bold">{data.length}</span>
          </span>
          <button 
            onClick={onClose}
            className="btn-primary text-xs py-2 px-6"
          >
            Close View
          </button>
        </div>
      </div>
    </div>
  );
}
