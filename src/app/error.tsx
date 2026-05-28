'use client';
import { useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Root Error Boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'rgb(var(--bg-card))' }}>
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto border border-red-500/20">
          <Icon name="ExclamationTriangleIcon" size={40} className="text-red-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'rgb(var(--text-primary))' }}>
            Something went wrong
          </h1>
          <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
            The application encountered an unexpected error. We've been notified and are looking into it.
          </p>
        </div>

        {error.message && (
          <div className="p-4 rounded-xl text-left bg-black/20 border border-white/5 overflow-auto max-h-40">
            <p className="text-xs font-mono text-red-400 break-words">{error.message}</p>
            {error.digest && <p className="text-[10px] font-mono text-slate-500 mt-2">Digest: {error.digest}</p>}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => window.location.assign(process.env.NEXT_PUBLIC_BASE_PATH || '/')}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-all"
          >
            Back to Login
          </button>
          <button
            onClick={() => reset()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
