import React, { Suspense } from 'react';
import LoginClient from './auth-components/LoginClient';

export default function RootLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f14] flex items-center justify-center text-white">Loading...</div>}>
      <LoginClient />
    </Suspense>
  );
}
