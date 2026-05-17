"use client";

import React from 'react';
import Sidebar from './Sidebar';
import { useAppContext } from '@/context/AppContext';
import { usePathname, useRouter } from 'next/navigation';

interface AppLayoutProps {
  children: React.ReactNode;
  role?: 'admin' | 'hod' | 'employee' | 'intern' | 'probation';
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

    if (role && userRole && role !== userRole) {
      // If we are on an Admin page but user is not Admin
      if (role === 'admin' && userRole !== 'admin') {
        router.push(userRole === 'hod' ? '/manager-dashboard' : '/employee-portal');
      }
      // If we are on an HOD page but user is an employee/intern
      else if (role === 'hod' && userRole !== 'admin' && userRole !== 'hod') {
        router.push('/employee-portal');
      }
      // If we are an Admin but land on HOD/Employee page
      else if (userRole === 'admin' && role !== 'admin') {
        router.push('/admin-panel');
      }
    }
  }, [role, userRole, contextLoading, router]);

  // Show sidebar for management roles only
  const showSidebar = !!sidebarRole && (sidebarRole === 'admin' || sidebarRole === 'hod');

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'rgb(var(--bg-page))', color: 'rgb(var(--text-primary))' }}>
      {showSidebar && <Sidebar role={sidebarRole as any} activeRoute={currentRoute} />}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}