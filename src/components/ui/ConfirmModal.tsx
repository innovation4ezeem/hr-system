'use client';
import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string | null;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
  loading?: boolean;
  children?: React.ReactNode;
}

export default function ConfirmModal({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'danger', onConfirm, onCancel, children, loading = false
}: ConfirmModalProps) {
  if (!open) return null;

  const colors = {
    danger: { bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)', btn: 'bg-red-500 hover:bg-red-400', icon: 'ExclamationTriangleIcon', iconColor: 'text-red-400' },
    warning: { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', btn: 'bg-amber-500 hover:bg-amber-400', icon: 'ExclamationCircleIcon', iconColor: 'text-amber-400' },
    info: { bg: 'rgba(79,127,255,0.1)', border: 'rgba(79,127,255,0.3)', btn: 'bg-blue-500 hover:bg-blue-400', icon: 'InformationCircleIcon', iconColor: 'text-blue-400' },
  };
  const c = colors[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-xl shadow-2xl animate-scale-in" style={{ background: 'rgb(var(--bg-elevated))', border: '1px solid rgb(var(--border))' }}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
              <Icon name={c.icon as never} size={20} className={c.iconColor} />
            </div>
            <div>
              <h3 className="text-base font-semibold mb-1" style={{ color: 'rgb(var(--text-primary))' }}>{title}</h3>
              <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{message}</p>
              {children}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6 justify-end">
          {cancelLabel !== null && (
            <button onClick={onCancel} className="btn-ghost border" style={{ borderColor: 'rgb(var(--border))' }}>{cancelLabel}</button>
          )}
          <button 
            onClick={() => onConfirm()} 
            disabled={loading}
            className={`${c.btn} text-white font-medium px-4 py-2 rounded-lg transition-all duration-150 active:scale-95 text-sm flex items-center gap-2 disabled:opacity-50`}
          >
            {loading && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />}
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}