'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { useAppContext } from '@/context/AppContext';

interface Attribute {
  id: string;
  label: string;
  description?: string;
}

interface Section {
  id: string;
  title: string;
  attributes: Attribute[];
  assignedEmployeeIds?: string[];
}

// ── Static voting categories — same as SelfEvaluationSection ──
const votingCategories = [
  { key: 'accountability', label: '1. Accountability (Responsible towards own responsibility)' },
  { key: 'sharpen_the_saw', label: '2. Sharpen The Saw (Continuous Learner)' },
  { key: 'innovative', label: '3. Innovative & Creativity' },
  { key: 'collaboration', label: '4. Collaboration (Effective Collaborator)' },
  { key: 'initiative', label: '5. Initiative' },
];

// ── Full read-only preview of the employee's Attribute tab ──
function EmployeeAttributePreview({
  sections,
  formLabel,
  formUrl,
  showAttendedCourse = true,
  showColleagueVoting = true,
  courseTitle = '',
  courseDescription = '',
  votingTitle = '',
  votingDescription = '',
  onUpdateSectionTitle,
  onUpdateAttribute,
  onAddSection,
  onDeleteSection,
  onMoveSection,
  onAddAttribute,
  onDeleteAttribute,
  onMoveAttribute,
  onUpdateFormLabel,
  onUpdateFormUrl,
  onUpdateCourseText,
  onUpdateVotingText,
}: {
  sections: Section[];
  formLabel: string;
  formUrl: string;
  showAttendedCourse?: boolean;
  showColleagueVoting?: boolean;
  courseTitle?: string;
  courseDescription?: string;
  votingTitle?: string;
  votingDescription?: string;
  onUpdateSectionTitle?: (secId: string, title: string) => void;
  onUpdateAttribute?: (
    secId: string,
    attrId: string,
    updates: Partial<{ label: string; description: string }>
  ) => void;
  onAddSection?: () => void;
  onDeleteSection?: (secId: string) => void;
  onMoveSection?: (index: number, direction: 'up' | 'down') => void;
  onAddAttribute?: (secId: string) => void;
  onDeleteAttribute?: (secId: string, attrId: string) => void;
  onMoveAttribute?: (secId: string, index: number, direction: 'up' | 'down') => void;
  onUpdateFormLabel?: (label: string) => void;
  onUpdateFormUrl?: (url: string) => void;
  onUpdateCourseText?: (title: string, description: string) => void;
  onUpdateVotingText?: (title: string, description: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* 1. Evaluation Details banner */}
      <div
        className="rounded-2xl p-5 border"
        style={{ background: 'rgb(var(--bg-surface, rgba(0,0,0,0.01)))', borderColor: 'rgb(var(--border-subtle))' }}
      >
        <h4 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: 'rgb(var(--text-primary))' }}>
          <Icon name="DocumentTextIcon" size={16} className="text-indigo-400" />
          Evaluation Details
        </h4>
        <p className="text-xs leading-relaxed" style={{ color: 'rgb(var(--text-secondary))' }}>
          This section contains the official attributes and scores once they are finalized in the performance cockpit.
          Use the &ldquo;Comments&rdquo; tab to discuss progress or provide self-reflections.
        </p>
      </div>

      {/* 2. Dynamic evaluation sections */}
      {sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-8 text-center bg-black/[0.01] dark:bg-white/[0.01]">
          <p className="text-xs text-slate-400 italic mb-3">
            No evaluation sections defined yet. Add sections above or click below to see them here.
          </p>
          {onAddSection && (
            <button
              onClick={onAddSection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm"
            >
              <Icon name="PlusIcon" size={14} />
              Add First Section
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((sec, secIndex) => (
            <div key={sec.id} className="space-y-3 relative group/sec border-l-2 border-transparent hover:border-indigo-500/30 pl-3 transition-all">
              <div className="text-xs font-black uppercase tracking-widest flex items-center justify-between gap-2" style={{ color: 'rgb(99 102 241)' }}>
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  {onUpdateSectionTitle ? (
                    <input
                      type="text"
                      value={sec.title}
                      onChange={e => onUpdateSectionTitle(sec.id, e.target.value)}
                      className="bg-transparent text-xs font-black uppercase tracking-widest text-indigo-500 border-b border-transparent hover:border-indigo-500/20 focus:border-indigo-500 focus:outline-none py-0.5 w-full font-sans"
                      placeholder="Section Title"
                    />
                  ) : (
                    sec.title || 'Untitled Section'
                  )}
                </div>
                
                {/* Section Controls */}
                {onDeleteSection && onMoveSection && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/sec:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => onMoveSection(secIndex, 'up')}
                      disabled={secIndex === 0}
                      className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 disabled:opacity-30"
                      title="Move Up"
                    >
                      <Icon name="ChevronUpIcon" size={14} />
                    </button>
                    <button
                      onClick={() => onMoveSection(secIndex, 'down')}
                      disabled={secIndex === sections.length - 1}
                      className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 disabled:opacity-30"
                      title="Move Down"
                    >
                      <Icon name="ChevronDownIcon" size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteSection(sec.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-red-400"
                      title="Delete Section"
                    >
                      <Icon name="TrashIcon" size={14} />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-2 pl-3">
                {sec.attributes.length === 0 ? (
                  <p className="text-xs text-slate-400 italic px-2 py-3 border border-dashed border-black/5 dark:border-white/5 rounded-xl">
                    No attributes in this section yet.
                  </p>
                ) : (
                  sec.attributes.map((attr, attrIndex) => (
                    <div
                      key={attr.id}
                      className="rounded-xl p-4 border transition-colors relative group/attr"
                      style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border-subtle))' }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {onUpdateAttribute ? (
                            <input
                              type="text"
                              value={attr.label}
                              onChange={e => onUpdateAttribute(sec.id, attr.id, { label: e.target.value })}
                              className="w-full bg-transparent text-sm font-bold border-b border-transparent hover:border-black/10 dark:hover:border-white/10 focus:border-indigo-500 focus:outline-none py-0.5"
                              style={{ color: 'rgb(var(--text-primary))' }}
                              placeholder="Attribute Label"
                            />
                          ) : (
                            <p className="text-sm font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
                              {attr.label || 'Untitled Attribute'}
                            </p>
                          )}
                          
                          {onUpdateAttribute ? (
                            <textarea
                              value={attr.description || ''}
                              onChange={e => onUpdateAttribute(sec.id, attr.id, { description: e.target.value })}
                              className="w-full bg-transparent text-xs leading-relaxed max-w-2xl border border-transparent hover:border-black/10 dark:hover:border-white/10 rounded p-1 focus:border-indigo-500 focus:outline-none resize-none h-12 mt-1"
                              style={{ color: 'rgb(var(--text-secondary))' }}
                              placeholder="Guidance / Description..."
                            />
                          ) : (
                            attr.description && (
                              <p className="text-xs mt-1 leading-relaxed max-w-2xl" style={{ color: 'rgb(var(--text-secondary))' }}>
                                {attr.description}
                              </p>
                            )
                          )}
                        </div>

                        {/* Attribute Controls */}
                        {onDeleteAttribute && onMoveAttribute && (
                          <div className="flex flex-col gap-0.5 opacity-0 group-hover/attr:opacity-100 transition-opacity shrink-0 pt-1">
                            <button
                              onClick={() => onMoveAttribute(sec.id, attrIndex, 'up')}
                              disabled={attrIndex === 0}
                              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 disabled:opacity-30"
                              title="Move Up"
                            >
                              <Icon name="ChevronUpIcon" size={12} />
                            </button>
                            <button
                              onClick={() => onMoveAttribute(sec.id, attrIndex, 'down')}
                              disabled={attrIndex === sec.attributes.length - 1}
                              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 disabled:opacity-30"
                              title="Move Down"
                            >
                              <Icon name="ChevronDownIcon" size={12} />
                            </button>
                            <button
                              onClick={() => onDeleteAttribute(sec.id, attr.id)}
                              className="p-1 rounded hover:bg-red-500/10 text-red-400 mt-1"
                              title="Delete Attribute"
                            >
                              <Icon name="TrashIcon" size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {/* Add Attribute Button inside Preview Section */}
                {onAddAttribute && (
                  <div className="pt-1">
                    <button
                      onClick={() => onAddAttribute(sec.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-indigo-500/30 hover:border-indigo-500 hover:bg-indigo-500/5 text-[10px] text-indigo-500 font-bold transition-all"
                    >
                      <Icon name="PlusIcon" size={12} />
                      Add Attribute
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Add Section Button inside Preview */}
          {onAddSection && (
            <div className="pt-2 text-center border-t border-black/5 dark:border-white/5">
              <button
                onClick={onAddSection}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-dashed border-indigo-500/40 hover:border-indigo-500 hover:bg-indigo-500/5 text-xs text-indigo-500 font-bold transition-all"
              >
                <Icon name="PlusIcon" size={14} />
                Add Section
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Colleague Complement Voting */}
      {showColleagueVoting && (
        <div className="space-y-4 pt-4 border-t border-black/5 dark:border-white/5">
          <div className="rounded-xl p-5 border" style={{ background: 'rgba(49,46,129,0.06)', borderColor: 'rgba(67,56,202,0.2)' }}>
            <h4 className="text-sm font-bold mb-1 flex items-center gap-2" style={{ color: 'rgb(var(--text-primary))' }}>
              <Icon name="HandThumbUpIcon" size={16} className="text-indigo-400" />
              {onUpdateVotingText ? (
                <input
                  type="text"
                  value={votingTitle || "Colleague Complement Voting"}
                  onChange={e => onUpdateVotingText(e.target.value, votingDescription || "Vote as a complement to your colleagues whomever meet the expectations. Every submitted vote adds 5 points directly to their activity scores.")}
                  className="bg-transparent text-sm font-bold border-b border-transparent hover:border-indigo-500/30 focus:border-indigo-500 focus:outline-none py-0.5 w-full font-sans"
                  style={{ color: 'rgb(var(--text-primary))' }}
                  placeholder="Colleague Complement Voting"
                />
              ) : (
                votingTitle || "Colleague Complement Voting"
              )}
            </h4>
            {onUpdateVotingText ? (
              <textarea
                value={votingDescription || "Vote as a complement to your colleagues whomever meet the expectations. Every submitted vote adds 5 points directly to their activity scores."}
                onChange={e => onUpdateVotingText(votingTitle || "Colleague Complement Voting", e.target.value)}
                className="w-full bg-transparent text-xs leading-relaxed border border-transparent hover:border-indigo-500/30 rounded p-1 focus:border-indigo-500 focus:outline-none resize-none h-16 font-sans text-slate-400"
                placeholder="Vote as a complement to your colleagues whomever meet the expectations..."
              />
            ) : (
              <p className="text-xs leading-relaxed text-slate-400">
                {votingDescription || "Vote as a complement to your colleagues whomever meet the expectations. Every submitted vote adds 5 points directly to their activity scores."}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {votingCategories.map(cat => (
              <div
                key={cat.key}
                className="rounded-xl p-4 border space-y-2"
                style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border-subtle))' }}
              >
                <p className="text-xs font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{cat.label}</p>
                <div className="flex gap-2">
                  <div className="h-8 flex-1 max-w-xs rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]" />
                </div>
                <div className="h-7 rounded border-b border-black/10 dark:border-white/10 bg-transparent" style={{ maxWidth: '70%' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Attended Course & PLGT Play Submission */}
      {showAttendedCourse && (
        <div className="space-y-4 pt-4 border-t border-black/5 dark:border-white/5">
          <div className="rounded-xl p-5 border" style={{ background: 'rgba(49,46,129,0.04)', borderColor: 'rgba(99,102,241,0.15)' }}>
            <h4 className="text-sm font-bold mb-1 flex items-center gap-2" style={{ color: 'rgb(var(--text-primary))' }}>
              <Icon name="AcademicCapIcon" size={16} className="text-indigo-400" />
              {onUpdateCourseText ? (
                <input
                  type="text"
                  value={courseTitle || "Attended Course & PLGT Play Submission"}
                  onChange={e => onUpdateCourseText(e.target.value, courseDescription || "Submit details of courses you have attended and your participation in PLGT Play events, along with supporting documents/photos.")}
                  className="bg-transparent text-sm font-bold border-b border-transparent hover:border-indigo-500/30 focus:border-indigo-500 focus:outline-none py-0.5 w-full font-sans"
                  style={{ color: 'rgb(var(--text-primary))' }}
                  placeholder="Attended Course & PLGT Play Submission"
                />
              ) : (
                courseTitle || "Attended Course & PLGT Play Submission"
              )}
            </h4>
            {onUpdateCourseText ? (
              <textarea
                value={courseDescription || "Submit details of courses you have attended and your participation in PLGT Play events, along with supporting documents/photos."}
                onChange={e => onUpdateCourseText(courseTitle || "Attended Course & PLGT Play Submission", e.target.value)}
                className="w-full bg-transparent text-xs leading-relaxed border border-transparent hover:border-indigo-500/30 rounded p-1 focus:border-indigo-500 focus:outline-none resize-none h-16 font-sans text-slate-500 dark:text-slate-400"
                placeholder="Submit details of courses you have attended and your participation in PLGT Play events..."
              />
            ) : (
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {courseDescription || "Submit details of courses you have attended and your participation in PLGT Play events, along with supporting documents/photos."}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Course column */}
            <div className="rounded-xl p-5 border space-y-3" style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border-subtle))' }}>
              <div>
                <p className="text-xs font-bold mb-1" style={{ color: 'rgb(var(--text-primary))' }}>
                  6. Attended Course (Course Name, Date)
                </p>
                <p className="text-[10px] text-slate-400 mb-2">Please make sure this course is updated in your Google Calendar</p>
                <div className="h-7 rounded border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]" />
              </div>
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>Course cert</p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs font-semibold text-slate-400 opacity-60">
                  <Icon name="ArrowUpTrayIcon" size={12} />
                  Add File
                </div>
              </div>
            </div>

            {/* PLGT Play column */}
            <div className="rounded-xl p-5 border space-y-3" style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border-subtle))' }}>
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>
                  7. PLGT Play (Date &amp; Event)
                </p>
                <div className="h-7 rounded border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]" />
              </div>
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: 'rgb(var(--text-primary))' }}>7. PLGT Play Photo</p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs font-semibold text-slate-400 opacity-60">
                  <Icon name="ArrowUpTrayIcon" size={12} />
                  Add File
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Google Form Link */}
      <div
        className="rounded-xl p-4 flex items-center justify-between gap-4"
        style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(251,191,36,0.15)' }}>
            <Icon name="DocumentTextIcon" size={16} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            {onUpdateFormLabel ? (
              <input
                type="text"
                value={formLabel}
                onChange={e => onUpdateFormLabel(e.target.value)}
                className="w-full bg-transparent text-sm font-medium border-b border-transparent hover:border-black/10 dark:hover:border-white/10 focus:border-indigo-500 focus:outline-none py-0.5"
                style={{ color: 'rgb(var(--text-primary))' }}
                placeholder="Google Form Label"
              />
            ) : (
              <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                {formLabel || `${new Date().getFullYear()} Annual Performance Form`}
              </p>
            )}
            
            {onUpdateFormUrl ? (
              <input
                type="text"
                value={formUrl}
                onChange={e => onUpdateFormUrl(e.target.value)}
                className="w-full bg-transparent text-xs border-b border-transparent hover:border-black/10 dark:hover:border-white/10 focus:border-indigo-500 focus:outline-none py-0.5 mt-0.5"
                style={{ color: 'rgb(var(--text-muted))' }}
                placeholder="Google Form URL (https://...)"
              />
            ) : (
              <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Google Form — HR-managed external evaluation</p>
            )}
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-lg text-xs font-bold opacity-50 border border-black/10 dark:border-white/10 shrink-0" style={{ color: 'rgb(var(--text-secondary))' }}>
          Open Form ↗
        </span>
      </div>
    </div>
  );
}

export default function EvaluationFormBuilder() {
  const { buildAuthHeaders } = useAppContext();
  const [sections, setSections] = useState<Section[]>([]);
  const [formLabel, setFormLabel] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [showAttendedCourse, setShowAttendedCourse] = useState(true);
  const [showColleagueVoting, setShowColleagueVoting] = useState(true);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [votingTitle, setVotingTitle] = useState('');
  const [votingDescription, setVotingDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [users, setUsers] = useState<{ id: string; name: string; status: string }[]>([]);
  const [openDropdownSectionId, setOpenDropdownSectionId] = useState<string | null>(null);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [previewEmployeeId, setPreviewEmployeeId] = useState('');

  const filteredPreviewSections = useMemo(() => {
    if (!previewEmployeeId) return sections;
    return sections.filter(sec => {
      if (!sec.assignedEmployeeIds || sec.assignedEmployeeIds.length === 0) return true;
      return sec.assignedEmployeeIds.includes(previewEmployeeId);
    });
  }, [sections, previewEmployeeId]);

  const authHeaders = useMemo(() => buildAuthHeaders(), [buildAuthHeaders]);

  const loadUsers = async () => {
    try {
      const response = await fetch(`/api/users?t=${Date.now()}`, { headers: authHeaders });
      if (!response.ok) throw new Error('Failed to load users');
      const payload = await response.json();
      if (Array.isArray(payload?.users)) {
        setUsers(
          payload.users
            .filter((u: any) => u.role !== 'admin')
            .map((item: any) => ({
              id: item.id,
              name: item.name,
              status: item.status || 'active'
            }))
        );
      }
    } catch {
      toast.error('Failed to load users list');
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/system-settings', { headers: authHeaders });
      const data = await res.json();
      if (res.ok && data.settings?.general) {
        setSections(data.settings.general.evaluationSections || []);
        setFormLabel(data.settings.general.performanceFormLabel || '');
        setFormUrl(data.settings.general.performanceFormUrl || '');
        setShowAttendedCourse(data.settings.general.showAttendedCourse !== false);
        setShowColleagueVoting(data.settings.general.showColleagueVoting !== false);
        setCourseTitle(data.settings.general.courseTitle || '');
        setCourseDescription(data.settings.general.courseDescription || '');
        setVotingTitle(data.settings.general.votingTitle || '');
        setVotingDescription(data.settings.general.votingDescription || '');
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
    void loadUsers();
  }, [authHeaders]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'update-general-settings',
          evaluationSections: sections,
          showAttendedCourse,
          showColleagueVoting,
          performanceFormLabel: formLabel,
          performanceFormUrl: formUrl,
          courseTitle,
          courseDescription,
          votingTitle,
          votingDescription,
        }),
      });
      if (res.ok) {
        toast.success('Form attributes and sections saved successfully!');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  // Section actions
  const handleAddSection = () => {
    const newSec: Section = {
      id: 'sec-' + Date.now(),
      title: 'Untitled Section',
      attributes: [],
      assignedEmployeeIds: [],
    };
    setSections([...sections, newSec]);
    toast.success('New section added');
  };

  const getSectionAssignedLabel = (assignedIds?: string[]) => {
    if (!assignedIds || assignedIds.length === 0) return 'All Employees';
    const activeUserCount = users.filter(u => u.status === 'active').length;
    if (assignedIds.length === activeUserCount) return 'All Employees';
    return `${assignedIds.length} Employee(s) Selected`;
  };

  const getSelectedNamesText = (assignedIds?: string[]) => {
    if (!assignedIds || assignedIds.length === 0) return '';
    const names = assignedIds.map(id => users.find(u => u.id === id)?.name).filter(Boolean);
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 3).join(', ')} + ${names.length - 3} more`;
  };

  const handleToggleSectionEmployee = (secId: string, employeeId: string) => {
    setSections(
      sections.map(s => {
        if (s.id === secId) {
          const current = s.assignedEmployeeIds || [];
          const next = current.includes(employeeId)
            ? current.filter(id => id !== employeeId)
            : [...current, employeeId];
          return { ...s, assignedEmployeeIds: next };
        }
        return s;
      })
    );
  };

  const handleSelectAllSectionEmployees = (secId: string) => {
    setSections(
      sections.map(s => {
        if (s.id === secId) {
          return { ...s, assignedEmployeeIds: users.map(u => u.id) };
        }
        return s;
      })
    );
  };

  const handleClearSectionEmployees = (secId: string) => {
    setSections(
      sections.map(s => {
        if (s.id === secId) {
          return { ...s, assignedEmployeeIds: [] };
        }
        return s;
      })
    );
  };

  const handleUpdateSectionTitle = (secId: string, title: string) => {
    setSections(sections.map(s => (s.id === secId ? { ...s, title } : s)));
  };

  const handleDeleteSection = (secId: string) => {
    if (!confirm('Are you sure you want to delete this section and all its attributes?')) return;
    setSections(sections.filter(s => s.id !== secId));
    toast.success('Section deleted');
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    const updated = [...sections];
    const temp = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temp;
    setSections(updated);
  };

  const handleAddAttribute = (secId: string) => {
    setSections(
      sections.map(s => {
        if (s.id === secId) {
          const newAttr: Attribute = {
            id: 'attr-' + Date.now() + Math.random().toString(36).substring(2, 7),
            label: 'Untitled Attribute',
            description: '',
          };
          return { ...s, attributes: [...s.attributes, newAttr] };
        }
        return s;
      })
    );
    toast.success('New attribute added');
  };

  const handleUpdateAttribute = (
    secId: string,
    attrId: string,
    updates: Partial<{ label: string; description: string }>
  ) => {
    setSections(
      sections.map(s => {
        if (s.id === secId) {
          return {
            ...s,
            attributes: s.attributes.map(a => (a.id === attrId ? { ...a, ...updates } : a)),
          };
        }
        return s;
      })
    );
  };

  const handleDeleteAttribute = (secId: string, attrId: string) => {
    setSections(
      sections.map(s => {
        if (s.id === secId) {
          return { ...s, attributes: s.attributes.filter(a => a.id !== attrId) };
        }
        return s;
      })
    );
    toast.success('Attribute deleted');
  };

  const moveAttribute = (secId: string, attrIndex: number, direction: 'up' | 'down') => {
    setSections(
      sections.map(s => {
        if (s.id === secId) {
          const nextIndex = direction === 'up' ? attrIndex - 1 : attrIndex + 1;
          if (nextIndex < 0 || nextIndex >= s.attributes.length) return s;
          const updatedAttrs = [...s.attributes];
          const temp = updatedAttrs[attrIndex];
          updatedAttrs[attrIndex] = updatedAttrs[nextIndex];
          updatedAttrs[nextIndex] = temp;
          return { ...s, attributes: updatedAttrs };
        }
        return s;
      })
    );
  };

  if (loading) {
    return (
      <div className="py-20 text-center animate-pulse">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500">Loading form template...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 relative">
      {/* ── Form Builder Header ─────────────────────────────────── */}
      <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden shadow-lg bg-white dark:bg-slate-900">
        <div className="h-2.5 bg-[#673ab7]" />
        <div className="p-6 space-y-3">
          <h2 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
            Performance Evaluation Template
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgb(var(--text-secondary))' }}>
            Build and manage the attributes and sections displayed to HODs and employees during the quarterly self-evaluation process.
          </p>
          <div className="flex flex-wrap items-center gap-6 py-2 border-t border-black/5 dark:border-white/5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAttendedCourse}
                onChange={e => setShowAttendedCourse(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span className="text-xs font-semibold" style={{ color: 'rgb(var(--text-secondary))' }}>
                Include Attended Course &amp; PLGT Play Submission
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showColleagueVoting}
                onChange={e => setShowColleagueVoting(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span className="text-xs font-semibold" style={{ color: 'rgb(var(--text-secondary))' }}>
                Include Colleague Voting Section
              </span>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleAddSection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm"
            >
              <Icon name="PlusIcon" size={14} />
              Add Section
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm ml-auto"
            >
              <Icon name={saving ? 'ArrowPathIcon' : 'CheckIcon'} size={14} className={saving ? 'animate-spin' : ''} />
              {saving ? 'Saving Changes...' : 'Save Template'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Sections & Attributes Editor ────────────────────────── */}
      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-12 text-center bg-black/[0.01] dark:bg-white/[0.01]">
          <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800/30 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Icon name="DocumentTextIcon" size={24} />
          </div>
          <p className="text-sm font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
            No sections defined yet
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Click &ldquo;Add Section&rdquo; above to start building your customized evaluation form sections and attributes.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((sec, secIndex) => (
            <div
              key={sec.id}
              className="rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-slate-900 overflow-hidden shadow-md relative"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />

              {/* Section Header */}
              <div className="p-5 border-b border-black/5 dark:border-white/5 flex items-center gap-3 bg-black/[0.01] dark:bg-white/[0.01]">
                <div className="flex-1">
                  <input
                    type="text"
                    value={sec.title}
                    onChange={e => handleUpdateSectionTitle(sec.id, e.target.value)}
                    className="w-full bg-transparent text-base font-bold text-slate-800 dark:text-slate-100 border-b border-transparent hover:border-black/10 focus:border-indigo-500 focus:outline-none transition-colors py-1"
                    placeholder="Section Title"
                  />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                      Section {secIndex + 1} of {sections.length}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700 text-[10px] font-bold">|</span>
                    
                    {/* Employee multi-select dropdown */}
                    <div className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenDropdownSectionId(openDropdownSectionId === sec.id ? null : sec.id);
                          setEmployeeSearchQuery('');
                        }}
                        className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider hover:underline transition-colors focus:outline-none"
                        style={{ color: (sec.assignedEmployeeIds && sec.assignedEmployeeIds.length > 0) ? 'rgb(99, 102, 241)' : 'rgb(var(--text-secondary))' }}
                      >
                        <Icon name="UserIcon" size={10} />
                        Assigned To: {getSectionAssignedLabel(sec.assignedEmployeeIds)}
                        <Icon name={openDropdownSectionId === sec.id ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={10} />
                      </button>

                      {/* Display first few selected employee names in parentheses for clarity */}
                      {sec.assignedEmployeeIds && sec.assignedEmployeeIds.length > 0 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 italic ml-1.5">
                          ({getSelectedNamesText(sec.assignedEmployeeIds)})
                        </span>
                      )}

                      {openDropdownSectionId === sec.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownSectionId(null)} />
                          <div 
                            className="absolute left-0 mt-2 w-64 rounded-xl border border-black/10 dark:border-white/10 shadow-2xl p-2.5 z-20"
                            style={{ background: 'rgb(var(--bg-card))' }}
                          >
                            <div className="flex items-center justify-between px-1 mb-2 pb-1 border-b border-black/5 dark:border-white/5">
                              <button
                                type="button"
                                className="text-[9px] font-bold text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 uppercase tracking-wider"
                                onClick={() => handleSelectAllSectionEmployees(sec.id)}
                              >
                                Select All
                              </button>
                              <button
                                type="button"
                                className="text-[9px] font-bold text-red-500 hover:text-red-600 dark:hover:text-red-400 uppercase tracking-wider"
                                onClick={() => handleClearSectionEmployees(sec.id)}
                              >
                                Clear (All)
                              </button>
                            </div>
                            
                            {/* Search filter inside dropdown */}
                            <div className="mb-2">
                              <input
                                type="text"
                                placeholder="Search employees..."
                                value={employeeSearchQuery}
                                onChange={e => setEmployeeSearchQuery(e.target.value)}
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-0.5">
                              {users
                                .filter(u => u.status === 'active')
                                .filter(u => u.name.toLowerCase().includes(employeeSearchQuery.toLowerCase()))
                                .map(user => {
                                  const isSelected = (sec.assignedEmployeeIds || []).includes(user.id);
                                  return (
                                    <label
                                      key={user.id}
                                      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                      style={{ background: isSelected ? 'rgba(99,102,241,0.08)' : 'transparent' }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggleSectionEmployee(sec.id, user.id)}
                                        className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                      />
                                      <span 
                                        className="text-xs flex-1 select-none truncate" 
                                        style={{ color: isSelected ? 'rgb(var(--text-primary))' : 'rgb(var(--text-secondary))' }}
                                      >
                                        {user.name}
                                      </span>
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveSection(secIndex, 'up')} disabled={secIndex === 0} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 disabled:opacity-30 transition-colors" title="Move Up">
                    <Icon name="ChevronUpIcon" size={16} />
                  </button>
                  <button onClick={() => moveSection(secIndex, 'down')} disabled={secIndex === sections.length - 1} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 disabled:opacity-30 transition-colors" title="Move Down">
                    <Icon name="ChevronDownIcon" size={16} />
                  </button>
                  <button onClick={() => handleAddAttribute(sec.id)} className="p-1.5 rounded-lg hover:bg-indigo-500/10 text-indigo-500 transition-colors" title="Add Attribute">
                    <Icon name="PlusIcon" size={16} />
                  </button>
                  <button onClick={() => handleDeleteSection(sec.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors" title="Delete Section">
                    <Icon name="TrashIcon" size={16} />
                  </button>
                </div>
              </div>

              {/* Attributes */}
              <div className="p-5 space-y-4">
                {sec.attributes.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 italic">
                    No attributes in this section. Click the &ldquo;+&rdquo; icon above to add one.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sec.attributes.map((attr, attrIndex) => (
                      <div key={attr.id} className="rounded-xl border border-black/5 dark:border-white/5 p-4 bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 space-y-3">
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Attribute / Question Label</label>
                              <input
                                type="text"
                                value={attr.label}
                                onChange={e => handleUpdateAttribute(sec.id, attr.id, { label: e.target.value })}
                                className="w-full bg-transparent text-sm font-bold text-slate-800 dark:text-slate-200 border-b border-black/5 dark:border-white/5 focus:border-indigo-500 focus:outline-none transition-colors py-1"
                                placeholder="e.g. Continuous Learner"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Guidance / Description</label>
                              <textarea
                                value={attr.description || ''}
                                onChange={e => handleUpdateAttribute(sec.id, attr.id, { description: e.target.value })}
                                className="w-full bg-transparent text-xs text-slate-600 dark:text-slate-400 border border-black/5 dark:border-white/5 rounded-lg p-2 focus:border-indigo-500 focus:outline-none transition-colors resize-none h-16"
                                placeholder="Explain what behaviors or indicators describe this attribute..."
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0 pt-6">
                            <button onClick={() => moveAttribute(sec.id, attrIndex, 'up')} disabled={attrIndex === 0} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 disabled:opacity-30 transition-colors" title="Move Up">
                              <Icon name="ChevronUpIcon" size={14} />
                            </button>
                            <button onClick={() => moveAttribute(sec.id, attrIndex, 'down')} disabled={attrIndex === sec.attributes.length - 1} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 disabled:opacity-30 transition-colors" title="Move Down">
                              <Icon name="ChevronDownIcon" size={14} />
                            </button>
                            <button onClick={() => handleDeleteAttribute(sec.id, attr.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors mt-2" title="Delete">
                              <Icon name="TrashIcon" size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Employee View Preview (always visible) ───────────────── */}
      <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden shadow-md bg-white dark:bg-slate-900">
        {/* Collapsible header */}
        <button
          onClick={() => setPreviewOpen(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/5 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Icon name="EyeIcon" size={15} className="text-indigo-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
                Employee View Preview
              </p>
              <p className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                Exactly what employees see in their Evaluation → Attributes tab
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(99,102,241,0.1)', color: 'rgb(99 102 241)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Live
            </span>
            <Icon name={previewOpen ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="text-slate-400" />
          </div>
        </button>

        {previewOpen && (
          <div className="p-6 animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
            {/* Employee Preview Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Preview as Employee:</span>
                <select
                  value={previewEmployeeId}
                  onChange={e => setPreviewEmployeeId(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm font-semibold"
                >
                  <option value="">Show All Sections (Admin View)</option>
                  {users.filter(u => u.status === 'active').map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                {previewEmployeeId ? 'Filtering: Assigned Sections Only' : 'Viewing all sections'}
              </span>
            </div>

            <EmployeeAttributePreview
              sections={filteredPreviewSections}
              formLabel={formLabel}
              formUrl={formUrl}
              showAttendedCourse={showAttendedCourse}
              showColleagueVoting={showColleagueVoting}
              courseTitle={courseTitle}
              courseDescription={courseDescription}
              votingTitle={votingTitle}
              votingDescription={votingDescription}
              onUpdateSectionTitle={handleUpdateSectionTitle}
              onUpdateAttribute={handleUpdateAttribute}
              onAddSection={previewEmployeeId ? undefined : handleAddSection}
              onDeleteSection={previewEmployeeId ? undefined : handleDeleteSection}
              onMoveSection={previewEmployeeId ? undefined : moveSection}
              onAddAttribute={previewEmployeeId ? undefined : handleAddAttribute}
              onDeleteAttribute={previewEmployeeId ? undefined : handleDeleteAttribute}
              onMoveAttribute={previewEmployeeId ? undefined : moveAttribute}
              onUpdateFormLabel={setFormLabel}
              onUpdateFormUrl={setFormUrl}
              onUpdateCourseText={(title, desc) => {
                setCourseTitle(title);
                setCourseDescription(desc);
              }}
              onUpdateVotingText={(title, desc) => {
                setVotingTitle(title);
                setVotingDescription(desc);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
