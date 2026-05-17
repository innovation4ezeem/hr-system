'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { useAppContext } from '@/context/AppContext';

type Activity = {
  id: string;
  activityName: string;
  date: string;
  year: number;
  sourceFolder: string;
  month: string;
  category: string;
  scoreBucket: string;
  score: number;
  assignedToName: string;
  description?: string;
  attachmentName?: string;
  attachmentUrl?: string;
};

interface EmployeeRecentActivitiesProps {
  employeeName?: string;
  compact?: boolean;
}

const getCategoryColor = (category: string) => {
  const categoryMap: Record<string, { bg: string; badge: string; text: string }> = {
    'Performance': { bg: 'rgba(249, 115, 22, 0.12)', badge: 'rgba(249, 115, 22, 0.2)', text: 'rgb(249 115 22)' },
    'Participation': { bg: 'rgba(34, 197, 94, 0.12)', badge: 'rgba(34, 197, 94, 0.2)', text: 'rgb(34 197 94)' },
    'Popularity': { bg: 'rgba(168, 85, 247, 0.12)', badge: 'rgba(168, 85, 247, 0.2)', text: 'rgb(168 85 247)' },
    'OKR Review': { bg: 'rgba(79, 127, 255, 0.12)', badge: 'rgba(79, 127, 255, 0.2)', text: 'rgb(79 127 255)' },
  };

  return categoryMap[category] || { bg: 'rgba(107, 114, 128, 0.12)', badge: 'rgba(107, 114, 128, 0.2)', text: 'rgb(107 114 128)' };
};

export default function EmployeeRecentActivities({ employeeName, compact = false }: EmployeeRecentActivitiesProps) {
  const { selectedYear, userName } = useAppContext();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const targetName = (employeeName || userName || '').trim();

  useEffect(() => {
    let cancelled = false;

    const loadActivities = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ year: String(selectedYear) });
        if (targetName) {
          params.set('employeeName', targetName);
        }
        const response = await fetch(`/api/activity-scores?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to load activity records');

        const payload = await response.json();
        if (!cancelled && Array.isArray(payload?.entries)) {
          setActivities(payload.entries as Activity[]);
        }
      } catch {
        if (!cancelled) {
          toast.error('Failed to load activities');
          setActivities([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadActivities();
    return () => {
      cancelled = true;
    };
  }, [selectedYear, targetName]);

  const uniqueMonths = useMemo(() => {
    const months = Array.from(new Set(activities.map(a => a.month)));
    return months.sort((a, b) => {
      const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return monthOrder.indexOf(a) - monthOrder.indexOf(b);
    });
  }, [activities]);

  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      if (selectedMonth !== 'All' && activity.month !== selectedMonth) return false;
      if (searchQuery && !activity.activityName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [activities, selectedMonth, searchQuery]);

  const groupedByMonth = useMemo(() => {
    return filteredActivities.reduce(
      (acc, activity) => {
        if (!acc[activity.month]) acc[activity.month] = [];
        acc[activity.month].push(activity);
        return acc;
      },
      {} as Record<string, Activity[]>,
    );
  }, [filteredActivities]);

  const displayedActivities = compact ? filteredActivities.slice(0, 5) : filteredActivities;

  return (
    <div className="space-y-6">
      {/* Filters */}
      {!compact && (
        <div className="rounded-xl p-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Month Filter */}
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>
                Month
              </label>
              <select className="input-base text-sm w-full" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                <option value="All">All Months</option>
                {uniqueMonths.map(month => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgb(var(--text-muted))' }}>
                Activity Name
              </label>
              <input
                type="text"
                className="input-base text-sm w-full"
                placeholder="Search activities..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Stats */}
            <div className="flex items-end gap-2">
              <div className="rounded-lg px-3 py-2 flex-1" style={{ background: 'rgba(79, 127, 255, 0.1)' }}>
                <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Total Activities</p>
                <p className="text-lg font-bold" style={{ color: 'rgb(79 127 255)' }}>{filteredActivities.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}

      {/* Activities Table */}
      {!loading && filteredActivities.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <Icon name="SparklesIcon" size={32} className="mx-auto mb-3" style={{ color: 'rgb(var(--text-muted))' }} />
          <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
            No activities found {selectedMonth !== 'All' && `for ${selectedMonth}`}
          </p>
        </div>
      ) : compact ? (
        <div className="rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Activity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Attachment</th>
              </tr>
            </thead>
            <tbody>
              {displayedActivities.map(activity => {
                const colors = getCategoryColor(activity.category);
                return (
                  <tr key={activity.id} style={{ borderBottom: '1px solid rgb(var(--border))' }}>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-primary))' }}>
                      {activity.activityName.length > 40 ? activity.activityName.substring(0, 40) + '...' : activity.activityName}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                      {activity.date}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: colors.badge, color: colors.text }}>
                        {activity.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {activity.attachmentUrl ? (
                        <button
                          onClick={() => window.open(activity.attachmentUrl, '_blank', 'noopener,noreferrer')}
                          className="inline-flex items-center gap-1"
                          style={{ color: 'rgb(79 127 255)' }}
                        >
                          <Icon name="PaperClipIcon" size={12} />
                          {activity.attachmentName || 'View'}
                        </button>
                      ) : (
                        <span style={{ color: 'rgb(var(--text-muted))' }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {displayedActivities.length < filteredActivities.length && (
            <div className="px-4 py-3 text-center border-t" style={{ borderColor: 'rgb(var(--border))' }}>
              <button className="text-xs" style={{ color: 'rgb(79 127 255)' }}>
                View all {filteredActivities.length} activities →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.keys(groupedByMonth)
            .sort((a, b) => {
              const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
              return monthOrder.indexOf(b) - monthOrder.indexOf(a);
            })
            .map(month => (
              <div key={month}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>
                  {month}
                </h3>
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgb(var(--border-subtle))' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                        <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Activity</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Source Folder</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Category</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Score</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Description</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'rgb(var(--text-muted))' }}>Attachment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedByMonth[month].map(activity => {
                        const colors = getCategoryColor(activity.category);
                        return (
                          <tr key={activity.id} style={{ borderBottom: '1px solid rgb(var(--border))' }}>
                            <td className="px-4 py-3 text-sm" style={{ color: 'rgb(var(--text-primary))' }}>
                              <div className="font-medium">{activity.activityName}</div>
                              <div className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
                                {activity.id}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                              {activity.date}
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                              {activity.sourceFolder}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: colors.badge, color: colors.text }}>
                                {activity.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                              {activity.score} ({activity.scoreBucket})
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                              {activity.description}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {activity.attachmentUrl ? (
                                <button
                                  onClick={() => window.open(activity.attachmentUrl, '_blank', 'noopener,noreferrer')}
                                  className="inline-flex items-center gap-1"
                                  style={{ color: 'rgb(79 127 255)' }}
                                >
                                  <Icon name="PaperClipIcon" size={12} />
                                  {activity.attachmentName || 'Open'}
                                </button>
                              ) : (
                                <span style={{ color: 'rgb(var(--text-muted))' }}>No attachment</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
