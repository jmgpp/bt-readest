'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import Providers from './Providers';

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const [mounted, setMounted] = useState(false);

  // Only show the emergency button after client mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Providers>
      {children}
      
      {/* Emergency library access button - only visible on client */}
      {mounted && (
        <div 
          className="fixed bottom-4 right-4 z-50 opacity-40 hover:opacity-100" 
          title="Emergency Library Access"
        >
          <button 
            onClick={() => {
              localStorage.setItem('emergency_access', 'true');
              window.location.href = '/library';
            }} 
            className="btn btn-circle btn-sm btn-error flex items-center justify-center shadow-lg"
          >
            <span className="text-xl">⚡</span>
          </button>
        </div>
      )}
    </Providers>
  );
} 