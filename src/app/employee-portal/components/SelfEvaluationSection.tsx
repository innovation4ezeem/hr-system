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
    evaluationSections?: Array<{ 
      id: string; 
      title: string; 
      attributes: Array<{ id: string; label: string; description?: string }>;
      assignedEmployeeIds?: string[];
    }>;
    showAttendedCourse?: boolean;
    showColleagueVoting?: boolean;
    votingTitle?: string;
    votingDescription?: string;
    courseTitle?: string;
    courseDescription?: string;
  };
  periodLabel?: string;
  forceSelfView?: boolean;
}

type SubTab = 'overview' | 'discussion';

const votingCategories = [
  {
    key: 'accountability',
    label: '1. Accountability (Responsible towards own responsibility)',
    reasonLabel: '1. Supporting reasons for Accountability',
  },
  {
    key: 'sharpen_the_saw',
    label: '2. Sharpen The Saw (Continuous Learner)',
    reasonLabel: '2. Supporting reason for Sharpen The Saw',
  },
  {
    key: 'innovative',
    label: '3. Innovative & Creativity',
    reasonLabel: '3. Supporting reason for Innovative & Creativity',
  },
  {
    key: 'collaboration',
    label: '4. Collaboration (Effective Collaborator)',
    reasonLabel: '4. Supporting reason for collaboration (effective collaborator)',
  },
  {
    key: 'initiative',
    label: '5. Initiative',
    reasonLabel: '5. Supporting reason for Initiative',
  },
];

export default function SelfEvaluationSection({ 
  isArchive = false, 
  general, 
  periodLabel: propPeriodLabel,
  forceSelfView = false
}: SelfEvaluationSectionProps) {
  const { selectedYear, userRole, userName, userId, userDepartment, buildAuthHeaders } = useAppContext();
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>([]);
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  const currentMonthStr = new Date().toLocaleString('default', { month: 'short' }) + ' ' + selectedYear;

  const [votes, setVotes] = useState<Record<string, { candidateId: string; reason: string }>>({
    accountability: { candidateId: '', reason: '' },
    sharpen_the_saw: { candidateId: '', reason: '' },
    innovative: { candidateId: '', reason: '' },
    collaboration: { candidateId: '', reason: '' },
    initiative: { candidateId: '', reason: '' },
  });
  const [savingVotes, setSavingVotes] = useState(false);

  // Popularity Voting States
  const [popVoteCandidate, setPopVoteCandidate] = useState('');
  const [savingPopVote, setSavingPopVote] = useState(false);
  const [popVotesUsed, setPopVotesUsed] = useState(0);

  const isHodView = (userRole === 'hod' || userRole === 'admin') && !forceSelfView;
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('discussion');
  const [reflection, setReflection] = useState('');
  const [hodComment, setHodComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<HodAttachment[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [targetEmployee, setTargetEmployee] = useState('');
  const effectiveEmployeeId = (isHodView && targetEmployee) ? targetEmployee : userId;

  const [attendedCourse, setAttendedCourse] = useState('');
  const [courseCertName, setCourseCertName] = useState('');
  const [courseCertUrl, setCourseCertUrl] = useState('');
  const [plgtPlay, setPlgtPlay] = useState('');
  const [plgtPlayPhotoName, setPlgtPlayPhotoName] = useState('');
  const [plgtPlayPhotoUrl, setPlgtPlayPhotoUrl] = useState('');
  const [savingForm, setSavingForm] = useState(false);

  useEffect(() => {
    try {
      if (reflection && reflection.trim().startsWith('{')) {
        const parsed = JSON.parse(reflection);
        setAttendedCourse(parsed.attendedCourse || '');
        setCourseCertName(parsed.courseCertName || '');
        setCourseCertUrl(parsed.courseCertUrl || '');
        setPlgtPlay(parsed.plgtPlay || '');
        setPlgtPlayPhotoName(parsed.plgtPlayPhotoName || '');
        setPlgtPlayPhotoUrl(parsed.plgtPlayPhotoUrl || '');
      } else {
        setAttendedCourse(reflection || '');
        setCourseCertName('');
        setCourseCertUrl('');
        setPlgtPlay('');
        setPlgtPlayPhotoName('');
        setPlgtPlayPhotoUrl('');
      }
    } catch (e) {
      console.error("Failed to parse reflection JSON:", e);
      setAttendedCourse(reflection || '');
      setCourseCertName('');
      setCourseCertUrl('');
      setPlgtPlay('');
      setPlgtPlayPhotoName('');
      setPlgtPlayPhotoUrl('');
    }
  }, [reflection]);
  const [attachmentNote, setAttachmentNote] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [editingSettings, setEditingSettings] = useState(false);
  const [generalSettings, setGeneralSettings] = useState(general);
  const [tempFormUrl, setTempFormUrl] = useState(general?.performanceFormUrl || '');
  const [tempFormLabel, setTempFormLabel] = useState(general?.performanceFormLabel || '');
  const [tempSections, setTempSections] = useState(general?.evaluationSections || []);
  const [tempShowAttendedCourse, setTempShowAttendedCourse] = useState<boolean>(general?.showAttendedCourse !== false);
  const [tempShowColleagueVoting, setTempShowColleagueVoting] = useState<boolean>(general?.showColleagueVoting !== false);
  const [formJustSaved, setFormJustSaved] = useState(false);
  const [votesJustSaved, setVotesJustSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedPeriod, setSelectedPeriod] = useState(propPeriodLabel || currentMonthStr);

  const authHeaders = useMemo(() => buildAuthHeaders(), [buildAuthHeaders]);

  // Re-sync if prop or year changes
  useEffect(() => {
    if (propPeriodLabel) {
      setSelectedPeriod(propPeriodLabel);
    } else {
      setSelectedPeriod(currentMonthStr);
    }
  }, [propPeriodLabel, selectedYear, currentQuarter, currentMonthStr]);

  // Poll settings periodically to enable real-time sync of sections/toggles
  useEffect(() => {
    let active = true;
    const fetchGeneralSettings = async () => {
      try {
        const res = await fetch('/api/system-settings', { headers: authHeaders });
        const data = await res.json();
        if (active && res.ok && data.settings?.general) {
          const newSettings = data.settings.general;
          setGeneralSettings(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(newSettings)) {
              return newSettings;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Failed to poll system settings:', err);
      }
    };

    void fetchGeneralSettings();
    const interval = setInterval(fetchGeneralSettings, 10000); // 10 seconds polling

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [authHeaders]);

  const periodLabel = selectedPeriod;

  const availablePeriods = useMemo(() => {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => `${month} ${selectedYear}`);
  }, [selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Parallelize fetches
      const promises = [];
      
      // Load voting candidates if empty
      promises.push(
        fetch('/api/evaluations?mode=voting-candidates', { headers: authHeaders })
          .then(res => res.json())
          .then(candData => {
            if (Array.isArray(candData.candidates)) {
              setCandidates(candData.candidates);
            }
          })
      );

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

        // 3. Fetch Popularity Votes Used
        if (userId) {
          promises.push(
            fetch(`/api/popularity-votes?month=${currentMonthStr}`, { headers: authHeaders })
              .then(res => res.json())
              .then(data => {
                if (data.votes) {
                  const used = data.votes.filter((v: any) => v.voter_id === userId).length;
                  setPopVotesUsed(used);
                }
              })
          );
        }

        // 4. Load Attachments
        promises.push(
          fetch(`/api/evaluations?mode=attachments&employeeId=${effectiveId}`, { headers: authHeaders })
            .then(res => res.json())
            .then(attData => {
              if (Array.isArray(attData.attachments)) {
                setAttachments(attData.attachments);
              }
            })
        );

        // 5. Load Votes
        promises.push(
          fetch(`/api/evaluations?mode=votes&employeeId=${effectiveId}&periodLabel=${periodLabel}`, { headers: authHeaders })
            .then(res => res.json())
            .then(voteData => {
              if (voteData.votes) {
                setVotes({
                  accountability: voteData.votes.accountability || { candidateId: '', reason: '' },
                  sharpen_the_saw: voteData.votes.sharpen_the_saw || { candidateId: '', reason: '' },
                  innovative: voteData.votes.innovative || { candidateId: '', reason: '' },
                  collaboration: voteData.votes.collaboration || { candidateId: '', reason: '' },
                  initiative: voteData.votes.initiative || { candidateId: '', reason: '' },
                });
              } else {
                setVotes({
                  accountability: { candidateId: '', reason: '' },
                  sharpen_the_saw: { candidateId: '', reason: '' },
                  innovative: { candidateId: '', reason: '' },
                  collaboration: { candidateId: '', reason: '' },
                  initiative: { candidateId: '', reason: '' },
                });
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



  const visibleAttachments = useMemo(() => {
    // The backend already filters attachments by employeeId for non-HOD users.
    // We don't need additional filtering here, especially since 'employeeName' isn't in the attachment record.
    return attachments;
  }, [attachments]);

  const handleSaveVotes = async () => {
    try {
      setSavingVotes(true);
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'save-votes',
          votes,
          periodLabel,
        }),
      });
      if (!res.ok) throw new Error('Failed to save votes');
      toast.success('Your colleague votes have been updated and submitted!');
      setVotesJustSaved(true);
      setTimeout(() => setVotesJustSaved(false), 3000);
    } catch (err) {
      toast.error('Failed to save votes');
    } finally {
      setSavingVotes(false);
    }
  };

  const handleSavePopVote = async () => {
    if (!popVoteCandidate) {
      toast.error('Please select a colleague');
      return;
    }
    try {
      setSavingPopVote(true);
      const res = await fetch('/api/popularity-votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          targetEmployeeId: popVoteCandidate,
          month: currentMonthStr,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit vote');
      toast.success('Popularity sticker submitted successfully!');
      setPopVotesUsed(prev => prev + 1);
      setPopVoteCandidate('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save popularity vote');
    } finally {
      setSavingPopVote(false);
    }
  };

  const handleSaveForm = async (
    overrideData?: Partial<{
      attendedCourse: string;
      courseCertName: string;
      courseCertUrl: string;
      plgtPlay: string;
      plgtPlayPhotoName: string;
      plgtPlayPhotoUrl: string;
    }>
  ) => {
    setSavingForm(true);
    try {
      const dataToSave = {
        attendedCourse: overrideData?.hasOwnProperty('attendedCourse') ? overrideData.attendedCourse : attendedCourse,
        courseCertName: overrideData?.hasOwnProperty('courseCertName') ? overrideData.courseCertName : courseCertName,
        courseCertUrl: overrideData?.hasOwnProperty('courseCertUrl') ? overrideData.courseCertUrl : courseCertUrl,
        plgtPlay: overrideData?.hasOwnProperty('plgtPlay') ? overrideData.plgtPlay : plgtPlay,
        plgtPlayPhotoName: overrideData?.hasOwnProperty('plgtPlayPhotoName') ? overrideData.plgtPlayPhotoName : plgtPlayPhotoName,
        plgtPlayPhotoUrl: overrideData?.hasOwnProperty('plgtPlayPhotoUrl') ? overrideData.plgtPlayPhotoUrl : plgtPlayPhotoUrl,
      };

      const reflectionStr = JSON.stringify(dataToSave);

      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'upsert-reflection',
          employeeId: isHodView ? targetEmployee : userId,
          periodLabel,
          reflection: reflectionStr,
          hodComment,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setReflection(reflectionStr);
      setSavedAt(new Date().toLocaleString('en-GB'));
      toast.success('Your responses have been successfully saved!');
      setFormJustSaved(true);
      setTimeout(() => setFormJustSaved(false), 3000);
    } catch (err) {
      toast.error('Failed to save responses');
    } finally {
      setSavingForm(false);
    }
  };

  const handleUploadCert = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('Uploading certificate...');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/leave-attachments', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to upload file');

      const name = payload?.attachment?.originalName || file.name;
      const url = payload?.attachment?.path || '';

      setCourseCertName(name);
      setCourseCertUrl(url);

      await handleSaveForm({
        courseCertName: name,
        courseCertUrl: url
      });
      toast.success('Certificate uploaded successfully!', { id: toastId });
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload certificate', { id: toastId });
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('Uploading photo...');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/leave-attachments', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to upload file');

      const name = payload?.attachment?.originalName || file.name;
      const url = payload?.attachment?.path || '';

      setPlgtPlayPhotoName(name);
      setPlgtPlayPhotoUrl(url);

      await handleSaveForm({
        plgtPlayPhotoName: name,
        plgtPlayPhotoUrl: url
      });
      toast.success('Photo uploaded successfully!', { id: toastId });
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload photo', { id: toastId });
    }
  };

  const handleRemoveCert = async () => {
    setCourseCertName('');
    setCourseCertUrl('');
    await handleSaveForm({
      courseCertName: '',
      courseCertUrl: ''
    });
  };

  const handleRemovePhoto = async () => {
    setPlgtPlayPhotoName('');
    setPlgtPlayPhotoUrl('');
    await handleSaveForm({
      plgtPlayPhotoName: '',
      plgtPlayPhotoUrl: ''
    });
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
          showAttendedCourse: tempShowAttendedCourse,
          showColleagueVoting: tempShowColleagueVoting,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Evaluation settings updated');
      setGeneralSettings({ 
        performanceFormUrl: tempFormUrl, 
        performanceFormLabel: tempFormLabel,
        evaluationSections: tempSections,
        showAttendedCourse: tempShowAttendedCourse,
        showColleagueVoting: tempShowColleagueVoting,
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
            {isHodView && (
              <div className="flex items-center gap-1.5 mr-2">
                <span className="text-xs font-semibold text-slate-400">Employee:</span>
                <select 
                  value={targetEmployee} 
                  onChange={e => setTargetEmployee(e.target.value)}
                  className="bg-black/[0.03] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-500 border-indigo-500/20 hover:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id} className="bg-white dark:bg-[#1a1c23] text-slate-800 dark:text-white">{emp.name}</option>
                  ))}
                  {employees.length === 0 && (
                    <option value="" className="bg-white dark:bg-[#1a1c23] text-slate-800 dark:text-white">
                      No employees found
                    </option>
                  )}
                </select>
              </div>
            )}
            <select 
              value={periodLabel} 
              onChange={e => setSelectedPeriod(e.target.value)}
              className="bg-black/[0.03] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {availablePeriods.map(p => (
                <option key={p} value={p} className="bg-white dark:bg-[#1a1c23] text-slate-800 dark:text-white">{p}</option>
              ))}
              {!availablePeriods.includes(periodLabel) && (
                <option value={periodLabel} className="bg-white dark:bg-[#1a1c23] text-slate-800 dark:text-white">{periodLabel}</option>
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

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 min-h-[400px]">
          <div className="space-y-6">
            {isHodView && (
              <div className="flex justify-end">
                <button 
                  onClick={() => {
                    if (!editingSettings) {
                      setTempFormUrl(generalSettings?.performanceFormUrl || '');
                      setTempFormLabel(generalSettings?.performanceFormLabel || '');
                      setTempSections(generalSettings?.evaluationSections || []);
                      setTempShowAttendedCourse(generalSettings?.showAttendedCourse !== false);
                      setTempShowColleagueVoting(generalSettings?.showColleagueVoting !== false);
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
                  <div className="flex flex-wrap items-center gap-6 pt-2 md:col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={tempShowAttendedCourse}
                        onChange={e => setTempShowAttendedCourse(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="text-xs font-semibold">
                        Include Attended Course &amp; PLGT Play Submission
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={tempShowColleagueVoting}
                        onChange={e => setTempShowColleagueVoting(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="text-xs font-semibold">
                        Include Colleague Voting Section
                      </span>
                    </label>
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

                {generalSettings?.evaluationSections?.filter(sec => {
                  if (!sec.assignedEmployeeIds || sec.assignedEmployeeIds.length === 0) return true;
                  return sec.assignedEmployeeIds.includes(effectiveEmployeeId);
                }).map(sec => (
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

                {/* Colleague Complement Voting Section */}
                {generalSettings?.showColleagueVoting !== false && (
                  <div className="space-y-6 pt-6 border-t border-white/5 mt-6">
                    <div className="rounded-xl p-5 bg-[#312e81]/10 border border-[#4338ca]/20">
                      <h4 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: 'rgb(var(--text-primary))' }}>
                        <Icon name="HandThumbUpIcon" size={16} className="text-indigo-400" />
                        {generalSettings?.votingTitle || "Colleague Complement Voting"}
                      </h4>
                      <p className="text-xs leading-relaxed text-slate-400">
                        {generalSettings?.votingDescription || "Vote as a complement to your colleagues whomever meet the expectations. Every submitted vote adds 5 points directly to their activity scores."}
                      </p>
                    </div>

                    {(!isHodView || targetEmployee === userId) ? (
                      // Interactive Voting Form (Self)
                      <div className="space-y-6">
                        {votingCategories.map(cat => (
                          <div key={cat.key} className="space-y-3">
                            {/* Colleague Selector Card */}
                            <div className="rounded-xl p-5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-3">
                              <label className="text-xs font-bold block text-slate-800 dark:text-slate-200">{cat.label}</label>
                              <select
                                value={votes[cat.key]?.candidateId || ''}
                                onChange={e => setVotes(prev => ({
                                  ...prev,
                                  [cat.key]: {
                                    ...prev[cat.key],
                                    candidateId: e.target.value
                                  }
                                }))}
                                className="bg-black/[0.03] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 dark:text-white w-full max-w-md focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                              >
                                <option value="" className="bg-white dark:bg-[#1a1c23] text-slate-800 dark:text-white">Choose</option>
                                {candidates.map(candidate => (
                                  <option key={candidate.id} value={candidate.id} className="bg-white dark:bg-[#1a1c23] text-slate-800 dark:text-white">
                                    {candidate.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Reason Input Card */}
                            <div className="rounded-xl p-5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                              <label className="text-xs font-bold block text-slate-800 dark:text-slate-200">{cat.reasonLabel}</label>
                              <input
                                type="text"
                                value={votes[cat.key]?.reason || ''}
                                onChange={e => setVotes(prev => ({
                                  ...prev,
                                  [cat.key]: {
                                    ...prev[cat.key],
                                    reason: e.target.value
                                  }
                                }))}
                                className="w-full bg-transparent border-b border-black/10 dark:border-white/10 py-2 text-xs text-slate-800 dark:text-white placeholder-black/30 dark:placeholder-white/30 focus:border-indigo-500 focus:outline-none transition-colors"
                                placeholder="Your answer"
                              />
                            </div>
                          </div>
                        ))}

                        <div className="flex justify-end pt-4">
                          <button
                            onClick={handleSaveVotes}
                            disabled={savingVotes || votesJustSaved}
                            className={`btn-primary text-xs flex items-center gap-1.5 ${votesJustSaved ? '!bg-emerald-500 !text-white' : ''}`}
                          >
                            {savingVotes ? 'Submitting...' : votesJustSaved ? '✓ Saved Successfully!' : 'Submit Votes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Read-only view (HOD checking employee's cast votes)
                      <div className="space-y-4">
                        {votingCategories.map(cat => {
                          const votedCandidate = candidates.find(c => c.id === votes[cat.key]?.candidateId);
                          const reason = votes[cat.key]?.reason || 'No supporting reason provided';
                          return (
                            <div key={cat.key} className="rounded-xl p-4 bg-black/[0.01] dark:bg-white/[0.01] border border-black/5 dark:border-white/5 space-y-2">
                              <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400 block">{cat.label}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Voted colleague:</span>
                                <span className="text-xs font-bold text-slate-800 dark:text-white">
                                  {votedCandidate ? votedCandidate.name : 'None chosen'}
                                </span>
                              </div>
                              {votedCandidate && (
                                <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-400 bg-black/[0.01] dark:bg-white/[0.02] p-2.5 rounded border border-black/5 dark:border-white/5">
                                  <span className="font-medium text-slate-500 block mb-1">Supporting reason:</span>
                                  "{reason}"
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Live Popularity Voting Section (for Employees) */}
                {(!isHodView || targetEmployee === userId) && (
                  <div className="space-y-6 pt-6 border-t border-white/5 mt-6">
                    <div className="rounded-xl p-5 bg-gradient-to-br from-fuchsia-50 to-purple-50 dark:from-fuchsia-500/10 dark:to-purple-500/10 border border-fuchsia-200 dark:border-fuchsia-500/20">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-bold flex items-center gap-2 text-fuchsia-600 dark:text-fuchsia-400">
                          <Icon name="StarIcon" size={16} />
                          Live Popularity Voting
                        </h4>
                        <div className="text-xs font-bold px-2 py-1 rounded bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300">
                          Stickers Used: {popVotesUsed} / 3 this month
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        Give up to 3 stickers each month to your favorite colleagues! Points are awarded based on your role and contribute to the live popularity leaderboard.
                      </p>
                    </div>

                    <div className="rounded-xl p-5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                      <label className="text-xs font-bold block text-slate-800 dark:text-slate-200">Send a Sticker To:</label>
                      <select
                        value={popVoteCandidate}
                        onChange={e => setPopVoteCandidate(e.target.value)}
                        disabled={popVotesUsed >= 3 || savingPopVote}
                        className="bg-black/[0.03] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 dark:text-white w-full max-w-md focus:ring-2 focus:ring-fuchsia-500 cursor-pointer disabled:opacity-50"
                      >
                        <option value="" className="bg-white dark:bg-[#1a1c23] text-slate-800 dark:text-white">Select Colleague</option>
                        {candidates.map(candidate => (
                          <option key={candidate.id} value={candidate.id} className="bg-white dark:bg-[#1a1c23] text-slate-800 dark:text-white">
                            {candidate.name}
                          </option>
                        ))}
                      </select>

                      <div className="flex justify-end">
                        <button
                          onClick={handleSavePopVote}
                          disabled={savingPopVote || popVotesUsed >= 3 || !popVoteCandidate}
                          className="px-4 py-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-fuchsia-500/20 disabled:opacity-50"
                        >
                          {savingPopVote ? 'Sending...' : 'Send Sticker'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Attended Course & PLGT Play Custom Form Section */}
                {generalSettings?.showAttendedCourse !== false && (
                  <div className="space-y-6 pt-6 border-t border-black/5 dark:border-white/5 mt-6">
                    <div className="rounded-xl p-5 bg-[#312e81]/5 border border-indigo-500/10">
                      <h4 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: 'rgb(var(--text-primary))' }}>
                        <Icon name="AcademicCapIcon" size={16} className="text-indigo-400" />
                        {generalSettings?.courseTitle || "Attended Course & PLGT Play Submission"}
                      </h4>
                      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {generalSettings?.courseDescription || "Submit details of courses you have attended and your participation in PLGT Play events, along with supporting documents/photos."}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Column 1: Attended Course */}
                      <div className="space-y-4">
                        <div className="rounded-xl p-5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                          <div>
                            <label className="text-xs font-bold block text-slate-800 dark:text-slate-200 mb-1">
                              6. Attended Course (Course Name, Date)
                            </label>
                            <span className="text-[10px] text-slate-500 block mb-2 font-medium">
                              Please make sure this course is updated in your Google Calendar
                            </span>
                            {isHodView ? (
                              <div className="text-sm text-slate-800 dark:text-white bg-black/[0.02] dark:bg-white/[0.02] p-3 rounded-lg border border-black/5 dark:border-white/5 min-h-[40px] italic">
                                {attendedCourse || "No answer provided"}
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={attendedCourse}
                                onChange={e => setAttendedCourse(e.target.value)}
                                className="w-full bg-transparent border-b border-black/10 dark:border-white/10 py-2 text-xs text-slate-800 dark:text-white placeholder-black/30 dark:placeholder-white/30 focus:border-indigo-500 focus:outline-none transition-colors"
                                placeholder="Your answer"
                              />
                            )}
                          </div>

                          <div>
                            <label className="text-xs font-bold block text-slate-800 dark:text-slate-200 mb-2">
                              Course cert
                            </label>
                            {courseCertUrl ? (
                              <div className="flex items-center justify-between p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <Icon name="DocumentIcon" size={14} className="text-indigo-400 shrink-0" />
                                  <span className="text-xs text-slate-800 dark:text-white truncate font-medium">{courseCertName || 'Certificate File'}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => window.open(courseCertUrl, '_blank')}
                                    className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
                                  >
                                    View
                                  </button>
                                  {!isHodView && (
                                    <button
                                      type="button"
                                      onClick={handleRemoveCert}
                                      className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : isHodView ? (
                              <div className="text-xs text-slate-500 italic">No certificate uploaded</div>
                            ) : (
                              <div className="relative">
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  onChange={handleUploadCert}
                                  className="hidden"
                                  id="cert-upload-input"
                                />
                                <label
                                  htmlFor="cert-upload-input"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] text-xs font-semibold text-slate-800 dark:text-white cursor-pointer transition-all"
                                >
                                  <Icon name="ArrowUpTrayIcon" size={12} />
                                  Add File
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Column 2: PLGT Play */}
                      <div className="space-y-4">
                        <div className="rounded-xl p-5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
                          <div>
                            <label className="text-xs font-bold block text-slate-800 dark:text-slate-200 mb-2">
                              7. PLGT Play (Date & Event)
                            </label>
                            {isHodView ? (
                              <div className="text-sm text-slate-800 dark:text-white bg-black/[0.02] dark:bg-white/[0.02] p-3 rounded-lg border border-black/5 dark:border-white/5 min-h-[40px] italic">
                                {plgtPlay || "No answer provided"}
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={plgtPlay}
                                onChange={e => setPlgtPlay(e.target.value)}
                                className="w-full bg-transparent border-b border-black/10 dark:border-white/10 py-2 text-xs text-slate-800 dark:text-white placeholder-black/30 dark:placeholder-white/30 focus:border-indigo-500 focus:outline-none transition-colors"
                                placeholder="Your answer"
                              />
                            )}
                          </div>

                          <div>
                            <label className="text-xs font-bold block text-slate-800 dark:text-slate-200 mb-2">
                              7. PLGT Play Photo
                            </label>
                            {plgtPlayPhotoUrl ? (
                              <div className="flex items-center justify-between p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <Icon name="PhotoIcon" size={14} className="text-indigo-400 shrink-0" />
                                  <span className="text-xs text-slate-800 dark:text-white truncate font-medium">{plgtPlayPhotoName || 'Photo File'}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => window.open(plgtPlayPhotoUrl, '_blank')}
                                    className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
                                  >
                                    View
                                  </button>
                                  {!isHodView && (
                                    <button
                                      type="button"
                                      onClick={handleRemovePhoto}
                                      className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : isHodView ? (
                              <div className="text-xs text-slate-500 italic">No photo uploaded</div>
                            ) : (
                              <div className="relative">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleUploadPhoto}
                                  className="hidden"
                                  id="photo-upload-input"
                                />
                                <label
                                  htmlFor="photo-upload-input"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] text-xs font-semibold text-slate-800 dark:text-white cursor-pointer transition-all"
                                >
                                  <Icon name="ArrowUpTrayIcon" size={12} />
                                  Add File
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {!isHodView && (
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => handleSaveForm()}
                          disabled={savingForm || isHodView || formJustSaved}
                          className={`btn-primary text-xs flex items-center gap-1.5 ${formJustSaved ? '!bg-emerald-500 !text-white' : ''}`}
                        >
                          {savingForm ? 'Saving...' : formJustSaved ? '✓ Saved Successfully!' : (savedAt ? 'Update Submission' : 'Save Submission')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
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
      </div>
    </div>
  );
}
