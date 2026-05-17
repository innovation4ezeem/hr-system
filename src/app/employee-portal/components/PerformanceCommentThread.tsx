'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { useAppContext } from '@/context/AppContext';

interface Comment {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
  authorId: string;
}

interface PerformanceCommentThreadProps {
  employeeId: string;
  periodLabel: string;
  authHeaders: any;
  currentUserId: string;
}

export default function PerformanceCommentThread({ employeeId, periodLabel, authHeaders, currentUserId }: PerformanceCommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const { userRole } = useAppContext();
  const isHod = userRole === 'hod' || userRole === 'admin';
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchComments = async () => {
    if (!employeeId || !periodLabel) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/evaluations?mode=comments&employeeId=${employeeId}&periodLabel=${encodeURIComponent(periodLabel)}`, { headers: authHeaders });
      const data = await res.json();
      if (res.ok) {
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [employeeId, periodLabel]);

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'post-comment',
          employeeId,
          periodLabel,
          content: newComment.trim()
        })
      });
      if (res.ok) {
        setNewComment('');
        fetchComments();
        toast.success('Comment posted');
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || 'Failed to post comment');
      }
    } catch (err) {
      toast.error('Error posting comment');
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteComment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-comment', id })
      });
      if (res.ok) {
        fetchComments();
        toast.success('Comment deleted');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to delete comment');
      }
    } catch (err) {
      toast.error('Error deleting comment');
    }
  };

  // Group comments by date
  const groupedComments = useMemo(() => {
    const groups: { [key: string]: Comment[] } = {};
    comments.forEach(c => {
      const date = new Date(c.createdAt).toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' });
      const today = new Date().toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' });
      const label = date === today ? 'Today' : date;
      if (!groups[label]) groups[label] = [];
      groups[label].push(c);
    });
    return groups;
  }, [comments]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getInitials = (name: string) => {
    return (name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col h-full max-h-[600px] animate-in fade-in duration-500">
      {/* Input Area */}
      <div className="mb-6 rounded-xl border border-white/10 overflow-hidden bg-slate-800/30">
        <div className="p-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Leave a comment..."
            className="w-full bg-transparent border-none focus:ring-0 text-sm resize-none min-h-[100px]"
            style={{ color: 'rgb(var(--text-primary))' }}
          />
        </div>
        <div className="px-4 py-2 bg-white/5 border-t border-white/10 flex items-center justify-between">
         
          <button
            onClick={handlePostComment}
            disabled={posting || !newComment.trim()}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50"
          >
            {posting ? 'Posting...' : 'Post a Comment'}
          </button>
        </div>
      </div>

      {/* Timeline Area */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-8 scrollbar-thin">
        {loading && comments.length === 0 ? (
          <div className="py-20 text-center animate-pulse">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading conversation history...</p>
          </div>
        ) : (
          Object.keys(groupedComments).map(dateLabel => (
            <div key={dateLabel} className="space-y-4">
              {/* Date Separator */}
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-white/5"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">{dateLabel}</span>
                <div className="flex-grow border-t border-white/5"></div>
              </div>

              {/* Comments in this group */}
              <div className="space-y-4">
                {groupedComments[dateLabel].map(comment => (
                  <div key={comment.id} className="group flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-lg">
                      {getInitials(comment.authorName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{comment.authorName}</span>
                        <span className="text-[10px] text-slate-500">{formatTime(comment.createdAt)}</span>
                        {isHod && (
                          <button 
                            onClick={() => handleDeleteComment(comment.id)}
                            className="ml-auto p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"
                            title="Delete comment"
                          >
                            <Icon name="TrashIcon" size={14} />
                          </button>
                        )}
                      </div>
                      <div className="rounded-xl p-3 text-sm bg-white/[0.03] border border-white/5 group-hover:bg-white/[0.05] transition-all" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {comment.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        
        {!loading && comments.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-600">
              <Icon name="ChatBubbleLeftRightIcon" size={24} />
            </div>
            <p className="text-sm font-medium text-slate-400">No comments yet</p>
            <p className="text-xs text-slate-500 mt-1">Start the conversation by leaving a comment above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
