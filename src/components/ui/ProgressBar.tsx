'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // When path or search params change, it means navigation completed
    setLoading(false);
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      
      if (anchor && anchor.href && anchor.href.startsWith(window.location.origin) && anchor.target !== '_blank') {
        const url = new URL(anchor.href);
        if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
          startLoading();
        }
      }
    };

    window.addEventListener('click', handleAnchorClick);
    return () => window.removeEventListener('click', handleAnchorClick);
  }, []);

  const startLoading = () => {
    setLoading(true);
    setProgress(10);
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + (90 - prev) * 0.1;
      });
    }, 200);
  };

  if (!loading) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-[9999] h-1 pointer-events-none overflow-hidden"
      style={{ background: 'rgba(59, 130, 246, 0.1)' }}
    >
      <div 
        className="h-full bg-blue-500 shadow-[0_0_10px_rgb(59,130,246)] transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
