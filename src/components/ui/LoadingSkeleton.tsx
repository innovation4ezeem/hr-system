import React from 'react';

export default function LoadingSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-6 animate-pulse" style={{ background: 'rgb(var(--bg-primary))' }}>
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="h-4 w-96 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }} />
        </div>
        <div className="h-10 w-32 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }} />
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="h-96 rounded-xl w-full" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }} />
      
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 rounded-lg w-full" style={{ background: 'rgba(255,255,255,0.01)' }} />
        ))}
      </div>
    </div>
  );
}
