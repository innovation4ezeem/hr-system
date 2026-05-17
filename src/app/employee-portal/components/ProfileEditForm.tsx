'use client';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { isValidMalaysiaPhone, formatMalaysiaPhone } from '@/lib/dateUtils';
import { useAppContext } from '@/context/AppContext';
import { buildClientAuthHeaders } from '@/lib/clientAuth';

interface ProfileEditFormProps {
  onClose: () => void;
  onSuccess: (data?: any) => void;
  currentData: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    emergencyContact?: string;
    preferredName?: string;
    bankDetails?: string;
    mailingAddress?: string;
  };
}

export default function ProfileEditForm({ onClose, onSuccess, currentData }: ProfileEditFormProps) {
  const [formData, setFormData] = useState({
    name: currentData.name || '',
    email: currentData.email || '',
    phone: currentData.phone || '',
    address: currentData.address || '',
    emergencyContact: currentData.emergencyContact || '',
    preferredName: currentData.preferredName || '',
    bankDetails: currentData.bankDetails || '',
    mailingAddress: currentData.mailingAddress || '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { userId, userRole, userName, userDepartment } = useAppContext();
  const authHeaders = buildClientAuthHeaders({
    role: userRole as any,
    userId: userId,
    userName: userName,
    department: userDepartment
  });

  // Draft persistence
  useEffect(() => {
    const key = `profile_draft_${userId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setFormData(JSON.parse(saved));
      } catch (e) {}
    }
  }, [userId]);

  useEffect(() => {
    const key = `profile_draft_${userId}`;
    if (JSON.stringify(formData) !== JSON.stringify(currentData)) {
      localStorage.setItem(key, JSON.stringify(formData));
    }
  }, [formData, userId, currentData]);

  const clearDraft = () => localStorage.removeItem(`profile_draft_${userId}`);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let currentPhone = formData.phone;
    if (currentPhone && !isValidMalaysiaPhone(currentPhone)) {
      const formatted = formatMalaysiaPhone(currentPhone);
      if (isValidMalaysiaPhone(formatted)) {
        currentPhone = formatted;
        setFormData(p => ({ ...p, phone: formatted }));
      } else {
        toast.error('Invalid phone format. Please use +60xx-xxxxxxx');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // 1. Update Profile Details
      const response = await fetch('/api/profile/update-request', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ requestedChanges: formData }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to submit profile update request');

      // 2. Update Password if requested
      if (showPasswordSection && newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error('New passwords do not match.');
        }
        if (newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }

        const passRes = await fetch('/api/profile/change-password', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify({ newPassword }),
        });

        const passResult = await passRes.json();
        if (!passRes.ok) throw new Error(passResult.error || 'Failed to update password');
      }

      toast.success('Profile and password updated successfully!');
      clearDraft();
      onSuccess(formData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Edit Profile Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <Icon name="XMarkIcon" size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Full Name</label>
              <input
                className="input-base text-sm"
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Preferred Name</label>
              <input
                className="input-base text-sm"
                value={formData.preferredName}
                onChange={e => setFormData(p => ({ ...p, preferredName: e.target.value }))}
                placeholder="Tony Stark"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Email Address</label>
              <input
                type="email"
                className="input-base text-sm"
                value={formData.email}
                onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Phone Number</label>
              <input
                className="input-base text-sm"
                value={formData.phone}
                onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                onBlur={e => {
                  if (e.target.value && !isValidMalaysiaPhone(e.target.value)) {
                    const formatted = formatMalaysiaPhone(e.target.value);
                    if (isValidMalaysiaPhone(formatted)) {
                      setFormData(p => ({ ...p, phone: formatted }));
                    }
                  }
                }}
                placeholder="+6012-3456789"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Home Address</label>
            <textarea
              className="input-base text-sm resize-none"
              rows={2}
              value={formData.address}
              onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
              placeholder="Full residential address"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Mailing Address</label>
            <textarea
              className="input-base text-sm resize-none"
              rows={2}
              value={formData.mailingAddress}
              onChange={e => setFormData(p => ({ ...p, mailingAddress: e.target.value }))}
              placeholder="Full correspondence address"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Emergency Contact</label>
            <input
              className="input-base text-sm"
              value={formData.emergencyContact}
              onChange={e => setFormData(p => ({ ...p, emergencyContact: e.target.value }))}
              placeholder="Name & Relationship (011-XXX-XXXX)"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Bank Details</label>
            <input
              className="input-base text-sm"
              value={formData.bankDetails}
              onChange={e => setFormData(p => ({ ...p, bankDetails: e.target.value }))}
              placeholder="Bank Name & Account Number"
            />
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Icon name={showPasswordSection ? 'ChevronDownIcon' : 'ChevronRightIcon'} size={16} />
              {showPasswordSection ? 'Cancel Password Change' : 'Change Password'}
            </button>

            {showPasswordSection && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">New Password</label>
                  <input
                    type="password"
                    className="input-base text-sm"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Confirm Password</label>
                  <input
                    type="password"
                    className="input-base text-sm"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Match new password"
                  />
                </div>
              </div>
            )}
          </div>
        </form>

        <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
