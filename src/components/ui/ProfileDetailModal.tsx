'use client';
import React, { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

interface ProfileData {
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
  experiences?: { year?: string; period?: string; title: string; dept: string; duration: string }[];
  rewards?: { year?: string; date?: string; title: string; description: string }[];
  achievements?: { title: string; description: string; date?: string }[];
  performanceHistory?: { year: number; score: number; grade: string; periodLabel?: string }[];
  profileUpdateStatus?: string;
  lastUpdatedAt?: string | null;
}

interface ProfileDetailModalProps {
  open: boolean;
  onClose: () => void;
  profile: ProfileData;
  onEdit?: () => void;
}

export default function ProfileDetailModal({ open, onClose, profile, onEdit }: ProfileDetailModalProps) {
  const { buildAuthHeaders } = useAppContext();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [downloading, setDownloading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const formatLastUpdated = (value?: string | null) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return new Intl.DateTimeFormat('en-MY', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...buildAuthHeaders()
        },
        body: JSON.stringify({ newPassword }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to change password');
      }
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
      setActiveTab('profile');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);
      const response = await fetch('/api/profile/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${profile.name.replace(/\s+/g, '_')}_Profile.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Profile PDF downloaded successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in max-h-[90vh] flex flex-col"
        style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border))' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'rgb(var(--border-subtle))', background: 'rgb(var(--bg-elevated))' }}>
          <h2 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Employee Profile</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'rgb(var(--text-secondary))' }}>
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex px-6 border-b" style={{ borderColor: 'rgb(var(--border-subtle))', background: 'rgb(var(--bg-elevated))' }}>
          <button onClick={() => setActiveTab('profile')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'profile' ? 'border-blue-500 text-blue-500' : 'border-transparent'}`} style={{ color: activeTab === 'profile' ? 'rgb(79 127 255)' : 'rgb(var(--text-secondary))' }}>Overview</button>
          <button onClick={() => setActiveTab('security')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'security' ? 'border-blue-500 text-blue-500' : 'border-transparent'}`} style={{ color: activeTab === 'security' ? 'rgb(79 127 255)' : 'rgb(var(--text-secondary))' }}>Security</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {activeTab === 'security' ? (
            <div className="px-6 py-8 flex items-center justify-center">
              <form onSubmit={handleChangePassword} className="w-full max-w-sm space-y-4">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Change Password</h3>
                  <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>Ensure your account is using a long, random password to stay secure.</p>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input-base" placeholder="Min 8 characters" required minLength={8} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>Confirm New Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="input-base" placeholder="Retype new password" required minLength={8} />
                </div>
                <button type="submit" disabled={isChangingPassword} className="btn-primary w-full py-2.5 flex justify-center">
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          ) : (
            <>
          {/* Profile Hero */}
          <div className="px-6 py-5 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
            {profile.profileUpdateStatus === 'pending_approval' && (
              <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-3 text-xs text-amber-500 animate-pulse">
                <Icon name="ClockIcon" size={18} className="shrink-0" />
                <div>
                  <p className="font-bold uppercase tracking-wider">Update Pending Approval</p>
                  <p className="opacity-80">You have changes waiting for admin review. Some fields below might still show older data.</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
                style={{ background: 'rgba(79,127,255,0.2)', color: 'rgb(79 127 255)', border: '2px solid rgba(79,127,255,0.3)' }}>
                {(profile.name || 'User').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h3 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{profile.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(52,211,153,0.1)', color: 'rgb(52 211 153)', border: '1px solid rgba(52,211,153,0.2)' }}>
                    {profile.status}
                  </span>
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1"
                    style={{ background: 'rgba(79,127,255,0.1)', color: 'rgb(147 197 253)', border: '1px solid rgba(79,127,255,0.25)' }}
                    title={profile.lastUpdatedAt || 'N/A'}
                  >
                    <Icon name="ClockIcon" size={12} />
                    Last updated: {formatLastUpdated(profile.lastUpdatedAt)}
                  </span>
                </div>
                <p className="text-sm mb-2" style={{ color: 'rgb(var(--text-secondary))' }}>
                  {profile.role} · {profile.dept}
                </p>
                <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                  <span className="flex items-center gap-1">
                    <Icon name="IdentificationIcon" size={12} className="text-blue-400" />
                    {profile.id}
                  </span>
                  <span className="flex items-center gap-1">
                    <Icon name="EnvelopeIcon" size={12} className="text-purple-400" />
                    {profile.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Icon name="PhoneIcon" size={12} className="text-emerald-400" />
                    {profile.phone}
                  </span>
                </div>
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Year Joined', value: (profile.joinDate || '').split('/')[2] || 'TBD', icon: 'CalendarIcon', color: 'rgb(79 127 255)' },
                { label: 'Tenure', value: `${profile.yearsService || 0}y ${profile.monthsService || 0}m`, icon: 'ClockIcon', color: 'rgb(251 191 36)' },
                { label: 'Reports To', value: (profile.reportTo || 'N/A').split(' ')[0], icon: 'UserIcon', color: 'rgb(167 139 250)' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border))' }}>
                  <Icon name={s.icon as never} size={16} style={{ color: s.color }} className="mx-auto mb-1" />
                  <p className="text-sm font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Performance History */}
          <div className="px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'rgb(var(--text-primary))' }}>
              <Icon name="ChartBarIcon" size={14} className="text-blue-400" />
              Performance History
            </h4>
            <div className="space-y-2">
              {(profile.performanceHistory || [])
                .filter(ph => !ph.periodLabel || ph.periodLabel.toLowerCase().includes('annual') || ph.periodLabel.toLowerCase().includes('yearly'))
                .map((ph, idx) => (
                  <div key={`ph-${ph.year}-${idx}`} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-24 flex-shrink-0" style={{ color: 'rgb(var(--text-muted))' }}>
                    {ph.year} {ph.periodLabel && <span className="opacity-60 text-[10px]">({ph.periodLabel})</span>}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${ph.score}%`, background: ph.score >= 80 ? 'rgb(52 211 153)' : ph.score >= 60 ? 'rgb(251 191 36)' : 'rgb(248 113 113)' }} />
                  </div>
                  <span className="text-xs font-mono font-bold w-10 text-right"
                    style={{ color: ph.score >= 80 ? 'rgb(52 211 153)' : ph.score >= 60 ? 'rgb(251 191 36)' : 'rgb(248 113 113)', fontVariantNumeric: 'tabular-nums' }}>
                    {ph.score}%
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded font-medium w-8 text-center"
                    style={{ background: ph.score >= 80 ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', color: ph.score >= 80 ? 'rgb(52 211 153)' : 'rgb(251 191 36)' }}>
                    {ph.grade}
                  </span>
                </div>
              ))}
              {(!profile.performanceHistory || profile.performanceHistory.length === 0) && (
                <p className="text-xs italic px-1" style={{ color: 'rgb(var(--text-muted))' }}>No performance history available.</p>
              )}
            </div>
          </div>

          {/* Experiences */}
          <div className="px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'rgb(var(--text-primary))' }}>
              <Icon name="BriefcaseIcon" size={14} className="text-purple-400" />
              Career History at Ezeem
            </h4>
            <div className="space-y-3">
              {(profile.experiences || []).map((exp, i) => (
                <div key={`exp-${i}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'rgb(79 127 255)' }} />
                    {i < (profile.experiences || []).length - 1 && <div className="w-0.5 flex-1 mt-1" style={{ background: 'rgb(var(--border-subtle))' }} />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{exp.title}</p>
                    <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{exp.dept} · {exp.duration}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgb(79 127 255)' }}>{exp.year || exp.period}</p>
                  </div>
                </div>
              ))}
              {(!profile.experiences || profile.experiences.length === 0) && (
                <p className="text-xs italic px-1" style={{ color: 'rgb(var(--text-muted))' }}>No experience records found.</p>
              )}
            </div>
          </div>

          {/* Achievements */}
          <div className="px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'rgb(var(--text-primary))' }}>
              <Icon name="AcademicCapIcon" size={14} className="text-emerald-400" />
              Key Achievements
            </h4>
            <div className="space-y-2">
              {(profile.achievements || []).map((ach, i) => (
                <div key={`ach-${i}`} className="flex items-start gap-3 rounded-xl p-3"
                  style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.1)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(52,211,153,0.15)' }}>
                    <Icon name="AcademicCapIcon" size={14} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{ach.title}</p>
                    <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{ach.description}</p>
                    <p className="text-[10px] mt-1 font-bold text-emerald-500 uppercase tracking-widest">{ach.date}</p>
                  </div>
                </div>
              ))}
              {(!profile.achievements || profile.achievements.length === 0) && (
                <p className="text-xs italic px-1" style={{ color: 'rgb(var(--text-muted))' }}>No achievements recorded yet.</p>
              )}
            </div>
          </div>
 
          {/* Rewards */}
          <div className="px-6 py-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'rgb(var(--text-primary))' }}>
              <Icon name="TrophyIcon" size={14} className="text-amber-400" />
              Rewards & Recognition
            </h4>
            <div className="space-y-2">
              {(profile.rewards || []).map((r, i) => (
                <div key={`rew-${i}`} className="flex items-start gap-3 rounded-xl p-3"
                  style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.1)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(251,191,36,0.15)' }}>
                    <Icon name="StarIcon" size={14} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{r.title}</p>
                    <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>{r.description}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgb(251 191 36)' }}>{r.year || r.date}</p>
                  </div>
                </div>
              ))}

              {(!profile.rewards || profile.rewards.length === 0) && (
                <p className="text-xs italic px-1" style={{ color: 'rgb(var(--text-muted))' }}>No rewards recorded yet.</p>
              )}
            </div>
          </div>
            </>
          )}
        </div>

        {/* Footer with Download Button */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0"
          style={{ borderColor: 'rgb(var(--border-subtle))', background: 'rgb(var(--bg-elevated))' }}>
          <button
            onClick={onClose}
            className="btn-ghost"
          >
            Close
          </button>
          
          {activeTab === 'profile' && (
            <div className="flex items-center gap-3">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex items-center gap-2"
                >
                  <Icon name="PencilSquareIcon" size={14} />
                  Edit Profile
                </button>
              )}
              <button
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="btn-primary flex items-center gap-2"
              >
                <Icon name="ArrowDownTrayIcon" size={14} />
                {downloading ? 'Downloading...' : 'Download PDF'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
