'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { buildClientAuthHeaders } from '@/lib/clientAuth';
import { formatToDisplayDate } from '@/lib/dateUtils';
import { processUnifiedProfile } from '@/lib/profileUtils';
import Icon from '@/components/ui/AppIcon';

import dynamic from 'next/dynamic';
import EmployeeProfileHeader from '@/app/employee-portal/components/EmployeeProfileHeader';

// Lazy load tab components
const EmployeeUnifiedProfilePanel = dynamic(() => import('@/app/employee-portal/components/EmployeeUnifiedProfilePanel'), { ssr: false });
const ActivitiesCrudPanel = dynamic(() => import('@/app/admin-panel/components/ActivitiesCrudPanel'), { ssr: false });
const PenaltiesCrudPanel = dynamic(() => import('@/app/admin-panel/components/PenaltiesCrudPanel'), { ssr: false });
const LeaveBalanceCards = dynamic(() => import('@/app/employee-portal/components/LeavesBalanceCards'), { ssr: false });
const SelfEvaluationSection = dynamic(() => import('@/app/employee-portal/components/SelfEvaluationSection'), { ssr: false });
const ProfileDetailModal = dynamic(() => import('@/components/ui/ProfileDetailModal'), { ssr: false });
const PersonalKpiSummaryCards = dynamic(() => import('@/app/employee-portal/components/PersonalKpiSummaryCards'), { ssr: false });
const PersonalPerformanceHeatmapCard = dynamic(() => import('@/app/employee-portal/components/PersonalPerformanceHeatmapCard'), { ssr: false });
const PersonalLeaveStatusPanel = dynamic(() => import('@/app/employee-portal/components/PersonalLeaveStatusPanel'), { ssr: false });
const ProfileEditForm = dynamic(() => import('@/app/employee-portal/components/ProfileEditForm'), { ssr: false });
const EmployeeLeaveHistoryPanel = dynamic(() => import('@/app/employee-portal/components/EmployeeLeaveHistoryPanel'), { ssr: false });

type ActiveTab = 'overview' | 'activities' | 'leave' | 'evaluation' | 'penalties';

interface PersonalPortalClientProps {
  basePath: string;
}

export default function PersonalPortalClient({ basePath }: PersonalPortalClientProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { selectedYear, userName, setUserName, userRole, userDepartment, userId, portalData, setPortalData } = useAppContext();
  const isArchive = selectedYear < new Date().getFullYear();
  
  const tabParam = searchParams.get('tab') as ActiveTab;
  const viewParam = searchParams.get('view');
  
  // Logic to detect current tab from path or param
  const pathSegments = pathname.split('/');
  const lastSegment = pathSegments[pathSegments.length - 1] as ActiveTab;
  const validTabs: ActiveTab[] = ['overview', 'activities', 'leave', 'evaluation', 'penalties'];
  
  const [mounted, setMounted] = useState(false);
  
  // Calculate initial tab based on URL to match SSR
  const initialTab = useMemo(() => {
    return tabParam || (validTabs.includes(lastSegment) ? lastSegment : 'overview');
  }, [tabParam, lastSegment, validTabs]);

  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);

  const [showProfile, setShowProfile] = useState(viewParam === 'profile');
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [showEditForm, setShowEditForm] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state with URL
  useEffect(() => {
    const currentTab = tabParam || (validTabs.includes(lastSegment) ? lastSegment : 'overview');
    if (currentTab !== activeTab) {
      setActiveTab(currentTab);
    }
  }, [tabParam, lastSegment, activeTab]);

  useEffect(() => {
    setShowProfile(viewParam === 'profile');
  }, [viewParam]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const cacheKey = `${userId}-${selectedYear}-${periodFilter}`;

    const loadProfile = async () => {
      if (!userId) return;
      
      // Always fetch fresh profile to ensure synchronization

      try {
        setLoading(true);
        const authHeaders = buildClientAuthHeaders({
          role: userRole as any,
          userId: userId,
          userName: userName,
          department: userDepartment
        });
        
        const query = new URLSearchParams({
          employeeId: userId,
          year: String(selectedYear),
        });
        if (periodFilter !== 'all') {
          query.set('periodType', periodFilter);
        }

        const response = await fetch(`/api/employee-profile?${query.toString()}`, {
          headers: authHeaders,
          signal: controller.signal,
        });
        
        if (!response.ok) {
          console.warn(`Profile fetch returned ${response.status}: ${response.statusText}`);
          if (!cancelled) setLoading(false);
          return;
        }

        const data = await response.json();
        if (!cancelled) {
          setProfileData(data.profile);
          // Update global cache
          setPortalData({
            cacheKey,
            profile: data.profile,
            timestamp: Date.now()
          });
        }
      } catch (error: any) {
        if (!cancelled && error.name !== 'AbortError') {
          console.error('Failed to load portal profile:', error);
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    };
    loadProfile();
    return () => { cancelled = true; controller.abort(); clearTimeout(timeoutId); };
  }, [selectedYear, userId, userRole, userName, userDepartment, periodFilter, refreshNonce, setPortalData]);

  const displayProfile: any = useMemo(() => {
    return processUnifiedProfile(profileData, {
      userId,
      userName,
      userRole: userRole || 'employee',
      userDepartment: userDepartment || '',
      selectedYear,
      isArchive
    });
  }, [profileData, userName, userId, userRole, userDepartment, isArchive, selectedYear]);

  const handleTabChange = (tab: ActiveTab) => {
    startTransition(() => {
        setActiveTab(tab);
        const baseSegments = basePath.split('/');
        const lastBaseSegment = baseSegments[baseSegments.length - 1] as ActiveTab;
        
        if (validTabs.includes(lastBaseSegment)) {
          const newPath = pathname.replace(lastBaseSegment, tab);
          router.push(newPath, { scroll: false });
        } else {
          router.push(`${basePath}?tab=${tab}`, { scroll: false });
        }
    });
  };

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'activities', label: 'Activities' },
    { key: 'leave', label: 'Leave' },
    { key: 'evaluation', label: 'Evaluation' },
    { key: 'penalties', label: 'Penalties' },
  ];

  return (
    <div className="flex-1 relative">
      {/* Top Progress Indicator */}
      {(loading || isPending) && (
        <div className="absolute top-0 left-0 right-0 h-[2px] z-50 bg-blue-500/10 overflow-hidden pointer-events-none">
          <div className="h-full bg-blue-500 animate-progress-indeterminate shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
        </div>
      )}
      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
        
        {/* Profile Header — clickable */}
        <div className="space-y-4">
          <div className="cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setShowProfile(true)} title="Click to view full profile">
            <EmployeeProfileHeader externalData={displayProfile} />
          </div>

          {mounted && userRole === 'hod' && activeTab === 'overview' && (
              <div className="rounded-xl p-4" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)' }}>
                <p className="text-sm font-bold" style={{ color: 'rgb(180 83 9)' }}>
                  HOD Notice: System framework changes must be escalated through the Admin Portal.
                </p>
              </div>
          )}
        </div>

        {/* Tab Navigation & Actions */}
        <div className="flex items-center justify-between border-b border-white/5 pb-1 gap-4 flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`px-4 py-2 text-sm font-bold transition-all relative whitespace-nowrap ${
                  activeTab === tab.key ? 'text-blue-500' : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'overview' && (
              <button
                onClick={() => setShowEditForm(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <Icon name="PencilSquareIcon" size={14} />
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className={`min-h-[400px] transition-opacity duration-200 ${isPending ? 'opacity-50' : 'opacity-100'}`}>
          {loading && !profileData ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
              <p className="text-sm font-medium animate-pulse text-slate-400">Loading portal data...</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-fade-in">
                  <PersonalKpiSummaryCards 
                    summary={profileData?.summary} 
                    performanceHistory={profileData?.performance}
                    penaltiesHistory={profileData?.penalties}
                    leaveHistory={profileData?.leaveHistory}
                    wfhUsed={displayProfile.wfhUsed} 
                    wfhLimit={displayProfile.wfhLimit} 
                    onCardClick={(tab) => handleTabChange(tab)}
                  />
                  
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2">
                      <PersonalPerformanceHeatmapCard 
                        summary={profileData?.summary}
                        metrics={{
                          performance: profileData?.summary?.provisionalMetrics?.performance ?? 0,
                          participation: profileData?.summary?.provisionalMetrics?.participation ?? 0,
                          popularity: profileData?.summary?.provisionalMetrics?.popularity ?? 0,
                        }}
                      />
                    </div>
                    <div className="xl:col-span-1">
                      <PersonalLeaveStatusPanel 
                        leaveHistory={profileData?.leaveHistory} 
                        onViewFullHistory={() => handleTabChange('leave')}
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <EmployeeUnifiedProfilePanel />
                  </div>
                </div>
              )}
              
              {activeTab === 'activities' && (
                <ActivitiesCrudPanel 
                  externalEmployeeId={userId} 
                  canEdit={false} 
                  canDelete={false}
                  showAddButton={false}
                />
              )}
              
              {activeTab === 'leave' && (
                <div className="space-y-6 animate-fade-in">
                  <LeaveBalanceCards isArchive={isArchive} employeeId={userId} />
                  <div className="pt-4">
                    <EmployeeLeaveHistoryPanel 
                      employeeId={userId} 
                      onAction={() => setRefreshNonce(prev => prev + 1)}
                    />
                  </div>
                </div>
              )}
              
              {activeTab === 'evaluation' && (
                <SelfEvaluationSection 
                  isArchive={isArchive} 
                  general={profileData?.general}
                  forceSelfView={true}
                />
              )}
              
              {activeTab === 'penalties' && (
                <PenaltiesCrudPanel 
                  externalEmployeeId={userId} 
                  canEdit={false} 
                  canDelete={false}
                  showAddButton={false}
                  allowCashPenalties={true}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Profile Detail Modal */}
      <ProfileDetailModal
        open={showProfile}
        onClose={() => {
          setShowProfile(false);
          const currentParams = new URLSearchParams(searchParams.toString());
          currentParams.delete('view');
          router.push(`${basePath}?${currentParams.toString()}`, { scroll: false });
        }}
        profile={displayProfile}
        onEdit={displayProfile.id === userId ? () => { setShowProfile(false); setShowEditForm(true); } : undefined}
      />

      {showEditForm && (
        <ProfileEditForm
          currentData={{
            name: decodeURIComponent(profileData?.userMeta?.name || userName || ''),
            email: profileData?.userMeta?.email || '',
            phone: profileData?.userMeta?.phone || '',
            address: profileData?.userMeta?.address || '',
            emergencyContact: profileData?.userMeta?.emergencyContact || '',
            preferredName: profileData?.userMeta?.preferredName || '',
            bankDetails: profileData?.userMeta?.bankDetails || '',
          }}
          onClose={() => setShowEditForm(false)}
          onSuccess={(newData) => {
            if (newData?.name) setUserName(newData.name);
            setShowEditForm(false);
            setRefreshNonce(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
}
