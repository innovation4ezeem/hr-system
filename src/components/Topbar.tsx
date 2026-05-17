'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useAppContext } from '@/context/AppContext';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  sentAt: string;
  read: boolean;
  relatedId?: string;
}

import { buildClientAuthHeaders, getInitials } from '@/lib/clientAuth';

interface TopbarProps {
  title: string;
  subtitle?: string;
  yearSelector?: boolean;
  selectedYear?: number;
  onYearChange?: (year: number) => void;
  showProfile?: boolean;
  showBack?: boolean;
  onBack?: () => void;
}

export default function Topbar({ 
  title, 
  subtitle, 
  yearSelector, 
  selectedYear: manualYear, 
  onYearChange, 
  showProfile = true,
  showBack = false,
  onBack
}: TopbarProps) {
  const router = useRouter();
  const { userRole, userName, themeMode, setThemeMode, userId, userDepartment, availableYears, selectedYear: contextYear, setSelectedYear, openSelfProfile } = useAppContext();
  const [showNotif, setShowNotif] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const authHeaders = buildClientAuthHeaders({
        role: userRole as any,
        userId,
        userName,
        department: userDepartment
      });
      const res = await fetch(`/api/user-inbox?employeeId=${encodeURIComponent(userId)}`, {
        headers: authHeaders
      });
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        const allNotifs = data.notifications || [];
        const inAppNotifs = allNotifs.filter((n: any) => n.channel === 'in-app');
        setNotifications(inAppNotifs);
        setUnread(inAppNotifs.filter((n: any) => !n.read).length);
      } else {
        const text = await res.text();
        console.warn('Received non-JSON response from inbox API:', text.slice(0, 100));
      }
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.warn('Notification fetch blocked or network unavailable. Check for AdBlockers or network connection.');
      } else {
        console.error('Failed to fetch notifications:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Polling every 1 minute
    return () => clearInterval(interval);
  }, [userId]);

  const initials = getInitials(userName, '??');

  const notifIcon = (type: string) => {
    if (type.includes('penalty')) return 'ExclamationTriangleIcon';
    if (type.includes('performance')) return 'ChartBarIcon';
    return 'CalendarDaysIcon';
  };

  const handleNotifClick = async (notif: Notification) => {
    if (!notif.read) {
      try {
        await fetch('/api/user-inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark-read', notificationId: notif.id })
        });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        setUnread(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Failed to mark read:', err);
      }
    }
    setShowNotif(false);
    const isPersonal = ['leave-submitted', 'leave-approved', 'leave-rejected', 'performance-updated', 'penalty-action', 'balance-updated', 'user-activation'].includes(notif.type);
    
    // Determine redirect based on type and context
    if (notif.type.includes('leave')) {
      if (isPersonal) {
        router.push('/employee-portal/overview?tab=leave');
      } else {
        router.push('/manager-dashboard/leave');
      }
    } else if (notif.type.includes('performance')) {
      if (isPersonal) {
        router.push('/employee-portal/overview?tab=activities');
      } else {
        router.push('/manager-dashboard/overview');
      }
    } else if (notif.type.includes('penalty')) {
      if (isPersonal) {
        router.push('/employee-portal/overview?tab=penalties');
      } else {
        router.push('/manager-dashboard/penalty');
      }
    } else if (notif.type === 'user-activation') {
      router.push('/employee-portal/overview');
    }
  };

  const markAllRead = async () => {
    if (!userId) return;
    try {
      await fetch('/api/user-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear-all', employeeId: userId })
      });
      setUnread(0);
      setNotifications([]);
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  };

  const handleViewProfile = () => {
    setShowProfileMenu(false);
    openSelfProfile();
  };

  const profileHref = userRole === 'employee' ? '/employee-portal/overview?view=profile' : '/manager-dashboard/overview?view=profile';

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
      style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border-subtle))', minHeight: 64 }}>
      <div className="flex items-center gap-4">
        {showBack && (
          <button 
            onClick={() => onBack ? onBack() : router.back()}
            className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors group"
            style={{ color: 'rgb(var(--text-secondary))' }}
          >
            <Icon name="ArrowLeftIcon" size={20} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
        )}
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{title}</h1>
          {subtitle && <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {yearSelector && (
          <select
            value={manualYear ?? contextYear}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (onYearChange) onYearChange(val);
              else setSelectedYear(val);
            }}
            className="input-base text-sm"
            style={{ width: 'auto', padding: '6px 10px' }}
          >
            {availableYears.map(item => (
              <option key={`year-${item.year}`} value={item.year}>
                {item.year} {item.archived ? '(Archive)' : ''}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
          style={{ color: 'rgb(var(--text-secondary))' }}
          title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
        >
          <Icon name={themeMode === 'dark' ? 'SunIcon' : 'MoonIcon'} size={20} />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotif(!showNotif); setShowProfileMenu(false); }}
            className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: 'rgb(var(--text-secondary))' }}
          >
            <Icon name="BellIcon" size={20} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center"
                style={{ background: 'rgb(248 113 113)', color: 'white', fontSize: 10 }}>
                {unread}
              </span>
            )}
          </button>

          {showNotif && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl z-50 animate-scale-in overflow-hidden"
                style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border))' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
                  <span className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>Notifications</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.15)', color: 'rgb(248 113 113)' }}>
                    {unread} new
                  </span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
                      Notification history is clear.
                    </div>
                  )}
                  {notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className="w-full flex gap-3 px-4 py-3 border-b hover:bg-white/5 transition-colors text-left"
                      style={{ borderColor: 'rgb(var(--border-subtle))', background: n.read ? 'transparent' : 'rgba(79,127,255,0.04)' }}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: n.type === 'chat' ? 'rgba(79,127,255,0.15)' : n.type === 'status' ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.15)' }}>
                        <Icon name={notifIcon(n.type) as never} size={14}
                          className={n.type === 'chat' ? 'text-blue-400' : n.type === 'status' ? 'text-red-400' : 'text-amber-400'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug" style={{ color: 'rgb(var(--text-primary))' }}>{n.message}</p>
                        <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>{new Date(n.sentAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: 'rgb(79 127 255)' }} />}
                    </button>
                  ))}
                </div>
                <div className="px-4 py-2 text-center">
                  <button onClick={markAllRead} className="text-xs font-medium" style={{ color: 'rgb(79 127 255)' }}>Clear history</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile Avatar */}
        {showProfile && (
          <div className="relative">
            <button
              onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotif(false); }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold hover:ring-2 transition-all"
              style={{ background: 'rgba(79,127,255,0.2)', color: 'rgb(79 127 255)' }}
              title="View Profile"
            >
              {initials}
            </button>
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-52 rounded-xl shadow-2xl z-50 animate-scale-in overflow-hidden"
                  style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border))' }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
                    <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{userName}</p>
                    <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                      {userRole === 'admin' ? 'Admin' : userRole === 'hod' ? 'HOD / Manager' : 'Employee'}
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={handleViewProfile}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left no-underline"
                    >
                      <Icon name="UserCircleIcon" size={16} className="text-blue-400" />
                      <span className="text-sm" style={{ color: 'rgb(var(--text-primary))' }}>View Profile</span>
                    </button>
                    <Link
                      href="/"
                      onClick={() => setShowProfileMenu(false)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left no-underline"
                    >
                      <Icon name="ArrowRightOnRectangleIcon" size={16} className="text-red-400" />
                      <span className="text-sm" style={{ color: 'rgb(248 113 113)' }}>Sign Out</span>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}