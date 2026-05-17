'use client';
import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { formatToDisplayDate } from '@/lib/dateUtils';

type ActivityLog = {
  id: string;
  actor_id: string;
  actor_name: string;
  action_type: string;
  module: string;
  description: string;
  payload: any;
  created_at: string;
};

export default function ActivityAuditLogPanel() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('all');

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const url = moduleFilter === 'all' 
          ? '/api/activity-logs?limit=100' 
          : `/api/activity-logs?limit=100&module=${moduleFilter}`;
        const res = await fetch(url);
        const data = await res.json();
        setLogs(data.logs || []);
      } catch (err) {
        console.error('Failed to fetch activity logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [moduleFilter]);

  const getActionColor = (action: string) => {
    if (action.includes('SUBMIT') || action.includes('APPLY')) return 'text-blue-400';
    if (action.includes('APPROVE') || action.includes('RESOLVE')) return 'text-green-400';
    if (action.includes('REJECT') || action.includes('CANCEL')) return 'text-red-400';
    if (action.includes('ADD') || action.includes('CREATE')) return 'text-amber-400';
    return 'text-gray-400';
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Icon name="ClipboardDocumentListIcon" size={18} className="text-blue-500" />
          System Activity Audit Trail
        </h3>
        <select 
          className="input-base text-xs py-1"
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
        >
          <option value="all">All Modules</option>
          <option value="LEAVE">Leave Management</option>
          <option value="PENALTY">Penalties</option>
          <option value="AUTH">Authentication</option>
          <option value="PROFILE">Profile Updates</option>
        </select>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border-subtle))' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b" style={{ background: 'rgb(var(--bg-elevated))', borderColor: 'rgb(var(--border-subtle))' }}>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-gray-500">Timestamp</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-gray-500">Actor</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-gray-500">Action</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-gray-500">Module</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-gray-500">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No activity logs found.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-400">
                    {new Date(log.created_at).toLocaleString('en-MY', { 
                      day: '2-digit', month: '2-digit', year: 'numeric', 
                      hour: '2-digit', minute: '2-digit', second: '2-digit' 
                    })}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {log.actor_name || log.actor_id}
                  </td>
                  <td className={`px-4 py-3 font-bold ${getActionColor(log.action_type)}`}>
                    {log.action_type}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-700 text-gray-300">
                      {log.module}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {log.description}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
