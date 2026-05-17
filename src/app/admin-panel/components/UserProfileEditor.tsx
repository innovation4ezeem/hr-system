'use client';
import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { isValidMalaysiaPhone } from '@/lib/dateUtils';
import InlineEditableField from '@/components/ui/InlineEditableField';

export interface UserProfile {
  id: string;
  name: string;
  preferred_name?: string | null;
  email: string;
  phone_number?: string | null;
  address?: string | null;
  mailing_address?: string | null;
  emergency_contact?: string | null;
  bank_details?: string | null;
  join_date?: string | null;
  reportsToId?: string | null;
  role: string;
  dept: string;
  lastUpdatedAt?: string | null;
  rewards?: Array<{ title?: string; date?: string; year?: string; description?: string }>;
  achievements?: Array<{ title?: string; date?: string; description?: string }>;
  experienceInOffice?: Array<{ 
    title?: string; 
    period?: string; 
    duration?: string; 
    dept?: string; 
    description?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
  }>;
}

interface UserProfileEditorProps {
  user: UserProfile;
  onSave?: (user: UserProfile) => void;
  onClose?: () => void;
  allUsers?: any[];
}

export default function UserProfileEditor({ user, onSave, onClose, allUsers = [] }: UserProfileEditorProps) {
  const [profile, setProfile] = useState<UserProfile>(user);
  const [editingTab, setEditingTab] = useState<'personal' | 'rewards' | 'security'>('personal');
  const [isSaving, setIsSaving] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [newPassword, setNewPassword] = useState('');

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

  const updateArrayField = (
    field: 'rewards' | 'achievements' | 'experienceInOffice',
    index: number,
    value: Record<string, unknown>,
  ) => {
    const current = Array.isArray(profile[field]) ? [...(profile[field] as any[])] : [];
    const updatedItem = { ...(current[index] || {}), ...value };
    
    // Auto-update period string for compatibility
    if (field === 'experienceInOffice') {
      const s = updatedItem.startDate || '';
      const e = updatedItem.isCurrent ? 'Present' : (updatedItem.endDate || '');
      if (s || e) {
        updatedItem.period = `${s} - ${e}`;
      }
    }
    
    current[index] = updatedItem;
    setProfile({ ...profile, [field]: current });
  };

  const addArrayItem = (field: 'rewards' | 'achievements' | 'experienceInOffice') => {
    const current = Array.isArray(profile[field]) ? [...(profile[field] as any[])] : [];
    const item = field === 'experienceInOffice'
      ? { title: '', dept: profile.dept || '', period: '', duration: '', description: '' }
      : { title: '', date: '', description: '' };
    setProfile({ ...profile, [field]: [...current, item] });
  };

  const removeArrayItem = (field: 'rewards' | 'achievements' | 'experienceInOffice', index: number) => {
    const current = Array.isArray(profile[field]) ? [...(profile[field] as any[])] : [];
    setProfile({ ...profile, [field]: current.filter((_, i) => i !== index) });
  };

  useEffect(() => {
    if (editingTab === 'security') {
      fetchLogs();
    }
  }, [editingTab]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/activity-logs?employeeId=${profile.id}&limit=20`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSave = async () => {
    toast.info('Changes are now saved automatically');
  };
  
  const handleAutoSave = async (fieldKey: string, newValue: string | any[]) => {
    // Field mapping to API expected names
    const apiFieldMap: Record<string, string> = {
      name: 'name',
      preferred_name: 'preferredName',
      phone_number: 'phone',
      address: 'address',
      mailing_address: 'mailingAddress',
      emergency_contact: 'emergencyContact',
      bank_details: 'bankDetails',
      rewards: 'rewards',
      achievements: 'achievements',
      experienceInOffice: 'experienceInOffice'
    };

    const apiField = apiFieldMap[fieldKey] || fieldKey;

    try {
      const response = await fetch('/api/profile/update-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          employeeId: profile.id,
          requestedChanges: { [apiField]: newValue }
        }),
      });

      if (!response.ok) throw new Error('Failed to auto-save field');
      const result = await response.json().catch(() => ({}));
      const updatedAt = typeof result?.updatedAt === 'string' ? result.updatedAt : new Date().toISOString();
      
      const nextProfile = { ...profile, [fieldKey]: newValue, lastUpdatedAt: updatedAt };
      setProfile(nextProfile);
      onSave?.(nextProfile);
    } catch (error) {
      console.error(`Auto-save failed for ${fieldKey}:`, error);
      throw error;
    }
  };

  const updateAndSaveArrayField = async (
    field: 'rewards' | 'achievements' | 'experienceInOffice',
    index: number,
    value: Record<string, unknown>,
  ) => {
    const current = Array.isArray(profile[field]) ? [...(profile[field] as any[])] : [];
    const updatedItem = { ...(current[index] || {}), ...value };
    
    if (field === 'experienceInOffice') {
      const s = updatedItem.startDate || '';
      const e = updatedItem.isCurrent ? 'Present' : (updatedItem.endDate || '');
      if (s || e) {
        updatedItem.period = `${s} - ${e}`;
      }
    }
    
    current[index] = updatedItem;
    await handleAutoSave(field, current);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, newPassword }),
      });
      if (!res.ok) throw new Error('Failed to change password');
      toast.success('Password updated successfully');
      setNewPassword('');
    } catch (err) {
      toast.error('Failed to change password');
    }
  };

  return (
    <div className="rounded-xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-900">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
        <div>
          <h3 className="text-xl font-bold text-white">{profile.name}</h3>
          <p className="text-xs text-slate-400 mt-1">{profile.email} • {profile.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold text-slate-200"
            style={{ borderColor: 'rgba(148,163,184,0.35)', background: 'rgba(15,23,42,0.7)' }}
            title={profile.lastUpdatedAt || 'N/A'}
          >
            <Icon name="ClockIcon" size={12} className="text-blue-300" />
            Last updated: {formatLastUpdated(profile.lastUpdatedAt)}
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
          >
            <Icon name="XMarkIcon" size={24} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/30">
        <button
          onClick={() => setEditingTab('personal')}
          className={`flex-1 px-4 py-4 text-sm font-bold transition-all border-b-2 ${
            editingTab === 'personal' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Icon name="UserIcon" size={18} />
            Personal Data
          </div>
        </button>
        <button
          onClick={() => setEditingTab('rewards')}
          className={`flex-1 px-4 py-4 text-sm font-bold transition-all border-b-2 ${
            editingTab === 'rewards' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Icon name="TrophyIcon" size={18} />
            Rewards & Exp
          </div>
        </button>
        <button
          onClick={() => setEditingTab('security')}
          className={`flex-1 px-4 py-4 text-sm font-bold transition-all border-b-2 ${
            editingTab === 'security' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Icon name="ShieldCheckIcon" size={18} />
            Security
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="p-6 max-h-[600px] overflow-y-auto custom-scrollbar">
        {editingTab === 'personal' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                <InlineEditableField
                  initialValue={profile.name}
                  onSave={(val) => handleAutoSave('name', val)}
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preferred Name</label>
                <InlineEditableField
                  initialValue={profile.preferred_name || ''}
                  onSave={(val) => handleAutoSave('preferred_name', val)}
                  placeholder="Tony Stark"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                <div className="px-3 py-2 text-sm bg-slate-800/30 border border-slate-800 rounded-lg text-slate-500 italic">
                  {profile.email} (Read-only)
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                <InlineEditableField
                  initialValue={profile.phone_number || ''}
                  onSave={(val) => handleAutoSave('phone_number', val)}
                  placeholder="+6012-3456789"
                  validate={(val) => val && !isValidMalaysiaPhone(val) ? 'Invalid phone format (+60xx-xxxxxxx)' : null}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Home Address</label>
              <InlineEditableField
                type="textarea"
                initialValue={profile.address || ''}
                onSave={(val) => handleAutoSave('address', val)}
                placeholder="Full residential address"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mailing Address</label>
              <InlineEditableField
                type="textarea"
                initialValue={profile.mailing_address || ''}
                onSave={(val) => handleAutoSave('mailing_address', val)}
                placeholder="Full correspondence address"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Emergency Contact</label>
                <InlineEditableField
                  initialValue={profile.emergency_contact || ''}
                  onSave={(val) => handleAutoSave('emergency_contact', val)}
                  placeholder="Name & Relation"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bank Details</label>
                <InlineEditableField
                  initialValue={profile.bank_details || ''}
                  onSave={(val) => handleAutoSave('bank_details', val)}
                  placeholder="Bank Name & Acc No."
                />
              </div>
            </div>
          </div>
        )}

        {editingTab === 'rewards' && (
          <div className="space-y-8 animate-fade-in">
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Icon name="GiftIcon" size={18} className="text-amber-400" />
                  Rewards & Awards
                </h4>
                <button onClick={() => addArrayItem('rewards')} className="text-xs font-bold text-blue-400 hover:text-blue-300">+ Add Reward</button>
              </div>
              <div className="space-y-3">
                {(profile.rewards || []).length === 0 && <p className="text-xs text-slate-500 italic">No rewards recorded.</p>}
                {(profile.rewards || []).map((item, idx) => (
                  <div key={`rew-${idx}`} className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 space-y-2 relative group">
                    <div className="grid grid-cols-2 gap-2">
                      <InlineEditableField
                        initialValue={item.title || ''}
                        onSave={(val) => updateAndSaveArrayField('rewards', idx, { title: val })}
                        placeholder="Reward Title"
                        textClassName="text-xs font-bold text-white"
                      />
                      <InlineEditableField
                        initialValue={item.date || item.year || ''}
                        onSave={(val) => updateAndSaveArrayField('rewards', idx, { date: val, year: val })}
                        placeholder="2024"
                        textClassName="text-xs text-amber-400 font-mono"
                      />
                    </div>
                    <InlineEditableField
                      type="textarea"
                      initialValue={item.description || ''}
                      onSave={(val) => updateAndSaveArrayField('rewards', idx, { description: val })}
                      placeholder="Achievement details..."
                      textClassName="text-xs text-slate-400"
                    />
                    <button 
                      onClick={async () => {
                        const next = (profile.rewards || []).filter((_, i) => i !== idx);
                        await handleAutoSave('rewards', next);
                      }} 
                      className="absolute top-2 right-2 p-1 rounded hover:bg-red-400/10 text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Icon name="TrashIcon" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Icon name="AcademicCapIcon" size={18} className="text-emerald-400" />
                  Key Achievements
                </h4>
                <button onClick={() => addArrayItem('achievements')} className="text-xs font-bold text-blue-400 hover:text-blue-300">+ Add Achievement</button>
              </div>
              <div className="space-y-3">
                {(profile.achievements || []).length === 0 && <p className="text-xs text-slate-500 italic">No achievements recorded.</p>}
                {(profile.achievements || []).map((item, idx) => (
                  <div key={`ach-${idx}`} className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 space-y-2 relative group">
                    <div className="grid grid-cols-2 gap-2">
                      <InlineEditableField
                        initialValue={item.title || ''}
                        onSave={(val) => updateAndSaveArrayField('achievements', idx, { title: val })}
                        placeholder="Achievement Name"
                        textClassName="text-xs font-bold text-white"
                      />
                      <InlineEditableField
                        initialValue={item.date || ''}
                        onSave={(val) => updateAndSaveArrayField('achievements', idx, { date: val })}
                        placeholder="Month YYYY"
                        textClassName="text-xs text-emerald-400 font-mono"
                      />
                    </div>
                    <InlineEditableField
                      type="textarea"
                      initialValue={item.description || ''}
                      onSave={(val) => updateAndSaveArrayField('achievements', idx, { description: val })}
                      placeholder="Describe the impact..."
                      textClassName="text-xs text-slate-400"
                    />
                    <button 
                      onClick={async () => {
                        const next = (profile.achievements || []).filter((_, i) => i !== idx);
                        await handleAutoSave('achievements', next);
                      }} 
                      className="absolute top-2 right-2 p-1 rounded hover:bg-red-400/10 text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Icon name="TrashIcon" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Icon name="BriefcaseIcon" size={18} className="text-blue-400" />
                  Experience in Company
                </h4>
                <button onClick={() => addArrayItem('experienceInOffice')} className="text-xs font-bold text-blue-400 hover:text-blue-300">+ Add Experience</button>
              </div>
              <div className="space-y-3">
                {(profile.experienceInOffice || []).length === 0 && <p className="text-xs text-slate-500 italic">No company experience recorded.</p>}                {(profile.experienceInOffice || []).map((item, idx) => (
                  <div key={`exp-${idx}`} className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 space-y-4 relative group">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Role Title</label>
                        <InlineEditableField
                          initialValue={item.title || ''}
                          onSave={(val) => updateAndSaveArrayField('experienceInOffice', idx, { title: val })}
                          placeholder="Ex: Senior Executive"
                          textClassName="text-xs font-semibold text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Department</label>
                        <InlineEditableField
                          initialValue={item.dept || ''}
                          onSave={(val) => updateAndSaveArrayField('experienceInOffice', idx, { dept: val })}
                          placeholder="Ex: Operations"
                          textClassName="text-xs text-blue-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                      <label className="flex items-center gap-2 cursor-pointer group/cb">
                        <input 
                          type="checkbox" 
                          checked={!!item.isCurrent} 
                          onChange={async (e) => await updateAndSaveArrayField('experienceInOffice', idx, { isCurrent: e.target.checked })}
                          className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-xs font-medium text-slate-300 group-hover/cb:text-white transition-colors">I am currently in this role</span>
                      </label>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Start Date</label>
                          <input 
                            type="month" 
                            className="input-base text-xs [color-scheme:dark] bg-transparent border-none p-0 focus:ring-0 cursor-pointer" 
                            value={item.startDate || ''} 
                            onChange={async (e) => await updateAndSaveArrayField('experienceInOffice', idx, { startDate: e.target.value })} 
                            onClick={(e) => (e.currentTarget as any).showPicker?.()}
                          />
                        </div>
                        {!item.isCurrent && (
                          <div className="space-y-1 animate-fade-in">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">End Date</label>
                            <input 
                              type="month" 
                              className="input-base text-xs [color-scheme:dark] bg-transparent border-none p-0 focus:ring-0 cursor-pointer" 
                              value={item.endDate || ''} 
                              onChange={async (e) => await updateAndSaveArrayField('experienceInOffice', idx, { endDate: e.target.value })} 
                              onClick={(e) => (e.currentTarget as any).showPicker?.()}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Description</label>
                      <InlineEditableField
                        type="textarea"
                        initialValue={item.description || ''}
                        onSave={(val) => updateAndSaveArrayField('experienceInOffice', idx, { description: val })}
                        placeholder="Briefly describe your responsibilities..."
                        textClassName="text-xs text-slate-400"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
                      <div className="text-[10px] text-slate-500">
                        Period: <span className="text-slate-300">{item.period || 'Not set'}</span>
                      </div>
                      <button 
                        onClick={async () => {
                          const next = (profile.experienceInOffice || []).filter((_, i) => i !== idx);
                          await handleAutoSave('experienceInOffice', next);
                        }} 
                        className="p-1 rounded hover:bg-red-400/10 text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Icon name="TrashIcon" size={14} />
                      </button>
                    </div>
                  </div>
                ))}

              </div>
            </section>
          </div>
        )}

        {editingTab === 'security' && (
          <div className="space-y-8">
            {/* Password Reset Section */}
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Icon name="KeyIcon" size={20} />
                <h4 className="text-sm font-bold">Administrative Actions</h4>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="password"
                    className="input-base text-sm bg-slate-900 border-slate-700 text-white"
                    placeholder="New password (min 8 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  className="btn-primary bg-amber-600 hover:bg-amber-500 text-white border-none whitespace-nowrap"
                >
                  Force Password Change
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toast.info('MFA Reset triggered (Simulated)')}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all border border-slate-700"
                >
                  Reset MFA Session
                </button>
              </div>
            </div>

            </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900/50">
        <button
          onClick={onClose}
          className="px-8 py-2 rounded-xl text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 transition-all shadow-lg active:scale-95"
        >
          Close Editor
        </button>
      </div>
    </div>
  );
}
