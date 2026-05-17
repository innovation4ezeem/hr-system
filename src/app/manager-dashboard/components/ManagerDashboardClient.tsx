'use client';
import React, { useState, useEffect } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAppContext } from '@/context/AppContext';
import { canEditFeature, getDepartmentFilter } from '@/lib/rbac';
import { usePerformanceThresholds } from '@/hooks/usePerformanceThresholds';

// Dynamic imports
const KpiSummaryCards = dynamic(() => import('./KpiSummaryCards'), { ssr: false });
const TeamHeatmap = dynamic(() => import('./TeamHeatmap'), { ssr: false });
const PenaltiesCrudPanel = dynamic(() => import('@/app/admin-panel/components/PenaltiesCrudPanel'), { ssr: false });
const LeaveRequestsPanel = dynamic(() => import('./LeavesRequestsPanel'), { ssr: false });
const ProfileDetailModal = dynamic(() => import('@/components/ui/ProfileDetailModal'), { ssr: false });

type ActiveTab = 'overview' | 'penalty' | 'leave';

// Removed hardcoded managerProfile

export default function ManagerDashboardClient() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { selectedYear, setSelectedYear, userRole, userDepartment, userName, userId, portalData, setPortalData } = useAppContext();
  const { thresholds } = usePerformanceThresholds();
  
  const [profile, setProfile] = useState<any>(null);
  
  useEffect(() => {
    if (userId) {
      // Always fetch fresh profile to ensure synchronization

      fetch(`/api/employee-profile?employeeId=${userId}`, {
        headers: { 'x-user-id': userId, 'x-user-role': userRole || 'hod', 'x-user-dept': userDepartment || '' }
      })
      .then(res => res.json())
      .then(data => {
        if (data.profile) {
          setProfile(data.profile);
        }
      })
      .catch(err => console.error('Failed to load profile:', err));
    }
  }, [userId, userRole, userDepartment, selectedYear, portalData, setPortalData]);

  const departmentScope = getDepartmentFilter(userRole, userDepartment);
  const canManagePenalties = canEditFeature(userRole, 'penalty_logs');
  const canManageLeave = canEditFeature(userRole, 'leave_system');
  const isArchive = selectedYear < new Date().getFullYear();

  const tabParam = searchParams.get('tab') as ActiveTab | null;
  const viewParam = searchParams.get('view');
  const pathTab = pathname?.split('/').pop() as ActiveTab | undefined;
  const [activeTab, setActiveTab] = useState<ActiveTab>(pathTab || tabParam || 'overview');
  const [showProfile, setShowProfile] = useState(viewParam === 'profile');

  if (userRole !== 'admin' && userRole !== 'hod') {
    return (
      <div className="flex-1 grid place-items-center px-6 py-10">
        <div className="max-w-xl rounded-2xl p-6 text-center" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'rgb(248 113 113)' }}>Access Restricted</h3>
          <p className="text-sm mt-2" style={{ color: 'rgb(var(--text-secondary))' }}>
            Manager cockpit is available for Admin and HOD roles only.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const nextTab = pathTab || tabParam || 'overview';
    if (nextTab !== activeTab) setActiveTab(nextTab);
  }, [pathTab, tabParam]);

  useEffect(() => {
    setShowProfile(viewParam === 'profile');
  }, [viewParam]);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    router.push(`/manager-dashboard/${tab}`, { scroll: false });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
        {userRole === 'hod' && (
          <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(79,127,255,0.1)', border: '1px solid rgba(79,127,255,0.25)' }}>
            <p className="text-xs" style={{ color: 'rgb(var(--text-primary))' }}>
              Scoring framework changes and manual leave quota overrides must be escalated to Admin System Framework.
            </p>
          </div>
        )}

       

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            <KpiSummaryCards departmentScope={departmentScope} />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <TeamHeatmap compact departmentScope={departmentScope} thresholds={thresholds} excludeHod />
              </div>
              <div>
                <LeaveRequestsPanel compact departmentScope={departmentScope} canManage={canManageLeave} />
              </div>
            </div>
          </div>
        )}


        {activeTab === 'penalty' && (
          <div className="animate-fade-in">
                <PenaltiesCrudPanel 
                  departmentScope={departmentScope || undefined} 
                  allowCashPenalties={true} 
                />
          </div>
        )}

        {activeTab === 'leave' && (
          <div className="animate-fade-in">
            <LeaveRequestsPanel departmentScope={departmentScope} canManage={canManageLeave} />
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {profile && (
        <ProfileDetailModal
          open={showProfile}
          onClose={() => { setShowProfile(false); router.push(`/manager-dashboard/${activeTab}`, { scroll: false }); }}
          profile={profile}
        />
      )}
    </div>
  );
}