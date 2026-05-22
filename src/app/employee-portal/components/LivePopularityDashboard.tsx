'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import Icon from '@/components/ui/AppIcon';

type Vote = {
  id: string;
  voter_id: string;
  voter_name: string;
  voter_role: string;
  target_employee_id: string;
  target_employee_name: string;
  points: number;
  month: string;
  created_at: string;
};

export default function LivePopularityDashboard() {
  const { selectedYear, buildAuthHeaders } = useAppContext();
  const [votes, setVotes] = useState<Vote[]>([]);
  const currentMonthStr = new Date().toLocaleString('default', { month: 'short' }) + ' ' + selectedYear;

  useEffect(() => {
    let active = true;
    const fetchVotes = async () => {
      try {
        const res = await fetch(`/api/popularity-votes?month=${currentMonthStr}`, {
          headers: buildAuthHeaders(),
        });
        const data = await res.json();
        if (active && data.votes) {
          setVotes(data.votes);
        }
      } catch (err) {
        console.error('Failed to fetch popularity votes:', err);
      }
    };

    fetchVotes();
    const interval = setInterval(fetchVotes, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [currentMonthStr, buildAuthHeaders]);

  const leaderboard = useMemo(() => {
    const scores: Record<string, { name: string; totalPoints: number }> = {};
    votes.forEach(v => {
      if (!scores[v.target_employee_id]) {
        scores[v.target_employee_id] = { name: v.target_employee_name, totalPoints: 0 };
      }
      scores[v.target_employee_id].totalPoints += v.points;
    });

    return Object.values(scores).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [votes]);

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-2xl dark:bg-[#0f0c29] bg-white flex flex-col h-[400px] border dark:border-white/10 border-slate-200">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br dark:from-[#302b63]/50 dark:to-[#24243e]/50 from-slate-100 to-white pointer-events-none" />
      <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-fuchsia-600/30 blur-[60px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-50px] left-[-50px] w-48 h-48 bg-purple-600/30 blur-[60px] rounded-full pointer-events-none" />
      
      <div className="relative p-5 border-b dark:border-white/10 border-slate-200 flex items-center justify-between dark:bg-black/20 bg-white/40 backdrop-blur-md">
        <h3 className="text-sm font-black flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-purple-600 dark:from-fuchsia-400 dark:to-purple-400 uppercase tracking-widest drop-shadow-sm">
          <Icon name="StarIcon" size={18} className="text-fuchsia-500 dark:text-fuchsia-400" />
          Live Popularity Leaderboard
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-700 dark:text-fuchsia-200/60 bg-fuchsia-100 dark:bg-fuchsia-500/10 px-2 py-1 rounded-full border border-fuchsia-200 dark:border-fuchsia-500/20">
          {currentMonthStr}
        </span>
      </div>

      <div className="relative flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        {leaderboard.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
            <Icon name="StarIcon" size={32} className="text-slate-400 dark:text-slate-500 mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-300">No popularity votes yet.</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Be the first to send a sticker!</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {leaderboard.map((user, idx) => (
              <div 
                key={user.name} 
                className={`relative overflow-hidden flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
                  idx === 0 
                    ? 'bg-gradient-to-r from-yellow-50 to-amber-50/50 border-yellow-200 shadow-sm dark:from-yellow-500/20 dark:to-amber-500/10 dark:border-yellow-500/30 dark:shadow-[0_0_15px_rgba(234,179,8,0.15)]' 
                    : idx === 1 
                    ? 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 shadow-sm dark:from-slate-300/20 dark:to-slate-400/10 dark:border-slate-400/30 dark:shadow-[0_0_15px_rgba(148,163,184,0.15)]' 
                    : idx === 2 
                    ? 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200 shadow-sm dark:from-amber-700/20 dark:to-amber-800/10 dark:border-amber-700/30 dark:shadow-[0_0_15px_rgba(180,83,9,0.15)]' 
                    : 'bg-slate-50 border-slate-100 hover:bg-slate-100 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10'
                }`}
              >
                
                <div className="flex items-center gap-4 z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shadow-inner ${
                    idx === 0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-yellow-200 dark:from-yellow-300 dark:to-yellow-600 dark:text-yellow-950 dark:shadow-yellow-500/50' 
                    : idx === 1 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800 shadow-slate-200 dark:from-slate-200 dark:to-slate-400 dark:text-slate-900 dark:shadow-slate-400/50' 
                    : idx === 2 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-amber-950 shadow-amber-200 dark:from-amber-600 dark:to-amber-800 dark:text-amber-50 dark:shadow-amber-900/50' 
                    : 'bg-white text-slate-600 border border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/10'
                  }`}>
                    {idx === 0 ? <Icon name="TrophyIcon" size={18} /> : idx + 1}
                  </div>
                  <div>
                    <span className={`block text-sm font-bold ${idx < 3 ? 'text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-200'}`}>
                      {user.name}
                    </span>
                    {idx === 0 && <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-widest mt-0.5 block">Reigning Champion</span>}
                  </div>
                </div>
                <div className="z-10 flex flex-col items-end">
                  <span className={`text-xl font-black ${
                    idx === 0 ? 'text-yellow-500 dark:text-yellow-400' 
                    : idx === 1 ? 'text-slate-500 dark:text-slate-300' 
                    : idx === 2 ? 'text-amber-600 dark:text-amber-500' 
                    : 'text-fuchsia-600 dark:text-fuchsia-400'
                  }`}>
                    {user.totalPoints}
                  </span>
                  <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400">Points</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
