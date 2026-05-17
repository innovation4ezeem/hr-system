'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { useAppContext } from '@/context/AppContext';
import PerformanceCommentThread from './PerformanceCommentThread';

type HodAttachment = {
  id: string;
  employeeName: string;
  fileName: string;
  fileUrl: string;
  note: string;
  uploadedBy: string;
  uploadedAt: string;
};

// Dynamically loaded from database
interface SelfEvaluationSectionProps {
  isArchive?: boolean;
  general?: { 
    performanceFormUrl: string; 
    performanceFormLabel: string;
    evaluationSections?: Array<{ id: string; title: string; attributes: Array<{ id: string; label: string; description?: string }> }>;
  };
  periodLabel?: string;
}

type SubTab = 'overview' | 'discussion';

export default function SelfEvaluationSection({ 
  isArchive = false, 
  general, 
  periodLabel: propPeriodLabel 
}: SelfEvaluationSectionProps) {
  const { selectedYear, userRole, userName, userId, userDepartment, buildAuthHeaders } = useAppContext();
  const isHodView = userRole === 'hod' || userRole === 'admin';
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('discussion');
  const [reflection, setReflection] = useState('');
  const [hodComment, setHodComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<HodAttachment[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [targetEmployee, setTargetEmployee] = useState('');
  const [attachmentNote, setAttachmentNote] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [editingSettings, setEditingSettings] = useState(false);
  const [generalSettings, setGeneralSettings] = useState(general);
  const [tempFormUrl, setTempFormUrl] = useState(general?.performanceFormUrl || '');
  const [tempFormLabel, setTempFormLabel] = useState(general?.performanceFormLabel || '');
  const [tempSections, setTempSections] = useState(general?.evaluationSections || []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  const [selectedPeriod, setSelectedPeriod] = useState(propPeriodLabel || `Q${currentQuarter} ${selectedYear}`);

  const authHeaders = useMemo(() => buildAuthHeaders(), [buildAuthHeaders]);

  // Re-sync if prop or year changes
  useEffect(() => {
    if (propPeriodLabel) {
      setSelectedPeriod(propPeriodLabel);
    } else {
      setSelectedPeriod(`Q${currentQuarter} ${selectedYear}`);
    }
  }, [propPeriodLabel, selectedYear, currentQuarter]);

  // Fetch settings if not provided
  useEffect(() => {
    if (!general && isHodView) {
      fetch('/api/system-settings', { headers: authHeaders })
        .then(res => res.json())
        .then(data => {
          if (data.settings?.general) {
            setGeneralSettings(data.settings.general);
            setTempFormUrl(data.settings.general.performanceFormUrl);
            setTempFormLabel(data.settings.general.performanceFormLabel);
          }
        });
    }
  }, [general, isHodView, authHeaders]);

  const periodLabel = selectedPeriod;

  const availablePeriods = useMemo(() => {
    const q = [`Q1 ${selectedYear}`, `Q2 ${selectedYear}`, `Q3 ${selectedYear}`, `Q4 ${selectedYear}`];
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => `${month} ${selectedYear}`);
    return [...q, ...m];
  }, [selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Parallelize fetches
      const promises = [];
      
      // 1. Load employees if HOD
      if (isHodView) {
        promises.push(
          fetch('/api/evaluations?mode=employees', { headers: authHeaders })
            .then(res => res.json())
            .then(empData => {
              if (Array.isArray(empData.employees)) {
                setEmployees(empData.employees);
                if (empData.employees.length > 0 && !targetEmployee) {
                  setTargetEmployee(empData.employees[0].id);
                }
              }
            })
        );
      } else {
        setTargetEmployee(userId || '');
      }

      const effectiveId = isHodView ? targetEmployee : userId;
      if (effectiveId) {
        // 2. Load Reflection & HOD Comment
        promises.push(
          fetch(`/api/evaluations?mode=reflections&employeeId=${effectiveId}&periodLabel=${periodLabel}`, { headers: authHeaders })
            .then(res => res.json())
            .then(evalData => {
              if (evalData.evaluation) {
                setReflection(evalData.evaluation.reflection || '');
                setHodComment(evalData.evaluation.hodComment || '');
                if (evalData.evaluation.savedAt) {
                  setSavedAt(new Date(evalData.evaluation.savedAt).toLocaleString('en-GB'));
                }
              } else {
                setReflection('');
                setHodComment('');
                setSavedAt(null);
              }
            })
        );

        // 3. Load Attachments
        promises.push(
          fetch(`/api/evaluations?mode=attachments&employeeId=${effectiveId}`, { headers: authHeaders })
            .then(res => res.json())
            .then(attData => {
              if (Array.isArray(attData.attachments)) {
                setAttachments(attData.attachments);
              }
            })
        );
      }

      await Promise.all(promises);
    } catch (err) {
      console.error('Failed to load evaluation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [isHodView, userId, targetEmployee, authHeaders, periodLabel, selectedYear]);

  // Draft persistence for reflection/comments
  useEffect(() => {
    const key = `eval_draft_${userId}_${periodLabel}_${isHodView ? 'hod' : 'emp'}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      if (isHodView) setHodComment(saved);
      else setReflection(saved);
    }
  }, [userId, periodLabel, isHodView]);

  useEffect(() => {
    const key = `eval_draft_${userId}_${periodLabel}_${isHodView ? 'hod' : 'emp'}`;
    const val = isHodView ? hodComment : reflection;
    if (val) {
      localStorage.setItem(key, val);
    } else {
      localStorage.removeItem(key);
    }
  }, [hodComment, reflection, userId, periodLabel, isHodView]);

  const visibleAttachments = useMemo(() => {
    // The backend already filters attachments by employeeId for non-HOD users.
    // We don't need additional filtering here, especially since 'employeeName' isn't in the attachment record.
    return attachments;
  }, [attachments]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'upsert-reflection',
          employeeId: isHodView ? targetEmployee : userId,
          periodLabel,
          reflection,
          hodComment,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSavedAt(new Date().toLocaleString('en-GB'));
      toast.success('Self-evaluation saved to database');
      if (isHodView) {
        setHodComment('');
      } else {
        setReflection('');
      }
    } catch (err) {
      toast.error('Failed to save evaluation');
    } finally {
      setSaving(false);
    }
  };

  const handleAttach = async () => {
    if (!selectedFileName) {
      toast.error('Please choose a file to attach');
      return;
    }
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'create-attachment',
          employeeId: targetEmployee,
          fileName: selectedFileName,
          fileUrl: '#',
          note: attachmentNote.trim(),
        }),
      });
      if (!res.ok) throw new Error('Upload failed');
      
      setSelectedFileName('');
      setAttachmentNote('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      void loadData();
      toast.success('Attachment uploaded and shared');
    } catch (err) {
      toast.error('Failed to upload attachment');
    }
  };

  const handleRemoveAttachment = async (id: string) => {
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action: 'delete-attachment', id }),
      });
      if (!res.ok) throw new Error('Delete failed');
      void loadData();
      toast.success('Attachment removed');
    } catch (err) {
      toast.error('Failed to remove attachment');
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'update-general-settings',
          performanceFormUrl: tempFormUrl,
          performanceFormLabel: tempFormLabel,
          evaluationSections: tempSections,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Evaluation settings updated');
      setGeneralSettings({ 
        performanceFormUrl: tempFormUrl, 
        performanceFormLabel: tempFormLabel,
        evaluationSections: tempSections
      });
      setEditingSettings(false);
    } catch (err) {
      toast.error('Failed to save settings');
    }
  };

  const addSection = () => {
    const newSec = {
      id: `sec-${Date.now()}`,
      title: 'New Section',
      attributes: [{ id: `attr-${Date.now()}`, label: 'New Attribute', description: '' }]
    };
    setTempSections([...tempSections, newSec]);
  };

  const removeSection = (id: string) => {
    setTempSections(tempSections.filter(s => s.id !== id));
  };

  const updateSectionTitle = (id: string, title: string) => {
    setTempSections(tempSections.map(s => s.id === id ? { ...s, title } : s));
  };

  const addAttribute = (sectionId: string) => {
    setTempSections(tempSections.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        attributes: [...s.attributes, { id: `attr-${Date.now()}`, label: 'New Attribute', description: '' }]
      };
    }));
  };

  const removeAttribute = (sectionId: string, attrId: string) => {
    setTempSections(tempSections.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        attributes: s.attributes.filter(a => a.id !== attrId)
      };
    }));
  };

  const updateAttribute = (sectionId: string, attrId: string, field: 'label' | 'description', value: string) => {
    setTempSections(tempSections.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        attributes: s.attributes.map(a => a.id === attrId ? { ...a, [field]: value } : a)
      };
    }));
  };

  return (
    <div className="space-y-5">
      {/* Progress indicator */}
      <div className="rounded-xl px-5 py-4" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{periodLabel} Evaluation</h3>
          <div className="flex items-center gap-3">
            <select 
              value={periodLabel} 
              onChange={e => setSelectedPeriod(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium text-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {availablePeriods.map(p => (
                <option key={p} value={p} className="bg-[#1a1c23]">{p}</option>
              ))}
              {!availablePeriods.includes(periodLabel) && (
                <option value={periodLabel} className="bg-[#1a1c23]">{periodLabel}</option>
              )}
            </select>
            {savedAt && (
              <span className="text-xs flex items-center gap-1" style={{ color: 'rgb(52 211 153)' }}>
                <Icon name="CheckCircleIcon" size={14} /> Synced {savedAt}
              </span>
            )}
          </div>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: '100%', background: 'rgb(79 127 255)' }} />
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex px-4 border-b mb-6" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <button 
          onClick={() => setActiveSubTab('overview')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${activeSubTab === 'overview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'}`}
        >
          Attributes
        </button>
        <button 
          onClick={() => setActiveSubTab('discussion')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${activeSubTab === 'discussion' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'}`}
        >
          Discussion & Attachments
        </button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 min-h-[400px]">
        {activeSubTab === 'overview' && (
          <div className="space-y-6">
            {isHodView && (
              <div className="flex justify-end">
                <button 
                  onClick={() => {
                    if (!editingSettings) {
                      setTempFormUrl(generalSettings?.performanceFormUrl || '');
                      setTempFormLabel(generalSettings?.performanceFormLabel || '');
                      setTempSections(generalSettings?.evaluationSections || []);
                    }
                    setEditingSettings(!editingSettings);
                  }}
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                  style={{ color: editingSettings ? 'rgb(248 113 113)' : 'rgb(79 127 255)' }}
                >
                  <Icon name={editingSettings ? "XMarkIcon" : "Cog6ToothIcon"} size={14} />
                  {editingSettings ? "Cancel Editing" : "Manage Settings"}
                </button>
              </div>
            )}

            {editingSettings ? (
              <div className="rounded-2xl p-6 bg-indigo-500/5 border border-indigo-500/20 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                <h4 className="text-sm font-bold flex items-center gap-2 text-indigo-400">
                  <Icon name="Cog6ToothIcon" size={16} />
                  Evaluation Settings
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs mb-1.5 block font-medium text-slate-400">Form Label</label>
                    <input 
                      value={tempFormLabel}
                      onChange={e => setTempFormLabel(e.target.value)}
                      className="input-base text-xs"
                      placeholder="e.g. 2026 Annual Performance Form"
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1.5 block font-medium text-slate-400">Form URL (Google Form link)</label>
                    <input 
                      value={tempFormUrl}
                      onChange={e => setTempFormUrl(e.target.value)}
                      className="input-base text-xs"
                      placeholder="https://forms.gle/..."
                    />
                  </div>
                </div>

                <div className="pt-4 space-y-4 border-t border-indigo-500/10">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-widest text-slate-400">Evaluation Sections</h5>
                    <button onClick={addSection} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                      <Icon name="PlusIcon" size={12} /> Add Section
                    </button>
                  </div>

                  <div className="space-y-4">
                    {tempSections.map((sec) => (
                      <div key={sec.id} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <input 
                            value={sec.title}
                            onChange={e => updateSectionTitle(sec.id, e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-white focus:ring-0 p-0 w-full"
                            placeholder="Section Title"
                          />
                          <button onClick={() => removeSection(sec.id)} className="text-red-400 hover:text-red-300">
                            <Icon name="TrashIcon" size={14} />
                          </button>
                        </div>

                        <div className="space-y-2 pl-4 border-l-2 border-indigo-500/20">
                          {sec.attributes.map(attr => (
                            <div key={attr.id} className="flex items-start gap-3">
                              <div className="flex-1 space-y-2">
                                <input 
                                  value={attr.label}
                                  onChange={e => updateAttribute(sec.id, attr.id, 'label', e.target.value)}
                                  className="input-base py-1.5 text-xs"
                                  placeholder="Attribute Name"
                                />
                                <textarea 
                                  value={attr.description}
                                  onChange={e => updateAttribute(sec.id, attr.id, 'description', e.target.value)}
                                  className="input-base py-1.5 text-[10px] h-12"
                                  placeholder="Description / Guidance for employee"
                                />
                              </div>
                              <button onClick={() => removeAttribute(sec.id, attr.id)} className="mt-2 text-slate-500 hover:text-red-400">
                                <Icon name="XMarkIcon" size={14} />
                              </button>
                            </div>
                          ))}
                          <button onClick={() => addAttribute(sec.id)} className="text-[10px] font-bold text-indigo-400/60 hover:text-indigo-400 flex items-center gap-1 pt-1">
                            <Icon name="PlusIcon" size={10} /> Add Attribute
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button onClick={handleSaveSettings} className="btn-primary text-xs">
                    Save General Settings
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl p-6 bg-slate-800/20 border border-white/5">
                  <h4 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'rgb(var(--text-primary))' }}>
                    <Icon name="DocumentTextIcon" size={16} className="text-indigo-400" />
                    Evaluation Details
                  </h4>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgb(var(--text-secondary))' }}>
                    This section contains the official attributes and scores once they are finalized in the performance cockpit. 
                    Use the "Comments" tab to discuss progress or provide self-reflections.
                  </p>
                </div>

                {generalSettings?.evaluationSections?.map(sec => (
                  <div key={sec.id} className="space-y-4">
                    <h5 className="text-xs font-black uppercase tracking-widest text-indigo-400/80 px-2 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      {sec.title}
                    </h5>
                    <div className="grid grid-cols-1 gap-3">
                      {sec.attributes.map(attr => (
                        <div key={attr.id} className="rounded-xl p-4 bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">{attr.label}</p>
                              {attr.description && (
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-2xl">{attr.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Google Form Link */}
            {!editingSettings && (
              <div className="rounded-xl p-4 flex items-center justify-between"
                style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(251,191,36,0.15)' }}>
                    <Icon name="DocumentTextIcon" size={16} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                      {generalSettings?.performanceFormLabel || `${new Date().getFullYear()} Annual Performance Form`}
                    </p>
                    <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Google Form — HR-managed external evaluation</p>
                  </div>
                </div>
                <a 
                  href={generalSettings?.performanceFormUrl || "#"} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  <Icon name="ArrowTopRightOnSquareIcon" size={12} />
                  Open Form
                </a>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'discussion' && (
          <div className="space-y-8">
            {/* Context Header for HOD */}
            {isHodView && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600">
                    <Icon name="UserIcon" size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgb(var(--text-secondary))' }}>Discussion Thread For</p>
                    <select 
                      className="bg-transparent border-none text-sm font-bold focus:ring-0 p-0 cursor-pointer hover:text-indigo-300 transition-colors"
                      style={{ color: 'rgb(var(--text-primary))' }}
                      value={targetEmployee} 
                      onChange={e => setTargetEmployee(e.target.value)}
                    >
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">{emp.name}</option>
                      ))}
                      {employees.length === 0 && <option value="" className="text-gray-900">No employees found</option>}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Real-time Sync Active</span>
                </div>
              </div>
            )}

            {/* Chat/Discussion Thread */}
            <PerformanceCommentThread 
              employeeId={isHodView ? targetEmployee : (userId || '')}
              periodLabel={periodLabel}
              authHeaders={authHeaders}
              currentUserId={userId || ''}
            />

            {/* Attachments Section */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
                <h3 className="text-base font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Shared Documents</h3>
                <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
                  {isHodView
                    ? 'Attach documents for employees. They can view these files on their Self Evaluation side.'
                    : 'Documents shared by your HOD for your evaluation reference.'}
                </p>
              </div>

              {isHodView && (
                <div className="p-5 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs mb-1.5 block font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>Choose File</label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="input-base text-xs"
                        onChange={e => setSelectedFileName(e.target.files?.[0]?.name || '')}
                      />
                    </div>
                    <div>
                      <label className="text-xs mb-1.5 block font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>Context / Note</label>
                      <input
                        value={attachmentNote}
                        onChange={e => setAttachmentNote(e.target.value)}
                        className="input-base text-xs"
                        placeholder="e.g. Reference for Q2 goals"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <button onClick={handleAttach} className="btn-primary text-sm flex items-center gap-2">
                      <Icon name="PaperClipIcon" size={14} />
                      Upload Attachment
                    </button>
                  </div>
                </div>
              )}

              <div className="p-5 space-y-2">
                {visibleAttachments.length === 0 && (
                  <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>No attachments available.</p>
                )}
                {visibleAttachments.map(item => (
                  <div key={item.id} className="rounded-lg px-3 py-2 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgb(var(--border-subtle))' }}>
                    <Icon name="DocumentTextIcon" size={15} className="text-blue-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: 'rgb(var(--text-primary))' }}>{item.fileName}</p>
                      <p className="text-xs truncate" style={{ color: 'rgb(var(--text-muted))' }}>
                        {item.uploadedBy} • {new Date(item.uploadedAt).toLocaleDateString()}{item.note ? ` • ${item.note}` : ''}
                      </p>
                    </div>
                    <button 
                      className="text-xs hover:underline" 
                      style={{ color: 'rgb(79 127 255)' }} 
                      onClick={() => {
                        if (item.fileUrl && item.fileUrl !== '#') {
                          window.open(item.fileUrl, '_blank');
                        } else {
                          toast.error('File link not available');
                        }
                      }}
                    >
                      View
                    </button>
                    {isHodView && (
                      <button className="text-xs" style={{ color: 'rgb(248 113 113)' }} onClick={() => handleRemoveAttachment(item.id)}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
