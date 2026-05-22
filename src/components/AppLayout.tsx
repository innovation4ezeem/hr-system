"use client";

import React from 'react';
import Sidebar from './Sidebar';
import { useAppContext } from '@/context/AppContext';
import { usePathname, useRouter } from 'next/navigation';

interface AppLayoutProps {
  children: React.ReactNode;
  role?: 'admin' | 'hod' | 'employee' | 'intern' | 'probation' | 'director';
  activeRoute?: string;
}

export default function AppLayout({ children, role, activeRoute }: AppLayoutProps) {
  const { userRole, loading: contextLoading } = useAppContext();
  const pathname = usePathname();
  const router = useRouter();
  const sidebarRole = userRole === 'admin' ? 'admin' : (role ?? userRole);
  const currentRoute = activeRoute ?? pathname;

  // Authorization Check
  React.useEffect(() => {
    if (contextLoading) return;

    // Check if user is logged in
    const isLoggedIn = typeof window !== 'undefined' && (document.cookie.includes('ezeem_user_id') || localStorage.getItem('ezeem_user_id'));
    if (!isLoggedIn) {
      const targetUrl = encodeURIComponent(window.location.pathname + window.location.search);
      router.push(`/?redirect=${targetUrl}`);
      return;
    }

    if (role && userRole && role !== userRole) {
      // If we are on an Admin page but user is not Admin
      if (role === 'admin' && userRole !== 'admin') {
        router.push((userRole === 'hod' || userRole === 'director') ? '/manager-dashboard' : '/employee-portal');
      }
      // If we are on an HOD page but user is an employee/intern
      else if (role === 'hod' && userRole !== 'admin' && userRole !== 'hod' && userRole !== 'director') {
        router.push('/employee-portal');
      }
      // If we are an Admin but land on HOD/Employee page
      else if (userRole === 'admin' && role !== 'admin' && role !== 'hod' && role !== 'director') {
        const search = window.location.search;
        router.push(`/admin-panel${search}`);
      }
      // If director lands on employee page
      else if (userRole === 'director' && role !== 'admin' && role !== 'hod' && role !== 'director') {
        router.push('/manager-dashboard');
      }
    }
  }, [role, userRole, contextLoading, router]);

  // Show sidebar for management roles only
  const showSidebar = !!sidebarRole && (sidebarRole === 'admin' || sidebarRole === 'hod' || sidebarRole === 'director');

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'rgb(var(--bg-page))', color: 'rgb(var(--text-primary))' }}>
      {showSidebar && <Sidebar role={sidebarRole as any} activeRoute={currentRoute} />}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}