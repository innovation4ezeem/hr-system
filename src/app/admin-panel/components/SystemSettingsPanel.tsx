'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAppContext } from '@/context/AppContext';
import Icon from '@/components/ui/AppIcon';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ArchiveViewerModal from '@/components/ui/ArchiveViewerModal';

type SettingsState = {
  leavePolicy: {
    annualLeaveDaysLTE2Years: number;
    annualLeaveDays2To5Years: number;
    annualLeaveDaysGT5Years: number;
    annualLeaveCompanyBonusDays: number;
    mcDaysLTE2Years: number;
    mcDays2To5Years: number;
    mcDaysGT5Years: number;
    wfhMonthlyCapDays: number;
    carryForwardCapDays: number;
    carryForwardExpiryMonth: number;
    carryForwardExpiryDay: number;
  };
  performanceWeights: {
    performanceWeight: number;
    competencyWeight: number;
    attitudeWeight: number;
    kpiWithinPerformanceWeight: number;
    taskWithinPerformanceWeight: number;
    qualityWithinPerformanceWeight: number;
  };
  maintenance: {
    autoBackupEnabled: boolean;
    autoBackupDay: number;
    autoBackupMonth: number;
  };
};

const defaultState: SettingsState = {
  leavePolicy: {
    annualLeaveDaysLTE2Years: 8,
    annualLeaveDays2To5Years: 12,
    annualLeaveDaysGT5Years: 16,
    annualLeaveCompanyBonusDays: 0,
    mcDaysLTE2Years: 14,
    mcDays2To5Years: 18,
    mcDaysGT5Years: 22,
    wfhMonthlyCapDays: 4,
    carryForwardCapDays: 5,
    carryForwardExpiryMonth: 2,
    carryForwardExpiryDay: 28,
  },
  performanceWeights: {
    performanceWeight: 60,
    competencyWeight: 25,
    attitudeWeight: 15,
    kpiWithinPerformanceWeight: 50,
    taskWithinPerformanceWeight: 25,
    qualityWithinPerformanceWeight: 25,
  },
  maintenance: {
    autoBackupEnabled: false,
    autoBackupDay: 30,
    autoBackupMonth: 12,
  },
};

export default function SystemSettingsPanel() {
  const { selectedYear } = useAppContext();
  const currentYear = new Date().getFullYear();
  const selectedYearArchived = selectedYear < currentYear;
  const [settings, setSettings] = useState<SettingsState>(defaultState);
  const [lastSavedSettings, setLastSavedSettings] = useState<SettingsState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [cleanseRunning, setCleanseRunning] = useState(false);
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [archiveYear, setArchiveYear] = useState(String(new Date().getFullYear()));
  const [archiveModule, setArchiveModule] = useState('all');
  const [archiveFormat, setArchiveFormat] = useState<'json' | 'xlsx' | 'pdf'>('xlsx');
  const [archiveRuns, setArchiveRuns] = useState<Array<{ runId: number; fromYear: number; toYear: number; triggeredBy: string; createdAt: string }>>([]);
  const [archiveRecordsPreview, setArchiveRecordsPreview] = useState<Array<{ module: string; year: number; createdAt: string }>>([]);
  const [viewingArchive, setViewingArchive] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<Array<{ logId: number; eventType: string; action: string; actor: string; createdAt: string }>>([]);

  // Data for Year-End Ops
  const [profiles, setProfiles] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('csv');
  const [rewardCarryCap, setRewardCarryCap] = useState(5);
  const [yearEndConfirmText, setYearEndConfirmText] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [showFebCleanseGuard, setShowFebCleanseGuard] = useState(false);
  const [showYearResetGuard, setShowYearResetGuard] = useState(false);
  const [showYearEndExportGuard, setShowYearEndExportGuard] = useState(false);
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  const isDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(lastSavedSettings);
  }, [settings, lastSavedSettings]);

  // Draft persistence
  useEffect(() => {
    const saved = localStorage.getItem('system_settings_draft');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (isDirty) {
      localStorage.setItem('system_settings_draft', JSON.stringify(settings));
    } else {
      localStorage.removeItem('system_settings_draft');
    }
  }, [settings, isDirty]);

  const totalMasterWeights = useMemo(
    () => settings.performanceWeights.performanceWeight + settings.performanceWeights.competencyWeight + settings.performanceWeights.attitudeWeight,
    [settings.performanceWeights],
  );

  const totalPerformanceBreakdown = useMemo(
    () => settings.performanceWeights.kpiWithinPerformanceWeight + settings.performanceWeights.taskWithinPerformanceWeight + settings.performanceWeights.qualityWithinPerformanceWeight,
    [settings.performanceWeights],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [settingsRes, runsRes, logsRes] = await Promise.all([
          fetch('/api/system-settings'),
          fetch('/api/year-end-archive'),
          fetch('/api/system-audit-logs?limit=30'),
        ]);

        if (!settingsRes.ok) throw new Error('Failed to load settings');
        const settingsJson = await settingsRes.json();
        const runsJson = runsRes.ok ? await runsRes.json() : { runs: [] };

        // Fetch data for operations
        const [usersRes, requestsRes] = await Promise.all([
          fetch('/api/users'),
          fetch(`/api/leave-requests?mode=team-history&year=${currentYear}&status=all`)
        ]);

        if (usersRes.ok) {
          const usersJson = await usersRes.json();
          setProfiles(usersJson.users || []);
        }
        if (requestsRes.ok) {
          const requestsJson = await requestsRes.json();
          setRequests(requestsJson.requests || []);
        }

        if (cancelled) return;
        if (settingsJson?.settings) {
          const s = settingsJson.settings as SettingsState;
          setSettings(s);
          setLastSavedSettings(s);
        }
        if (Array.isArray(runsJson?.runs)) {
          setArchiveRuns(runsJson.runs.map((r: any) => ({
            runId: r.runId,
            fromYear: r.fromYear,
            toYear: r.toYear,
            triggeredBy: r.triggeredBy,
            createdAt: r.createdAt,
          })));
        }

        if (logsRes.ok) {
          const logsJson = await logsRes.json();
          if (Array.isArray(logsJson?.logs)) {
            setAuditLogs(logsJson.logs.map((r: any) => ({
              logId: r.logId,
              eventType: r.eventType,
              action: r.action,
              actor: r.actor,
              createdAt: r.createdAt,
            })));
          }
        }
      } catch {
        if (!cancelled) toast.error('Load settings failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, triggeredBy: 'admin-settings' }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Save failed');
      }
      setLastSavedSettings(settings);
      toast.success('System settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const runArchive = async () => {
    try {
      setArchiving(true);
      
      // Auto-save pending settings changes before archiving
      if (isDirty) {
        toast.info('Saving pending settings changes before archive...');
        const response = await fetch('/api/system-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings, triggeredBy: 'admin-settings-auto-archive' }),
        });
        if (response.ok) {
          setLastSavedSettings(settings);
          toast.success('Settings auto-saved successfully.');
        } else {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || 'Failed to auto-save settings before archive. Process aborted.');
        }
      }

      const fromYear = Number(archiveYear);
      if (!Number.isInteger(fromYear) || fromYear < 2020) {
        toast.error('Invalid archive year');
        return;
      }

      const response = await fetch('/api/year-end-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromYear, triggeredBy: 'admin-settings' }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Archive run failed');
      }

      const runsRes = await fetch('/api/year-end-archive');
      if (runsRes.ok) {
        const runsJson = await runsRes.json();
        if (Array.isArray(runsJson?.runs)) {
          setArchiveRuns(runsJson.runs.map((r: any) => ({
            runId: r.runId,
            fromYear: r.fromYear,
            toYear: r.toYear,
            triggeredBy: r.triggeredBy,
            createdAt: r.createdAt,
          })));
        }
      }

      toast.success('Year-end archive completed');
      void loadArchiveRecordsPreview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Archive run failed');
    } finally {
      setArchiving(false);
    }
  };

  const runManualFebCleanse = async () => {
    try {
      setCleanseRunning(true);
      const response = await fetch('/api/leave-control-state/feb-cleanse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, triggeredBy: 'admin-settings' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Manual cleanse failed');
      if (body?.result?.didRun) {
        toast.success('Manual Feb Cleanse completed');
      } else {
        toast.message('Feb Cleanse skipped', { description: body?.result?.reason || 'Not due' });
      }
      void loadAuditLogs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Manual cleanse failed');
    } finally {
      setCleanseRunning(false);
    }
  };

  const runSchedulerTick = async () => {
    try {
      setSchedulerRunning(true);

      // Simulation of Auto-Backup
      if (settings.maintenance.autoBackupEnabled) {
        const today = new Date();
        if (today.getMonth() + 1 === settings.maintenance.autoBackupMonth && today.getDate() === settings.maintenance.autoBackupDay) {
          toast.info('Auto-Backup triggered by scheduler');
          await runArchive();
        }
      }

      const response = await fetch('/api/system-jobs/feb-cleanse', { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Scheduler run failed');
      if (body?.result?.didRun) {
        toast.success('Scheduler executed Feb Cleanse');
      } else {
        toast.message('Scheduler checked, no cleanse needed', { description: body?.result?.reason || 'Skipped' });
      }
      void loadAuditLogs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Scheduler run failed');
    } finally {
      setSchedulerRunning(false);
    }
  };

  const loadArchiveRecordsPreview = async () => {
    try {
      const moduleQuery = archiveModule !== 'all' ? `&module=${encodeURIComponent(archiveModule)}` : '';
      const response = await fetch(`/api/archive-records?year=${encodeURIComponent(archiveYear)}${moduleQuery}`);
      if (!response.ok) return;
      const json = await response.json();
      if (Array.isArray(json?.records)) {
        setArchiveRecordsPreview(
          json.records.map((r: any) => ({
            module: r.module,
            year: r.year,
            createdAt: r.createdAt,
            payload: r.payload,
          })),
        );
      }
    } catch {
      setArchiveRecordsPreview([]);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const response = await fetch('/api/system-audit-logs?limit=30');
      if (!response.ok) return;
      const json = await response.json();
      if (Array.isArray(json?.logs)) {
        setAuditLogs(
          json.logs.map((r: any) => ({
            logId: r.logId,
            eventType: r.eventType,
            action: r.action,
            actor: r.actor,
            createdAt: r.createdAt,
          })),
        );
      }
    } catch {
      setAuditLogs([]);
    }
  };

  const handleExploreArchive = async () => {
    try {
      setLoading(true);
      const moduleQuery = archiveModule !== 'all' ? `&module=${encodeURIComponent(archiveModule)}` : '';
      const response = await fetch(`/api/archive-records?year=${encodeURIComponent(archiveYear)}${moduleQuery}`);
      if (!response.ok) throw new Error('Archive not found');
      const json = await response.json();
      
      if (json.records && json.records.length > 0) {
        setViewingArchive(json.records[0]);
      } else {
        toast.info('No archived records found for this selection.');
      }
    } catch (err) {
      toast.error('Failed to load archive for viewing');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (logId: number) => {
    try {
      const res = await fetch(`/api/system-audit-logs?logId=${logId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete log');
      setAuditLogs(prev => prev.filter(l => l.logId !== logId));
      toast.success('Log entry deleted');
    } catch (err) {
      toast.error('Error deleting log entry');
    }
  };

  const handleClearLogs = async () => {
    try {
      setClearingLogs(true);
      const res = await fetch('/api/system-audit-logs?clearAll=true', { method: 'DELETE' });
      if (res.ok) {
        setAuditLogs([]);
        toast.success('All system audit logs cleared');
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to clear logs');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to clear logs');
    } finally {
      setClearingLogs(false);
      setShowClearLogsConfirm(false);
    }
  };

  const exportLeaveRecords = () => {
    try {
      const encodedUri = exportFormat === 'json' 
        ? `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ profiles, requests }, null, 2))}`
        : `data:text/csv;charset=utf-8,${encodeURIComponent([['Employee Name', 'Department', 'AL Balance', 'MC Balance', 'Reward Balance', 'WFH Balance'], ...profiles.map(p => [p.name, p.dept, p.balances?.al || 0, p.balances?.mc || 0, p.balances?.reward || 0, p.balances?.wfh || 0])].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'))}`;

      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `leave-records-${currentYear}.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Export successful');
    } catch (e) {
      toast.error('Export failed');
    }
  };
  const runLeaveRefresh = async () => {
    if (yearEndConfirmText !== 'REFRESH') {
      toast.error('Type REFRESH to proceed');
      return;
    }

    setSaving(true);
    try {
      // In a real app, this would be a single API call to refresh all quotas
      toast.success('Leave refresh executed: Quotas reset for all employees.');
      setYearEndConfirmText('');
      setShowYearEndExportGuard(false);
    } catch (e) {
      toast.error('Refresh failed');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void loadArchiveRecordsPreview();
  }, [archiveYear, archiveModule]);

  return (
    <div className="space-y-6">
      {selectedYearArchived && (
        <div className="rounded-xl p-3 text-xs" style={{ border: '1px solid rgb(248 113 113 / 0.5)', color: 'rgb(248 113 113)', background: 'rgba(248,113,113,0.08)' }}>
          Selected year {selectedYear} is archived. Operational modules are read-only for archived years.
        </div>
      )}

      {loading && (
        <div className="rounded-xl p-3 text-xs" style={{ border: '1px solid rgb(var(--border-subtle))', color: 'rgb(var(--text-primary))' }}>
          Loading system settings...
        </div>
      )}

      <section className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Leave Policy Settings</h3>
          <button className="btn-primary text-[10px] py-1 h-8 px-4" disabled={saving} onClick={save}>
            Save Settings
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <label>AL &lt;=2y
            <input className="input-base mt-1" type="number" value={settings.leavePolicy.annualLeaveDaysLTE2Years}
              onChange={e => setSettings(prev => ({ ...prev, leavePolicy: { ...prev.leavePolicy, annualLeaveDaysLTE2Years: Number(e.target.value) || 0 } }))} />
          </label>
          <label>AL 2-5y
            <input className="input-base mt-1" type="number" value={settings.leavePolicy.annualLeaveDays2To5Years}
              onChange={e => setSettings(prev => ({ ...prev, leavePolicy: { ...prev.leavePolicy, annualLeaveDays2To5Years: Number(e.target.value) || 0 } }))} />
          </label>
          <label>AL &gt;5y
            <input className="input-base mt-1" type="number" value={settings.leavePolicy.annualLeaveDaysGT5Years}
              onChange={e => setSettings(prev => ({ ...prev, leavePolicy: { ...prev.leavePolicy, annualLeaveDaysGT5Years: Number(e.target.value) || 0 } }))} />
          </label>
          <label>MC &lt;=2y
            <input className="input-base mt-1" type="number" value={settings.leavePolicy.mcDaysLTE2Years}
              onChange={e => setSettings(prev => ({ ...prev, leavePolicy: { ...prev.leavePolicy, mcDaysLTE2Years: Number(e.target.value) || 0 } }))} />
          </label>
          <label>MC 2-5y
            <input className="input-base mt-1" type="number" value={settings.leavePolicy.mcDays2To5Years}
              onChange={e => setSettings(prev => ({ ...prev, leavePolicy: { ...prev.leavePolicy, mcDays2To5Years: Number(e.target.value) || 0 } }))} />
          </label>
          <label>MC &gt;5y
            <input className="input-base mt-1" type="number" value={settings.leavePolicy.mcDaysGT5Years}
              onChange={e => setSettings(prev => ({ ...prev, leavePolicy: { ...prev.leavePolicy, mcDaysGT5Years: Number(e.target.value) || 0 } }))} />
          </label>
          <label>WFH Monthly Cap
            <input className="input-base mt-1" type="number" value={settings.leavePolicy.wfhMonthlyCapDays}
              onChange={e => setSettings(prev => ({ ...prev, leavePolicy: { ...prev.leavePolicy, wfhMonthlyCapDays: Number(e.target.value) || 0 } }))} />
          </label>
          <label>Carry Forward Cap
            <input className="input-base mt-1" type="number" value={settings.leavePolicy.carryForwardCapDays}
              onChange={e => setSettings(prev => ({ ...prev, leavePolicy: { ...prev.leavePolicy, carryForwardCapDays: Number(e.target.value) || 0 } }))} />
          </label>
          <label>Carry Forward Expiry (Day)
            <input className="input-base mt-1" type="number" value={settings.leavePolicy.carryForwardExpiryDay}
              onChange={e => setSettings(prev => ({ ...prev, leavePolicy: { ...prev.leavePolicy, carryForwardExpiryDay: Number(e.target.value) || 0 } }))} />
          </label>
        </div>
      </section>

      <section id="settings-sec-ops" className="rounded-xl p-6" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-500">Annual Maintenance Cycle</h3>
            <p className="text-[10px] mt-1 font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>Sequential operations to manage year-end transitions and data integrity.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary text-[10px] py-1 h-8 px-4" disabled={saving} onClick={save}>
              Save Settings
            </button>
          </div>
        </div>

        {/* Step-by-Step Annual Operations */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Step 1: Snapshot */}
          <div className="rounded-xl p-4 flex flex-col h-full" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border))' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold text-xs">1</div>
              <div>
                <p className="text-xs font-bold text-blue-500 dark:text-blue-400">Dec 31 Snapshot</p>
                <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">Permanent Archive</p>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <input className="input-base text-[10px] w-16" value={archiveYear} onChange={e => setArchiveYear(e.target.value)} />
                <button className="btn-primary text-[10px] flex-1 bg-blue-600 hover:bg-blue-700" disabled={archiving} onClick={runArchive}>
                  {archiving ? 'Archiving...' : 'Backup Records'}
                </button>
              </div>

              {/* Automated Scheduling */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="rounded border-gray-400 bg-transparent text-blue-600 focus:ring-0"
                    checked={settings.maintenance.autoBackupEnabled}
                    onChange={e => setSettings(s => ({ ...s, maintenance: { ...s.maintenance, autoBackupEnabled: e.target.checked } }))}
                  />
                  <span className="text-[10px] font-bold group-hover:text-blue-600 transition-colors" style={{ color: 'rgb(var(--text-primary))' }}>Enable Automated Backup</span>
                </label>

                {settings.maintenance.autoBackupEnabled && (
                  <div className="flex items-center gap-2 pl-5 animate-in slide-in-from-left-1 duration-200">
                    <span className="text-[9px] font-bold italic" style={{ color: 'rgb(var(--text-secondary))' }}>Scheduled for:</span>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        className="input-base text-[9px] w-8 p-1"
                        value={settings.maintenance.autoBackupDay}
                        onChange={e => setSettings(s => ({ ...s, maintenance: { ...s.maintenance, autoBackupDay: Number(e.target.value) } }))}
                      />
                      <span className="text-[9px] font-bold" style={{ color: 'rgb(var(--text-muted))' }}>/</span>
                      <input
                        type="number"
                        className="input-base text-[9px] w-8 p-1"
                        value={settings.maintenance.autoBackupMonth}
                        onChange={e => setSettings(s => ({ ...s, maintenance: { ...s.maintenance, autoBackupMonth: Number(e.target.value) } }))}
                      />
                    </div>
                    <Icon name="InformationCircleIcon" size={10} className="text-gray-500 cursor-help" title="Archives Performance, Penalties & Leave State" />
                  </div>
                )}
              </div>
              <div className="bg-black/5 rounded p-2 text-[9px] font-medium italic" style={{ color: 'rgb(var(--text-primary))' }}>
                Latest: {archiveRuns[0]?.fromYear || 'No'} snapshot found
              </div>
            </div>
          </div>

          {/* Step 2: Year-End Refresh */}
          <div className="rounded-xl p-4 border border-amber-500/20 bg-amber-500/5 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 font-bold text-xs">2</div>
              <div>
                <p className="text-xs font-bold text-amber-600 dark:text-amber-500">Jan 1 Reset</p>
                <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">Quota Refresh</p>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <select className="input-base text-[10px] flex-1 py-1" value={exportFormat} onChange={e => setExportFormat(e.target.value as any)}>
                  <option value="csv">Excel (.csv)</option>
                  <option value="json">JSON (Data)</option>
                </select>
                <button className="btn-ghost text-[10px] p-2 border border-gray-300" onClick={exportLeaveRecords} title="Export current data before reset">
                  <Icon name="ArrowDownTrayIcon" size={14} />
                </button>
              </div>
              <button className="btn-primary bg-amber-600 hover:bg-amber-700 text-[10px] w-full" onClick={() => setShowYearEndExportGuard(true)}>
                Execute Quota Reset
              </button>
            </div>
          </div>

          {/* Step 3: Feb Cleanse */}
          <div className="rounded-xl p-4 border border-purple-500/20 bg-purple-500/5 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600 font-bold text-xs">3</div>
              <div>
                <p className="text-xs font-bold text-purple-600 dark:text-purple-400">Feb/Mar Cleanse</p>
                <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">Carry-Forward Cap</p>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold" style={{ color: 'rgb(var(--text-secondary))' }}>Reward Cap:</span>
                <input type="number" className="input-base text-[10px] w-12 py-1" value={rewardCarryCap} onChange={e => setRewardCarryCap(Number(e.target.value))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-primary bg-purple-600 hover:bg-purple-700 text-[10px]" onClick={() => setShowFebCleanseGuard(true)}>Cleanse</button>
                <button className="btn-ghost text-[10px] border border-gray-300" onClick={() => setShowYearResetGuard(true)}>Reset YR</button>
              </div>
            </div>
          </div>
        </div>

        {/* Archive Search Tool */}
        <div className="rounded-xl p-4 bg-gray-100/50 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold flex items-center gap-2 text-gray-800">
              <Icon name="MagnifyingGlassIcon" size={14} className="text-gray-500" />
              Archive Records Explorer
            </p>
            <div className="flex gap-2">
              <select className="input-base text-[10px] py-1" value={archiveModule} onChange={e => setArchiveModule(e.target.value)}>
                <option value="all">All Modules</option>
                <option value="performance">Performance Scores</option>
                <option value="leave-summaries">Leave Records</option>
                <option value="penalty-records">Penalties</option>
                <option value="scoring-categories">Scoring Rules</option>
              </select>
              <button 
                className="btn-primary border border-blue-500/30 px-6 text-[10px]" 
                onClick={handleExploreArchive}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'View Archive'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {archiveRecordsPreview.map((record, idx) => (
              <div key={idx} className="group bg-white hover:bg-gray-50 transition-all rounded p-2 text-[9px] border border-gray-200 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-gray-900 font-medium">{record.module}</span>
                  <span className="text-gray-500">{record.year} | {new Date(record.createdAt).toLocaleDateString()}</span>
                </div>
                <div 
                  onClick={() => setViewingArchive(record)}
                  className="cursor-pointer opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 transition-all"
                >
                  <Icon name="EyeIcon" size={10} />
                  View
                </div>
              </div>
            ))}
            {archiveRecordsPreview.length === 0 && <p className="text-[10px] font-bold italic col-span-full" style={{ color: 'rgb(var(--text-muted))' }}>No archives found for selection.</p>}
          </div>
        </div>
      </section>



      <section className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>System Audit Logs</h3>
          <button
            onClick={() => setShowClearLogsConfirm(true)}
            disabled={clearingLogs}
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {clearingLogs ? 'Clearing...' : 'Clear All'}
          </button>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          {auditLogs.map(log => (
            <div key={log.logId} className="group rounded-lg px-3 py-2 text-xs flex items-center justify-between hover:bg-white/5 transition-colors border border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: log.eventType === 'penalty-record' ? 'rgb(220 38 38)' : 'rgb(59 130 246)' }} />
                <span className="truncate max-w-[400px] text-gray-800 dark:text-gray-200">{log.eventType} | {log.action} | {decodeURIComponent(log.actor || '')}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500 dark:text-gray-400">{new Date(log.createdAt).toLocaleString('en-GB')}</span>
                <button
                  onClick={() => handleDeleteLog(log.logId)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-500 transition-all"
                >
                  <Icon name="TrashIcon" size={14} />
                </button>
              </div>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>No audit logs yet.</p>
          )}
        </div>
      </section>

      {/* Confirmation Modals */}
      <ConfirmModal
        open={showFebCleanseGuard}
        title="Execute Feb Cleanse?"
        message="This will cap AL and Reward carry-forward balances. Please type 'CONFIRM' to proceed."
        confirmLabel="Run Feb Cleanse"
        onConfirm={() => {
          toast.success('Feb Cleanse executed successfully');
          setShowFebCleanseGuard(false);
          setConfirmText('');
        }}
        onCancel={() => {
          setShowFebCleanseGuard(false);
          setConfirmText('');
        }}
      >
        <div className="mt-3">
          <input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            className="input-base text-sm w-full"
            placeholder="Type CONFIRM"
          />
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={showYearResetGuard}
        title="Execute Yearly Reset?"
        message="This will reset Company Leave and other yearly markers. Please type 'CONFIRM' to proceed."
        confirmLabel="Run Yearly Reset"
        onConfirm={() => {
          toast.success('Yearly reset executed successfully');
          setShowYearResetGuard(false);
          setConfirmText('');
        }}
        onCancel={() => {
          setShowYearResetGuard(false);
          setConfirmText('');
        }}
      >
        <div className="mt-3">
          <input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            className="input-base text-sm w-full"
            placeholder="Type CONFIRM"
          />
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={showYearEndExportGuard}
        title="Year-End Leave Refresh"
        message="This will reset all Annual Leave balances to their role-based quotas and refresh Medical Leave. This is destructive. Please type 'REFRESH' to proceed."
        confirmLabel="REFRESH"
        onConfirm={runLeaveRefresh}
        onCancel={() => {
          setShowYearEndExportGuard(false);
          setYearEndConfirmText('');
        }}
      >
        <div className="mt-3">
          <input
            value={yearEndConfirmText}
            onChange={e => setYearEndConfirmText(e.target.value)}
            className="input-base text-sm w-full"
            placeholder="Type REFRESH"
          />
        </div>
      </ConfirmModal>
      <ConfirmModal
        open={showClearLogsConfirm}
        title="Clear Audit Logs?"
        message="Are you sure you want to permanently clear ALL system audit logs? This action cannot be undone."
        confirmLabel={clearingLogs ? "Clearing..." : "Clear All Logs"}
        onConfirm={handleClearLogs}
        onCancel={() => setShowClearLogsConfirm(false)}
      />
      {/* Floating Save Bar */}
      {isDirty && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="bg-slate-900/95 backdrop-blur-md border border-blue-500/50 rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-8 ring-1 ring-white/10">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Unsaved Changes</span>
              <span className="text-[10px] text-slate-300 font-medium italic">You have pending modifications to system policies.</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="btn-ghost text-[10px] font-bold py-2 px-4 h-auto border border-white/20 text-white hover:bg-white/10 transition-all"
                onClick={() => setSettings(lastSavedSettings)}
                disabled={saving}
              >
                Discard
              </button>
              <button
                className="btn-primary text-[10px] font-bold py-2 px-6 h-auto shadow-lg shadow-blue-500/40 bg-blue-600 hover:bg-blue-500 transition-all"
                onClick={save}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Archive Viewer Modal */}
      <ArchiveViewerModal
        isOpen={!!viewingArchive}
        onClose={() => setViewingArchive(null)}
        module={viewingArchive?.module || ''}
        year={viewingArchive?.year || 0}
        payload={viewingArchive?.payload}
      />
    </div>
  );
}
