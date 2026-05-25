'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { buildClientAuthHeaders, readClientIdentity } from '@/lib/clientAuth';
import Icon from '@/components/ui/AppIcon';

type CalendarEntry = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  units: number;
  employeeStatus?: string;
  session?: string;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  let d = new Date(year, month - 1, 1).getDay();
  return d === 0 ? 6 : d - 1; // 0=Mon, 6=Sun
}

function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function TeamLeaveCalendarPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const identity = useMemo(() => readClientIdentity('hod'), []);
  const authHeaders = useMemo(() => buildClientAuthHeaders(identity), [identity]);

  const loadData = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        mode: 'calendar',
        month: `${year}-${String(month).padStart(2, '0')}`,
        department: identity.department || '',
      });
      const res = await fetch(`/api/leave-management?${qs.toString()}`, { headers: authHeaders });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data.calendar)) {
            setEntries(data.calendar);
          }
        }
      }
    } catch (err) {
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [year, month, authHeaders]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  };
  const goToToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); setSelectedDate(null); };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOfWeek(year, month); // 0=Mon

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (employeeSearch && !e.employeeName.toLowerCase().includes(employeeSearch.toLowerCase())) return false;
      
      const isInactive = e.employeeStatus === 'inactive' || e.employeeStatus === 'terminated';
      if (showInactive) {
        return isInactive;
      } else {
        return !isInactive;
      }
    });
  }, [entries, employeeSearch, showInactive]);

  // Map entries by date
  const entriesByDate = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {};
    for (const entry of filteredEntries) {
      const start = new Date(entry.startDate);
      const end = new Date(entry.endDate);
      const cursor = new Date(start);
      while (cursor <= end) {
        const ds = cursor.toISOString().slice(0, 10);
        if (!map[ds]) map[ds] = [];
        map[ds].push(entry);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [filteredEntries]);

  const selectedEntries = selectedDate ? (entriesByDate[selectedDate] || []) : [];

  // Build calendar grid cells
  const cells: Array<{ dateStr: string | null; day: number | null }> = [];
  for (let i = 0; i < firstDayOffset; i++) cells.push({ dateStr: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: formatDate(year, month, d), day: d });
  }
  const remainder = cells.length % 7;
  if (remainder > 0) for (let i = 0; i < 7 - remainder; i++) cells.push({ dateStr: null, day: null });

  // Summary stats
  const uniqueOnLeave = new Set(filteredEntries.map(e => e.employeeId)).size;
  const entryCount = filteredEntries.length;
  const typeCounts: Record<string, number> = {};
  for (const e of filteredEntries) { typeCounts[e.leaveTypeCode] = (typeCounts[e.leaveTypeCode] || 0) + 1; }

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="flex items-center gap-2 flex-1">
          <button onClick={prevMonth} className="btn-ghost p-1.5 rounded-lg">
            <Icon name="ChevronLeftIcon" size={16} />
          </button>
          <h3 className="text-base font-bold px-2" style={{ color: 'rgb(var(--text-primary))' }}>
            {MONTH_NAMES[month - 1]} {year}
          </h3>
          <button onClick={nextMonth} className="btn-ghost p-1.5 rounded-lg">
            <Icon name="ChevronRightIcon" size={16} />
          </button>
          <button onClick={goToToday} className="btn-ghost text-xs px-3 py-1.5 rounded-lg ml-2">Today</button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              className="input-base text-sm pl-9 w-48"
              placeholder="Filter name..."
              value={employeeSearch}
              onChange={e => setEmployeeSearch(e.target.value)}
            />
            <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
              />
              <div className="w-8 h-4 bg-gray-700 rounded-full peer-checked:bg-red-600 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
            </div>
            <span className="text-xs font-medium text-gray-400 group-hover:text-gray-200">Inactive</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Calendar Grid */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <div className="grid grid-cols-7 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgb(var(--text-muted))' }}>{d}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              const dayEntries = cell.dateStr ? (entriesByDate[cell.dateStr] || []) : [];
              const isToday = cell.dateStr === formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
              const isSelected = selectedDate === cell.dateStr;

              return (
                <div
                  key={idx}
                  onClick={() => cell.dateStr && setSelectedDate(cell.dateStr)}
                  className={`min-h-[100px] p-2 border-b border-r last:border-r-0 relative transition-colors ${cell.dateStr ? 'cursor-pointer hover:bg-white/5' : 'bg-black/10'} ${isSelected ? 'bg-blue-600/10' : ''}`}
                  style={{ borderColor: 'rgb(var(--border-subtle))' }}
                >
                  {cell.day && (
                    <span className={`text-xs font-medium ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center -ml-1 -mt-1' : ''}`} style={{ color: isToday ? '#fff' : 'rgb(var(--text-muted))' }}>
                      {cell.day}
                    </span>
                  )}
                  
                  <div className="mt-1 space-y-1">
                    {dayEntries.slice(0, 3).map(e => (
                      <div key={e.id} className="text-[10px] px-1.5 py-0.5 rounded truncate" style={{ background: 'rgba(79,127,255,0.1)', color: 'rgb(79 127 255)', border: '1px solid rgba(79,127,255,0.2)' }}>
                        {e.employeeName}
                      </div>
                    ))}
                    {dayEntries.length > 3 && (
                      <div className="text-[9px] text-center font-bold" style={{ color: 'rgb(var(--text-muted))' }}>
                        +{dayEntries.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar / Details */}
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
            <h4 className="text-sm font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>Month Summary</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>On Leave</span>
                <span className="text-sm font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{uniqueOnLeave} Employees</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Total Units</span>
                <span className="text-sm font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{entryCount}</span>
              </div>
              <div className="pt-3 border-t space-y-2" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
                {Object.entries(typeCounts).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgb(var(--text-secondary))' }}>{type}</span>
                    <span className="text-xs font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl p-5 min-h-[300px]" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
            <h4 className="text-sm font-bold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>
              {selectedDate ? `Details for ${selectedDate}` : 'Select a date'}
            </h4>
            
            <div className="space-y-3">
              {selectedEntries.length === 0 ? (
                <p className="text-xs italic text-center py-10" style={{ color: 'rgb(var(--text-muted))' }}>No one on leave this day</p>
              ) : (
                selectedEntries.map(e => (
                  <div key={e.id} className="p-3 rounded-lg border flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgb(var(--border-subtle))' }}>
                    <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-[10px] font-bold text-blue-400">
                      {e.employeeName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: 'rgb(var(--text-primary))' }}>{e.employeeName}</p>
                      <p className="text-[10px]" style={{ color: 'rgb(var(--text-muted))' }}>
                        {e.leaveTypeCode} · {e.startDate} to {e.endDate}
                        {e.session && e.session !== 'FULL' ? ` · ${e.session === 'AM' ? 'Morning (AM)' : 'Afternoon (PM)'}` : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
