'use client';

import React from 'react';
import DepartmentsCrudPanel from '../components/DepartmentsCrudPanel';

import AppLayout from '@/components/AppLayout';

export default function AdminDepartmentsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>Organization Departments</h1>
        <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>System Framework - Structure Management</p>
      </div>
      
      <DepartmentsCrudPanel />
    </div>
  );
}
