'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAppContext } from '@/context/AppContext';

type Role = 'admin' | 'hod' | 'employee';
type AuthMode = 'login' | 'forgot-password' | 'reset-password-confirm';

interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

export default function LoginClient() {
  const router = useRouter();
  const { setUserRole, setUserName, setUserDepartment, setUserId } = useAppContext();
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');

  const [recoveryToken, setRecoveryToken] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');

  const loginForm = useForm<LoginForm>({ defaultValues: { email: '', password: '', rememberMe: false } });

  const searchParams = useSearchParams();

  useEffect(() => {
    const action = searchParams.get('action');
    const token = searchParams.get('token');

    if (action === 'reset' && token) {
      console.log('Reset mode triggered from URL params');
      setMode('reset-password-confirm');
      setRecoveryToken(token);
    }
  }, [searchParams]);

  const handleLogin = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Login failed');
      }

      // Sync identity cookies from response
      toast.success(`Welcome back, ${result.user?.db_name || 'User'}!`);

      // Update Global App Context
      if (result.user?.db_role) setUserRole(result.user.db_role);
      if (result.user?.db_name) setUserName(result.user.db_name);
      if (result.user?.db_dept) setUserDepartment(result.user.db_dept);

      const identityId = result.user?.db_user_id || result.user?.user_metadata?.employee_id || result.user?.id;
      if (identityId) setUserId(identityId);

      const role = result.user?.db_role || 'employee';
      const searchParams = new URLSearchParams(window.location.search);
      const customRedirect = searchParams.get('redirect');
      const redirect = customRedirect ? decodeURIComponent(customRedirect) : (role === 'admin' ? '/admin-panel' : role === 'hod' ? '/manager-dashboard' : '/employee-portal');

      setTimeout(() => router.push(redirect), 800);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      toast.error('Please enter your email address');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });
      if (!response.ok) {
        throw new Error('Failed to request password reset');
      }
      toast.success('Reset link sent!');
      setForgotPasswordSuccess(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newResetPassword !== confirmResetPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newResetPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: recoveryToken, newPassword: newResetPassword }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to change password');
      }
      toast.success('Password updated successfully! Please sign in.');
      setMode('login');
      setNewResetPassword('');
      setConfirmResetPassword('');
      setRecoveryToken('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reset failed');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex" style={{ background: 'rgb(15 15 20)' }}>
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgb(22 22 35) 0%, rgb(15 15 25) 100%)' }}>

        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-96 h-96 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgb(79 127 255), transparent)' }} />
          <div className="absolute bottom-20 right-20 w-64 h-64 rounded-full opacity-8"
            style={{ background: 'radial-gradient(circle, rgb(52 211 153), transparent)' }} />
          <div className="absolute top-1/2 left-1/2 w-80 h-80 rounded-full opacity-5"
            style={{ background: 'radial-gradient(circle, rgb(167 139 250), transparent)', transform: 'translate(-50%, -50%)' }} />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <AppLogo size={44} />
          <div>
            <span className="text-2xl font-bold tracking-tight" style={{ color: 'rgb(var(--text-primary))' }}>EzeemOps</span>
            <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>Internal Operations & HR System</p>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative space-y-8">
          <div>
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4" style={{ color: 'rgb(var(--text-primary))' }}>
              Your Operations<br />
              <span style={{ color: 'rgb(79 127 255)' }}>Command Center</span>
            </h1>
            <p className="text-lg leading-relaxed max-w-lg" style={{ color: 'rgb(140 140 170)' }}>
              Manage OKR performance, track KPI tasks, handle HR leave requests, and monitor team health — all in one place.
            </p>
          </div>

          {/* Feature List */}
          <div className="space-y-3">
            {[
              { icon: 'ChartBarIcon', label: 'OKR & KPI Weighted Scoring Engine', color: 'rgb(79 127 255)' },
              { icon: 'TableCellsIcon', label: 'Team Performance Heatmap', color: 'rgb(52 211 153)' },
              { icon: 'CalendarDaysIcon', label: 'Smart Leave Management with Feb Cleanse', color: 'rgb(251 191 36)' },
              { icon: 'ShieldExclamationIcon', label: 'Penalty Log with KPI Auto-Deduction', color: 'rgb(248 113 113)' },
            ].map(f => (
              <div key={`feat-${f.label}`} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${f.color}22` }}>
                  <Icon name={f.icon as never} size={16} style={{ color: f.color }} />
                </div>
                <span className="text-sm" style={{ color: 'rgb(180 180 210)' }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative">
          <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
            © {new Date().getFullYear()} Ezeem Sdn. Bhd. · Internal use only · v2.4.1
          </p>
        </div>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center gap-3 mb-6">
            <AppLogo size={36} />
            <span className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>EzeemOps</span>
          </div>


          {/* Login Form */}
          {mode === 'login' && (
            <div className="space-y-6">
              <div className="text-center mb-2">
                <h2 className="text-2xl font-bold text-white">Sign In</h2>
                <p className="text-sm text-gray-400 mt-1">Access your HR command center</p>
              </div>

              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Work Email <span style={{ color: 'rgb(248 113 113)' }}>*</span>
                  </label>
                  <input
                    type="email"
                    {...loginForm.register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+$/i, message: 'Enter a valid email address' } })}
                    className="input-base"
                    placeholder="yourname@ezeetechnosys.com.my"
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-xs mt-1" style={{ color: 'rgb(248 113 113)' }}>
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Password <span style={{ color: 'rgb(248 113 113)' }}>*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...loginForm.register('password', { required: 'Password is required', minLength: { value: 8, message: 'Password must be at least 8 characters' } })}
                      className="input-base pr-10"
                      placeholder="Enter your password"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: 'rgb(var(--text-muted))' }}>
                      <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-xs mt-1" style={{ color: 'rgb(248 113 113)' }}>
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...loginForm.register('rememberMe')} className="accent-blue-500" />
                    <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>Remember me</span>
                  </label>
                  <button type="button" onClick={() => setMode('forgot-password')} className="text-xs" style={{ color: 'rgb(79 127 255)' }}>
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-[0.99] flex items-center justify-center gap-2"
                  style={{
                    background: isLoading ? 'rgba(79,127,255,0.5)' : 'rgb(79 127 255)',
                    color: 'white',
                    opacity: isLoading ? 0.8 : 1,
                  }}>
                  {isLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Signing in...
                    </>
                  ) : 'Sign In to EzeemOps'}
                </button>
              </form>
              
              <div className="pt-4 text-center">
                <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                  Restricted access. Please contact HR if you don't have an account.
                </p>
              </div>
            </div>
          )}


          {/* Forgot Password Form */}
          {mode === 'forgot-password' && (
            forgotPasswordSuccess ? (
              <div className="text-center py-8 px-4 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ background: 'rgba(52,211,153,0.05)', border: '1px dashed rgba(52,211,153,0.3)' }}>
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Icon name="EnvelopeIcon" size={32} className="text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-white">Check Your Email</h3>
                <p className="text-sm leading-relaxed mb-8" style={{ color: 'rgb(var(--text-secondary))' }}>
                  If an account exists for that email, we&apos;ve sent password reset instructions.
                </p>
                <button onClick={() => { setForgotPasswordSuccess(false); setMode('login'); }}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all" style={{ background: 'rgb(79 127 255)', color: 'white' }}>
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4 animate-in fade-in">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">Reset Password</h3>
                  <p className="text-sm text-gray-400">Enter your email address and we&apos;ll send you instructions to reset your password.</p>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                    Work Email <span style={{ color: 'rgb(248 113 113)' }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={e => setForgotPasswordEmail(e.target.value)}
                    required
                    className="input-base"
                    placeholder="yourname@ezeetechnosys.com.my"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-[0.99] flex items-center justify-center gap-2"
                  style={{ background: isLoading ? 'rgba(79,127,255,0.5)' : 'rgb(79 127 255)', color: 'white' }}>
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <div className="text-center mt-4">
                  <button type="button" onClick={() => setMode('login')} className="text-xs text-gray-400 hover:text-white transition-colors">
                    Back to Login
                  </button>
                </div>
              </form>
            )
          )}

          {/* Reset Password Confirm Form */}
          {mode === 'reset-password-confirm' && (
            <form onSubmit={handleResetPasswordConfirm} className="space-y-4 animate-in fade-in">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">Set New Password</h3>
                <p className="text-sm text-gray-400">Please enter a new password for your account.</p>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                  New Password <span style={{ color: 'rgb(248 113 113)' }}>*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newResetPassword}
                    onChange={e => setNewResetPassword(e.target.value)}
                    required
                    minLength={8}
                    className="input-base pr-10"
                    placeholder="Min 8 characters"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'rgb(var(--text-muted))' }}>
                    <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgb(var(--text-secondary))' }}>
                  Confirm Password <span style={{ color: 'rgb(248 113 113)' }}>*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmResetPassword}
                    onChange={e => setConfirmResetPassword(e.target.value)}
                    required
                    minLength={8}
                    className="input-base pr-10"
                    placeholder="Re-type new password"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'rgb(var(--text-muted))' }}>
                    <Icon name={showConfirmPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-[0.99] flex items-center justify-center gap-2"
                style={{ background: isLoading ? 'rgba(79,127,255,0.5)' : 'rgb(79 127 255)', color: 'white' }}>
                {isLoading ? 'Updating...' : 'Update Password'}
              </button>
              <div className="text-center mt-4">
                <button type="button" onClick={() => setMode('login')} className="text-xs text-gray-400 hover:text-white transition-colors">
                  Cancel and Sign In
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}