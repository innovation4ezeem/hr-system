'use client';
import React, { useState } from 'react';
import UserProfileEditor, { UserProfile } from '../../components/UserProfileEditor';
import Topbar from '@/components/Topbar';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EmployeePerformanceReadonlyTable from '@/components/EmployeePerformanceReadonlyTable';
import Icon from '@/components/ui/AppIcon';

interface UserDetailClientProps {
  user: UserProfile;
}

export default function UserDetailClient({ user }: UserDetailClientProps) {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<'profile' | 'performance'>('profile');

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <Topbar
        title={`Admin - ${user.name}`}
        subtitle={currentView === 'profile' ? "Employee Profile & Security" : "Performance History"}
        showProfile={false}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <Link href="/admin-panel/users" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-2 transition-colors">
              <span className="text-lg">←</span> Back to User Directory
            </Link>
            
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setCurrentView('profile')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  currentView === 'profile' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Profile & Security
              </button>
              <button
                onClick={() => setCurrentView('performance')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  currentView === 'performance' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Performance Scores
              </button>
            </div>
          </div>

          {currentView === 'profile' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <UserProfileEditor 
                user={user} 
                onClose={() => router.push('/admin-panel/users')} 
                onSave={() => {}} 
              />
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
                
                <EmployeePerformanceReadonlyTable userId={user.id} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
