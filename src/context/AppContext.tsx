'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import type { AppRole } from '@/lib/rbac';
import { readClientIdentity } from '@/lib/clientAuth';
import dynamic from 'next/dynamic';
import { processUnifiedProfile } from '@/lib/profileUtils';

const ProfileDetailModal = dynamic(() => import('@/components/ui/ProfileDetailModal'), { ssr: false });

type ThemeMode = 'dark' | 'light';

interface AppContextType {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  userRole: AppRole;
  setUserRole: (role: AppRole) => void;
  userName: string;
  setUserName: (name: string) => void;
  userDepartment: string;
  setUserDepartment: (department: string) => void;
  userId: string;
  setUserId: (id: string) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  availableYears: Array<{ year: number; archived: boolean }>;
  setAvailableYears: (years: Array<{ year: number; archived: boolean }>) => void;
  portalData: any;
  setPortalData: (data: any) => void;
  buildAuthHeaders: () => Record<string, string>;
  openSelfProfile: () => void;
  silentMode: boolean;
  setSilentMode: (val: boolean) => void;
  loading: boolean;
}

export interface AppProviderBootstrap {
  selectedYear?: number;
  userRole?: AppRole;
  userName?: string;
  userDepartment?: string;
  userId?: string;
  themeMode?: ThemeMode;
}

const AppContext = createContext<AppContextType>({
  selectedYear: new Date().getFullYear(),
  setSelectedYear: () => {},
  userRole: 'employee',
  setUserRole: () => {},
  userName: '',
  setUserName: () => {},
  userDepartment: '',
  setUserDepartment: () => {},
  userId: '',
  setUserId: () => {},
  themeMode: 'dark',
  setThemeMode: () => {},
  availableYears: [{ year: new Date().getFullYear(), archived: false }],
  setAvailableYears: () => {},
  portalData: null,
  setPortalData: () => {},
  buildAuthHeaders: () => ({}),
  openSelfProfile: () => {},
  silentMode: false,
  setSilentMode: () => {},
  loading: true,
});

export function AppProvider({ children, bootstrap }: { children: ReactNode; bootstrap?: AppProviderBootstrap }) {
  const [selectedYear, setSelectedYear] = useState(bootstrap?.selectedYear ?? new Date().getFullYear());
  const [userRole, setUserRole] = useState<AppRole>(bootstrap?.userRole ?? 'employee');
  const [userName, setUserName] = useState(bootstrap?.userName ?? '');
  const [userDepartment, setUserDepartment] = useState(bootstrap?.userDepartment ?? '');
  const [userId, setUserId] = useState(bootstrap?.userId ?? '');
  const [themeMode, setThemeMode] = useState<ThemeMode>(bootstrap?.themeMode ?? 'dark');
  const [availableYears, setAvailableYears] = useState<Array<{ year: number; archived: boolean }>>(() => {
    const current = new Date().getFullYear();
    const years = [];
    // Current year + previous 3 years
    for (let y = current; y >= current - 3; y--) {
      years.push({ year: y, archived: y < current });
    }
    return years;
  });
  const [portalData, setPortalData] = useState<any>(null);
  const [showSelfProfile, setShowSelfProfile] = useState(false);
  const [selfProfileData, setSelfProfileData] = useState<any>(null);
  const [loadingSelfProfile, setLoadingSelfProfile] = useState(false);
  const [silentMode, setSilentMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load identity on client side only to avoid hydration mismatch
    const identity = readClientIdentity(bootstrap?.userRole || 'employee');

    const storedYear = localStorage.getItem('ezeem_selected_year');
    
    // Tab-specific identity (preferred for multi-tab support)
    const sessionUserId = sessionStorage.getItem('ezeem_user_id');
    const sessionRole = sessionStorage.getItem('ezeem_role') as AppRole | null;
    const sessionName = sessionStorage.getItem('ezeem_name');
    const sessionDept = sessionStorage.getItem('ezeem_department');

    // Cross-tab persistence (fallback)
    const storedRole = localStorage.getItem('ezeem_role') as AppRole | null;
    const storedName = localStorage.getItem('ezeem_name');
    const storedDepartment = localStorage.getItem('ezeem_department');
    const storedUserId = localStorage.getItem('ezeem_user_id');

    if (storedYear) {
      const parsedYear = Number(storedYear);
      if (Number.isInteger(parsedYear)) setSelectedYear(parsedYear);
    }
    
    // Apply identity defaults or stored values
    const finalUserId = identity.userId || sessionUserId || storedUserId;
    const finalRole = (identity.role as AppRole) || bootstrap?.userRole || sessionRole || storedRole || 'employee';
    
    setUserRole(finalRole);
    setUserName(identity.userName || bootstrap?.userName || sessionName || storedName || '');
    setUserDepartment(identity.department || bootstrap?.userDepartment || sessionDept || storedDepartment || 'Operations');
    setUserId(finalUserId || bootstrap?.userId || '');

    // Initial theme load from DB
    const loadTheme = async () => {
      if (!finalUserId) return;
      try {
        const res = await fetch(`/api/users/theme?userId=${encodeURIComponent(finalUserId)}`);
        const data = await res.json();
        if (data.theme === 'light' || data.theme === 'dark') {
          setThemeMode(data.theme);
        }
      } catch (err) {
        console.error('Failed to load theme:', err);
      }
    };

    const loadYears = async () => {
      try {
        const res = await fetch('/api/performance-management?mode=years');
        const data = await res.json();
        if (Array.isArray(data.years) && data.years.length > 0) {
          const currentYear = new Date().getFullYear();
          // Only show years up to current year, or years that actually have data
          const filteredYears = data.years
            .map((y: number) => ({ year: y, archived: y < currentYear }))
            .filter((y: any) => y.year <= currentYear); 
          
          setAvailableYears(filteredYears);
        }
      } catch (err) {
        console.error('Failed to load years:', err);
      }
    };

    void loadTheme();
    void loadYears();
    setLoading(false);
  }, []);

  const openSelfProfile = async () => {
    if (!userId) return;
    setShowSelfProfile(true);
    setLoadingSelfProfile(true);
    try {
      const res = await fetch(`/api/employee-profile?employeeId=${userId}`, {
        headers: { 'x-user-id': userId, 'x-user-role': userRole, 'x-user-dept': userDepartment }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          const processed = processUnifiedProfile(data.profile, {
            userId,
            userName,
            userRole: userRole || 'employee',
            userDepartment: userDepartment || '',
            selectedYear: selectedYear,
            isArchive: selectedYear < new Date().getFullYear()
          });
          setSelfProfileData(processed);
        }
      }
    } catch (err) {
      console.error('Failed to fetch self profile:', err);
    } finally {
      setLoadingSelfProfile(false);
    }
  };

  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  const handleSetThemeMode = async (mode: ThemeMode) => {
    setThemeMode(mode);
    document.cookie = `ezeem_theme=${mode}; path=/; max-age=31536000; SameSite=Lax`;
    // Persist to DB if userId is available
    if (userId) {
      try {
        await fetch('/api/users/theme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, theme: mode }),
        });
      } catch (err) {
        console.error('Failed to persist theme:', err);
      }
    }
  };

  useEffect(() => {
    localStorage.setItem('ezeem_selected_year', String(selectedYear));
  }, [selectedYear]);

  const handleSetUserRole = (role: AppRole) => {
    setUserRole(role);
    localStorage.setItem('ezeem_role', role);
    sessionStorage.setItem('ezeem_role', role);
  };

  const handleSetUserName = (name: string) => {
    const decoded = decodeURIComponent(name);
    setUserName(decoded);
    localStorage.setItem('ezeem_name', decoded);
    sessionStorage.setItem('ezeem_name', decoded);
  };

  const handleSetUserDepartment = (department: string) => {
    setUserDepartment(department);
    localStorage.setItem('ezeem_department', department);
    sessionStorage.setItem('ezeem_department', department);
  };

  const handleSetUserId = (id: string) => {
    setUserId(id);
    localStorage.setItem('ezeem_user_id', id);
    sessionStorage.setItem('ezeem_user_id', id);
  };

  const contextValue = useMemo(() => ({
    selectedYear,
    setSelectedYear,
    userRole,
    setUserRole: handleSetUserRole,
    userName,
    setUserName: handleSetUserName,
    userDepartment,
    setUserDepartment: handleSetUserDepartment,
    userId,
    setUserId: handleSetUserId,
    themeMode,
    setThemeMode: handleSetThemeMode,
    availableYears,
    setAvailableYears,
    portalData,
    setPortalData,
    buildAuthHeaders: () => ({
      'x-user-id': userId,
      'x-user-role': userRole,
      'x-user-dept': userDepartment,
      'x-silent-mode': String(silentMode),
    }),
    openSelfProfile,
    silentMode,
    setSilentMode,
    loading,
  }), [
    selectedYear, 
    userRole, 
    userName, 
    userDepartment, 
    userId, 
    themeMode, 
    availableYears,
    portalData,
    showSelfProfile,
    selfProfileData,
    loadingSelfProfile,
    silentMode,
    setSilentMode,
    loading,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      {showSelfProfile && selfProfileData && (
        <ProfileDetailModal
          open={showSelfProfile}
          onClose={() => setShowSelfProfile(false)}
          profile={selfProfileData}
        />
      )}
      {loadingSelfProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
