import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAppContext } from '@/context/AppContext';
import { buildClientAuthHeaders, readClientIdentity } from '@/lib/clientAuth';
import LeavesBalanceCards from './LeavesBalanceCards';
import ProfileEditForm from './ProfileEditForm';
import Icon from '@/components/ui/AppIcon';
import ActivitiesCrudPanel from '@/app/admin-panel/components/ActivitiesCrudPanel';
import PenaltiesCrudPanel from '@/app/admin-panel/components/PenaltiesCrudPanel';

type PeriodFilter = 'all' | 'monthly' | 'quarterly' | 'yearly';

type UnifiedProfile = {
  employeeId: string;
  year: number;
  summary: {
    latestFinalScore: number;
    latestScoreStatus: string;
    approvedLeaveUnits: number;
    totalPenalties: number;
    activePenalties: number;
    wfhUsed?: number;
    wfhLimit?: number;
    provisionalMetrics?: {
      performance: number;
      participation: number;
      popularity: number;
    };
  };
  userMeta?: {
    name: string;
    email: string;
    role: string;
    dept: string;
    phone?: string;
    address?: string;
    emergencyContact?: string;
    preferredName?: string;
    bankDetails?: string;
    joinDate: string;
    reportsToId: string | null;
    reportsToName: string;
    profileUpdateStatus: string;
  };
  leaveHistory: Array<{
    id: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    units: number;
    status: string;
    requestedAt?: string;
    approvedAt?: string;
    movedToHistoryAt?: string;
  }>;
  performance: Array<{
    id: string;
    periodLabel: string;
    performance60: number;
    participation25: number;
    popularity15: number;
    penaltyDeduction: number;
    finalScore: number;
    status: string;
    approvedAt?: string;
  }>;
  penalties: Array<{
    id: string;
    penaltyTypeCode: string;
    penaltyDate: string;
    severity: 'low' | 'medium' | 'high';
    reason: string;
    status: 'active' | 'resolved';
    linkedLeaveRequestId?: string;
  }>;
  rewards?: Array<{ title: string; date?: string; year?: string; description: string }>;
  achievements?: Array<{ title: string; date?: string; description: string }>;
  experienceInOffice?: Array<{ title: string; period?: string; duration?: string; description: string }>;
};



const LEAVE_STATUS_OPTIONS = ['all', 'approved', 'pending', 'cancelled', 'rejected'];

export default function EmployeeUnifiedProfilePanel() {
  const { selectedYear, userId, userRole, userName, userDepartment } = useAppContext();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('all');
  const [showEditForm, setShowEditForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UnifiedProfile | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const authHeaders = useMemo(() => {
    return buildClientAuthHeaders({
      role: userRole as any,
      userId: userId,
      userName: userName,
      department: userDepartment
    });
  }, [userId, userRole, userName, userDepartment]);

  const employeeId = userId;

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        setLoading(true);
        const query = new URLSearchParams({
          employeeId,
          year: String(selectedYear),
        });

        if (periodFilter !== 'all') {
          query.set('periodType', periodFilter);
        }

        const response = await fetch(`/api/employee-profile?${query.toString()}`, {
          headers: authHeaders,
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load employee profile');
        }

        if (!cancelled) {
          setProfile(payload?.profile || null);
        }
      } catch (error) {
        if (!cancelled) {
          setProfile(null);
          toast.error(error instanceof Error ? error.message : 'Failed to load employee profile');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [authHeaders, employeeId, periodFilter, selectedYear, refreshNonce]);

  const filteredLeaveHistory = useMemo(() => {
    if (!profile) return [];
    if (leaveStatusFilter === 'all') return profile.leaveHistory;
    return profile.leaveHistory.filter(item => item.status === leaveStatusFilter);
  }, [leaveStatusFilter, profile]);

  const activePenaltyCount = profile?.penalties.filter(item => item.status === 'active').length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Unified Employee Profile</h3>
          <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
            Leave + Performance + Penalties in one profile timeline
          </p>
        </div>
        {profile?.userMeta?.profileUpdateStatus === 'pending_approval' && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 flex gap-2 text-[10px] text-amber-500 font-bold border-dashed animate-pulse">
            <Icon name="ClockIcon" size={12} />
            PENDING HR APPROVAL
          </div>
        )}
      </div>


      <div className="rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        {loading ? (
          <div className="p-4 text-sm">Loading profile...</div>
        ) : !profile ? (
          <div className="p-4 text-sm">Profile is unavailable.</div>
        ) : (
          <>
            <div className="p-4 space-y-8">

              {/* Basic Info Section */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Icon name="UserIcon" size={16} className="text-blue-500" />
                  Basic Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl p-4" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border-subtle))' }}>
                  <div className="space-y-1">
                    <p className="text-xs font-medium" style={{ color: 'rgb(var(--text-muted))' }}>Full Name</p>
                    <p className="text-sm font-semibold">{profile?.userMeta?.name || userName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium" style={{ color: 'rgb(var(--text-muted))' }}>Email Address</p>
                    <p className="text-sm font-semibold">{profile?.userMeta?.email || 'n/a'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium" style={{ color: 'rgb(var(--text-muted))' }}>Department</p>
                    <p className="text-sm font-semibold">{profile?.userMeta?.dept || userDepartment}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium" style={{ color: 'rgb(var(--text-muted))' }}>Reporting To</p>
                    <p className="text-sm font-semibold">{profile?.userMeta?.reportsToName || 'n/a'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium" style={{ color: 'rgb(var(--text-muted))' }}>Join Date</p>
                    <p className="text-sm font-semibold">{profile?.userMeta?.joinDate ? new Date(profile.userMeta.joinDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : 'n/a'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium" style={{ color: 'rgb(var(--text-muted))' }}>Employment Role</p>
                    <p className="text-sm font-semibold capitalize">{profile?.userMeta?.role || userRole}</p>
                  </div>
                </div>
              </div>

              {/* Leave Entitlements removed - now handled in sidebar/dashboard column */}

              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Icon name="TrophyIcon" size={16} className="text-amber-400" />
                  Rewards & Recognition
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(profile.rewards || []).map((item, idx) => (
                    <div key={`reward-${idx}`} className="rounded-xl p-4 border flex gap-4" style={{ background: 'rgba(251,191,36,0.05)', borderColor: 'rgba(251,191,36,0.1)' }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(251,191,36,0.1)' }}>
                        <Icon name="StarIcon" size={20} className="text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{item.title}</p>
                        <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                        <p className="text-[10px] mt-2 font-bold text-amber-500 uppercase tracking-wider">{item.year || item.date}</p>
                      </div>
                    </div>
                  ))}
                  {(profile.rewards || []).length === 0 && (
                    <p className="text-xs italic px-2 text-slate-500">No rewards recorded yet.</p>
                  )}
                </div>
              </div>

              {/* Key Achievements Section */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Icon name="AcademicCapIcon" size={16} className="text-emerald-400" />
                  Key Achievements
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(profile.achievements || []).map((item, idx) => (
                    <div key={`ach-${idx}`} className="rounded-xl p-4 border flex gap-4" style={{ background: 'rgba(52,211,153,0.05)', borderColor: 'rgba(52,211,153,0.1)' }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(52,211,153,0.1)' }}>
                        <Icon name="TrophyIcon" size={20} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{item.title}</p>
                        <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                        <p className="text-[10px] mt-2 font-bold text-emerald-500 uppercase tracking-wider">{item.date}</p>
                      </div>
                    </div>
                  ))}
                  {(profile.achievements || []).length === 0 && (
                    <p className="text-xs italic px-2 text-slate-500">No achievements recorded yet.</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Icon name="BriefcaseIcon" size={16} className="text-blue-400" />
                  Career History at Ezeem
                </h4>
                <div className="space-y-4">
                  {(profile.experienceInOffice || []).map((item, idx) => (
                    <div key={`exp-${idx}`} className="flex gap-4 relative">
                      {idx < (profile.experienceInOffice || []).length - 1 && (
                        <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-slate-800" />
                      )}
                      <div className="w-4 h-4 rounded-full mt-1.5 shrink-0 z-10" style={{ background: 'rgb(79 127 255)', boxShadow: '0 0 10px rgba(79,127,255,0.4)' }} />
                      <div className="pb-4">
                        <p className="text-sm font-bold text-white">{item.title}</p>
                        <p className="text-xs text-blue-400 font-medium mt-1">{item.period || item.duration}</p>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  ))}
                  {(profile.experienceInOffice || []).length === 0 && (
                    <p className="text-xs italic px-2 text-slate-500">No career history found.</p>
                  )}
                </div>
              </div>

              {/* Leave History Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Icon name="CalendarIcon" size={16} className="text-amber-500" />
                    Leave History
                  </h4>
                  <div className="flex items-center gap-2">
                    <label className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>Status</label>
                    <select
                      className="input-base text-xs py-1"
                      value={leaveStatusFilter}
                      onChange={event => setLeaveStatusFilter(event.target.value)}
                    >
                      {LEAVE_STATUS_OPTIONS.map(status => (
                        <option key={`status-${status}`} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'rgb(var(--bg-elevated))', borderBottom: '1px solid rgb(var(--border-subtle))' }}>
                        <th className="text-left px-3 py-2">Leave Type</th>
                        <th className="text-left px-3 py-2">Start</th>
                        <th className="text-left px-3 py-2">End</th>
                        <th className="text-right px-3 py-2">Units</th>
                        <th className="text-left px-3 py-2">Status</th>
                        <th className="text-left px-3 py-2">Moved To History</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
                      {(filteredLeaveHistory || []).map(item => (
                        <tr key={`leave-row-${item.id}`} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2">{item.leaveType}</td>
                          <td className="px-3 py-2">{item.startDate}</td>
                          <td className="px-3 py-2">{item.endDate}</td>
                          <td className="px-3 py-2 text-right">{item.units}</td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold" style={{
                              background: item.status === 'approved' ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
                              color: item.status === 'approved' ? 'rgb(52 211 153)' : 'rgb(251 191 36)'
                            }}>{item.status}</span>
                          </td>
                          <td className="px-3 py-2">{item.movedToHistoryAt || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredLeaveHistory.length === 0 && <div className="text-xs p-4 text-center" style={{ color: 'rgb(var(--text-muted))' }}>No leave history for this filter.</div>}
                </div>
              </div>
              {/* Penalties Section */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Icon name="ExclamationTriangleIcon" size={16} className="text-red-500" />
                  Penalties History
                </h4>
                <PenaltiesCrudPanel 
                  embedded={true} 
                  externalEmployeeId={profile.employeeId} 
                  canEdit={false} 
                  canDelete={false}
                  showAddButton={false}
                  allowCashPenalties={false}
                />
              </div>

              {/* Activities Scoring Section */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Icon name="ClipboardDocumentListIcon" size={16} className="text-blue-500" />
                  Detailed Activity Scoring Breakdown
                </h4>
                <ActivitiesCrudPanel 
                  embedded={true} 
                  externalEmployeeId={profile.employeeId} 
                  canEdit={false} 
                  canDelete={false}
                  showFilters={false}
                  showAddButton={false}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {showEditForm && (
        <ProfileEditForm
          currentData={{
            name: profile?.userMeta?.name || userName || '',
            email: profile?.userMeta?.email || '',
            phone: profile?.userMeta?.phone || '',
            address: profile?.userMeta?.address || '',
            emergencyContact: profile?.userMeta?.emergencyContact || '',
            preferredName: profile?.userMeta?.preferredName || '',
            bankDetails: profile?.userMeta?.bankDetails || '',
          }}
          onClose={() => setShowEditForm(false)}
          onSuccess={() => {
            setShowEditForm(false);
            setRefreshNonce(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
}
