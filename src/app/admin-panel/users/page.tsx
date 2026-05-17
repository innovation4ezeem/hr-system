import React from 'react';
import AppLayout from '@/components/AppLayout';
import Topbar from '@/components/Topbar';
import { AdminPanelSectionClient } from '../components/AdminPanelClient';

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Admin - Users"
        subtitle="System Framework - User Management"
        showProfile={false}
      />
      <AdminPanelSectionClient fixedTab="users" />
    </div>
  );
}
