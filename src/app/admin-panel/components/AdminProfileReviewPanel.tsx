'use client';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';

interface ProfileUpdateRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  requestedChanges: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export default function AdminProfileReviewPanel() {
  const [requests, setRequests] = useState<ProfileUpdateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const fetchRequests = async () => {
    try {
      setLoading(true);
      // We'll reuse the pending updates API or create a specific one for list
      const response = await fetch(`/api/profile/updates?mode=pending&t=${Date.now()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch requests');
      setRequests(data.requests || []);
    } catch (error) {
      toast.error('Failed to load pending profile updates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleReview = async (requestId: string, decision: 'approved' | 'rejected') => {
    setProcessingId(requestId);
    try {
      const response = await fetch('/api/profile/update-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, decision, comment }),
      });

      if (!response.ok) throw new Error('Failed to process review');

      toast.success(`Request ${decision} successfully`);
      setComment('');
      fetchRequests();
    } catch (error) {
      toast.error('Error processing review');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Pending Profile Updates</h3>
        <button onClick={fetchRequests} className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs hover:bg-slate-700 transition-colors">
          Refresh List
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
          <Icon name="CheckCircleIcon" size={48} className="mx-auto mb-4 opacity-20" />
          <p>No pending profile update requests to review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requests.map((request) => (
            <div key={request.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold border border-blue-500/20">
                    {request.employeeName?.[0] || 'E'}
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{request.employeeName || 'Unknown Employee'}</h4>
                    <p className="text-[10px] text-slate-500 font-mono">{request.id} • {new Date(request.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wider border border-amber-500/20">
                  Pending Review
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Requested Changes</h5>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(request.requestedChanges).map(([field, value]) => (
                      <div key={field} className="flex flex-col p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{field.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-sm text-slate-200">{String(value) || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Review Action</h5>
                  <div className="space-y-3">
                    <textarea
                      placeholder="Add a comment for the employee (optional)..."
                      className="input-base text-sm min-h-[100px] resize-none"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleReview(request.id, 'approved')}
                        disabled={processingId === request.id}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98]"
                      >
                        Approve Changes
                      </button>
                      <button
                        onClick={() => handleReview(request.id, 'rejected')}
                        disabled={processingId === request.id}
                        className="flex-1 py-3 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-500 font-bold text-sm border border-red-500/20 transition-all active:scale-[0.98]"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
