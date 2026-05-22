'use client';
import React from 'react';
import Icon from '@/components/ui/AppIcon';

import { useAppContext } from '@/context/AppContext';
import { getInitials } from '@/lib/clientAuth';

export default function EmployeeProfileHeader({ externalData }: { externalData?: any }) {
  const { userName, userRole, userDepartment, userId } = useAppContext();

  const rawName = externalData?.name || userName || 'Employee';
  const decodedName = React.useMemo(() => {
    try { return decodeURIComponent(rawName); } catch { return rawName; }
  }, [rawName]);

  const employee = {
    name: decodedName,
    id: externalData?.id || userId || 'ID-PENDING', 
    role: externalData?.role || (userRole === 'hod' ? `Head of ${userDepartment || 'Department'}` : userRole === 'admin' ? 'System Admin' : 'Employee'),
    dept: externalData?.dept || userDepartment || 'Operations',
    joinDate: externalData?.joinDate || 'TBD',
    yearsService: externalData?.yearsService || 0,
    monthsService: externalData?.monthsService ?? 0,
    status: externalData?.status || 'Active',
    reportTo: externalData?.reportTo || 'HOD',
    wfhUsed: externalData?.wfhUsed || 0,
    wfhLimit: externalData?.wfhLimit || 4,
  };

  const initials = getInitials(employee.name, '??');


  return (
    <div className="rounded-xl p-5" style={{ background: 'rgb(var(--bg-card))', border: '1px solid rgb(var(--border-subtle))' }}>
      <div className="flex items-start gap-5 flex-wrap">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{ background: 'rgba(79,127,255,0.2)', color: 'rgb(79 127 255)', border: '2px solid rgba(79,127,255,0.3)' }}>
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{employee?.name}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(52,211,153,0.1)', color: 'rgb(52 211 153)', border: '1px solid rgba(52,211,153,0.2)' }}>
              {employee?.status}
            </span>
          </div>
          <p className="text-sm mb-2" style={{ color: 'rgb(var(--text-secondary))' }}>
            {employee?.role} · {employee?.dept} · Reports to {employee?.reportTo}
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Icon name="IdentificationIcon" size={14} className="text-blue-400" />
              <span className="text-xs font-mono" style={{ color: 'rgb(var(--text-secondary))' }}>{employee?.id}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon name="CalendarIcon" size={14} className="text-purple-400" />
              <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>Joined {employee?.joinDate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon name="ClockIcon" size={14} className="text-amber-400" />
              <span className="text-xs font-semibold" style={{ color: 'rgb(251 191 36)' }}>
                {employee?.yearsService}y {employee?.monthsService}m tenure
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon name="HomeIcon" size={14} className="text-emerald-400" />
              <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                WFH: <span style={{ color: 'rgb(52 211 153)' }}>{employee?.wfhUsed}/{employee?.wfhLimit}</span> days used this month
              </span>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}