'use client';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAppContext } from '@/context/AppContext';
import { buildClientAuthHeaders, getInitials } from '@/lib/clientAuth';

interface SidebarProps {
  role?: 'admin' | 'hod' | 'employee' | 'intern' | 'probation';
  activeRoute?: string;
}

const adminNavGroups = [
  {
    label: 'HR MANAGEMENT',
    items: [
      { label: 'Users', icon: 'UsersIcon', href: '/admin-panel/users', badge: 0 },
      { label: 'Departments', icon: 'BuildingOfficeIcon', href: '/admin-panel/departments', badge: 0 },

    ],
  },
  {
    label: 'PERFORMANCE MANAGEMENT',
    items: [
      { label: 'Overall View', icon: 'ChartPieIcon', href: '/admin-panel/performance/heatmap', badge: 0 },
      { label: 'Scoring System', icon: 'TableCellsIcon', href: '/admin-panel/performance', badge: 0 },
      { label: 'Evaluation Forms', icon: 'DocumentTextIcon', href: '/admin-panel/evaluation-forms', badge: 0 },
    ],
  },
  {
    label: 'LEAVE & PENALTIES MANAGEMENT',
    items: [
      { label: 'Penalties History', icon: 'ExclamationTriangleIcon', href: '/admin-panel/penalties', badge: 0 },
      { label: 'Leave Management', icon: 'CalendarDaysIcon', href: '/admin-panel/leave', badge: 0 },
      { label: 'System Settings', icon: 'Cog6ToothIcon', href: '/admin-panel/settings', badge: 0 },
    ],
  },
];

const managerNavGroups = [
  {
    label: 'OVERVIEW',
    items: [
      { label: 'Manager Overview', icon: 'ChartBarIcon', href: '/manager-dashboard/overview', badge: 0 },
    ],
  },
  {
    label: 'MY PORTAL',
    items: [
      { label: 'My Overview', icon: 'UserCircleIcon', href: '/manager-dashboard/my-overview', badge: 0 },
    ],
  },
  {
    label: 'HR MANAGEMENT',
    items: [
      { label: 'Leave Requests', icon: 'CalendarDaysIcon', href: '/manager-dashboard/leave', badge: 0 },
      { label: 'Penalty Log', icon: 'ExclamationTriangleIcon', href: '/manager-dashboard/penalty', badge: 0 },
      { label: 'Team Activity', icon: 'ClipboardDocumentListIcon', href: '/manager-dashboard/team-activity', badge: 0 },
      { label: 'Team Evaluation', icon: 'PaperClipIcon', href: '/manager-dashboard/evaluation', badge: 0 },

    ],
  },

];

const employeeNavGroups = [
  {
    label: 'OVERVIEW',
    items: [
      { label: 'My Dashboard', icon: 'HomeIcon', href: '/employee-portal/overview', badge: 0 },
    ],
  },
  {
    label: 'MY PORTAL',
    items: [
      { label: 'Apply Leave', icon: 'CalendarDaysIcon', href: '/employee-portal/leave/apply', badge: 0 },
      { label: 'Self Evaluation', icon: 'PencilSquareIcon', href: '/employee-portal/evaluation', badge: 0 },
    ],
  },
  {
    label: 'HR & PERFORMANCE',
    items: [
      { label: 'Leave History', icon: 'ClipboardDocumentListIcon', href: '/employee-portal/leave-history', badge: 0 },
      { label: 'My Activities', icon: 'PaperClipIcon', href: '/employee-portal/activities', badge: 0 },
      { label: 'Penalty History', icon: 'ExclamationTriangleIcon', href: '/employee-portal/penalties', badge: 0 },
    ],
  },
];

export default function Sidebar({ role = 'employee', activeRoute }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { userName, userId, userDepartment, themeMode, setThemeMode, selectedYear, openSelfProfile } = useAppContext();


  const [collapsed, setCollapsed] = useState(false);
  const [expandArmed, setExpandArmed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dynamicBadges, setDynamicBadges] = useState<Record<string, number>>({});
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickRef = useRef<number>(0);

  const fullActiveRoute = useMemo(() => {
    if (activeRoute) return activeRoute;
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams, activeRoute]);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    };
  }, []);

  const navGroups = role === 'admin' ? adminNavGroups : role === 'employee' ? employeeNavGroups : managerNavGroups;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadDynamicBadges = async () => {
      if (!userId) return;

      const authHeaders = buildClientAuthHeaders({
        role,
        userId,
        userName,
        department: userDepartment,
      });

      try {
        const res = await fetch(`/api/sidebar-stats?t=${Date.now()}`, { 
          headers: authHeaders,
          signal: controller.signal 
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const newBadges: Record<string, number> = {};

        if (role === 'admin') {
          newBadges['/admin-panel/leave'] = data.pendingLeaveCount || 0;
        } else if (role === 'hod') {
          newBadges['/manager-dashboard/leave'] = data.pendingLeaveCount || 0;
        }

        setDynamicBadges(newBadges);
      } catch (err: any) {
        if (err.name === 'AbortError' || cancelled) return;
        console.error('Failed to load sidebar stats:', err);
      }
    };

    loadDynamicBadges();
    const interval = setInterval(loadDynamicBadges, 30000); // Refresh every 30s

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [role, userId, userName, userDepartment, selectedYear]);


  // Use stable defaults to avoid hydration mismatch
  const currentRole = role || 'employee';
  const rawDisplayName = userName || (currentRole === 'employee' ? 'Employee' : currentRole === 'admin' ? 'Admin' : 'HOD');
  const displayName = useMemo(() => {
    try {
      return decodeURIComponent(rawDisplayName);
    } catch {
      return rawDisplayName;
    }
  }, [rawDisplayName]);

  const initials = getInitials(displayName, '??');
  const displayRole = currentRole === 'employee' ? 'Employee' : currentRole === 'admin' ? 'System Admin' : 'Head of Operations';

  const handleCollapseToggle = () => {
    if (!collapsed) {
      setCollapsed(true);
      setExpandArmed(false);
      lastClickRef.current = 0;
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
      return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - lastClickRef.current;

    if (timeSinceLastClick < 900) {
      setCollapsed(false);
      setExpandArmed(false);
      lastClickRef.current = 0;
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    } else {
      setExpandArmed(true);
      lastClickRef.current = now;
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
      expandTimerRef.current = setTimeout(() => {
        setExpandArmed(false);
        lastClickRef.current = 0;
      }, 900);
    }
  };

  return (
    <aside
      onDoubleClick={() => {
        if (collapsed) {
          setCollapsed(false);
          setExpandArmed(false);
          lastClickRef.current = 0;
          if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
        }
      }}
      className="flex flex-col h-full transition-all duration-300 ease-in-out flex-shrink-0"
      style={{
        width: collapsed ? 64 : 240,
        background: 'rgb(var(--bg-card))',
        borderRight: '1px solid rgb(var(--border-subtle))',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'rgb(var(--border-subtle))', minHeight: 64 }}>
        <AppLogo size={32} />
        {!collapsed && (
          <span className="font-semibold text-base tracking-tight" style={{ color: 'rgb(var(--text-primary))' }}>
            EzeemOps
          </span>
        )}
        <button
          onClick={handleCollapseToggle}
          className="p-1 rounded-md hover:bg-white/5 transition-colors"
          style={{ color: collapsed && expandArmed ? 'rgb(251 191 36)' : 'rgb(var(--text-muted))' }}
          aria-label={collapsed ? 'Expand sidebar (click twice)' : 'Collapse sidebar'}
          title={collapsed ? (expandArmed ? 'Click again to expand' : 'Click once, then click again to expand') : 'Collapse sidebar'}
        >
          <Icon name={collapsed ? 'ChevronRightIcon' : 'ChevronLeftIcon'} size={16} />
        </button>
      </div>

      {/* Role Badge */}
      {!collapsed && (
        <div className="px-4 py-2">
          <span className="badge text-xs font-medium px-2 py-1 rounded-md" style={{
            background: role === 'admin' ? 'rgba(167,139,250,0.15)' : role === 'hod' ? 'rgba(79,127,255,0.15)' : 'rgba(52,211,153,0.15)',
            color: role === 'admin' ? 'rgb(167 139 250)' : role === 'hod' ? 'rgb(79 127 255)' : 'rgb(52 211 153)',
          }}>
            {role === 'admin' ? 'Admin' : role === 'hod' ? 'HOD / Manager' : 'Employee'}
          </span>
        </div>
      )}

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {navGroups.map((group) => (
          <div key={`group-${group.label}`}>
            {!collapsed && (
              <p className="px-3 mb-1 text-xs font-semibold tracking-wider" style={{ color: 'rgb(var(--text-muted))' }}>
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                // Use useMemo inside the map? No, map items are stable. 
                // But we can calculate it more efficiently.
                const isActive = fullActiveRoute === item.href || (
                  !item.href.includes('?') && 
                  fullActiveRoute.startsWith(item.href + '/') && 
                  !group.items.some(other => other !== item && fullActiveRoute.startsWith(other.href))
                );

                const badge = dynamicBadges[item.href] ?? item.badge;
                return (
                  <Link
                    key={`nav-${item.label}`}
                    href={item.href}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon name={item.icon as never} size={18} className="flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-sm">{item.label}</span>
                        {badge > 0 && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                            style={{ background: 'rgba(248,113,113,0.2)', color: 'rgb(248 113 113)' }}>
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                    {collapsed && badge > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="border-t p-3" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
        <div className="flex items-center gap-3">
          {role === 'admin' ? (
            <button
              onClick={openSelfProfile}
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold border-none cursor-pointer"
              style={{ background: 'rgba(79,127,255,0.2)', color: 'rgb(79 127 255)' }}
              title="Admin Profile"
            >
              {initials}
            </button>
          ) : (
            <button
              onClick={openSelfProfile}
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold hover:ring-2 transition-all border-none cursor-pointer"
              style={{ background: 'rgba(79,127,255,0.2)', color: 'rgb(79 127 255)' }}
              title="View Profile"
            >
              {initials}
            </button>
          )}
          {!collapsed && (
            <button 
              onClick={openSelfProfile}
              className="flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer"
            >
              <p className="text-sm font-medium truncate" style={{ color: 'rgb(var(--text-primary))' }}>
                {displayName}
              </p>
              <p className="text-xs truncate" style={{ color: 'rgb(var(--text-muted))' }}>
                {displayRole}
              </p>
            </button>
          )}
          {!collapsed && (
            <Link href="/" className="p-1 rounded hover:bg-white/5 transition-colors" style={{ color: 'rgb(var(--text-muted))' }}>
              <Icon name="ArrowRightOnRectangleIcon" size={16} />
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}