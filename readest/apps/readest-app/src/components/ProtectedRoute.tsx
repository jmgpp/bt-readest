'use client';

import { useEffect, ReactNode, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
  authRequired?: boolean;
}

/**
 * Component that controls access to routes based on authentication state
 * - authRequired=true: redirect to /auth if user is not authenticated
 * - authRequired=false: redirect to /library if user is already authenticated
 */
export default function ProtectedRoute({
  children,
  redirectTo = '/auth',
  authRequired = true,
}: ProtectedRouteProps) {
  // Use state that's only initialized on the client to avoid hydration mismatches
  const [isClient, setIsClient] = useState(false);
  const { user, token, isLoading } = useAuth();
  const isAuthenticated = !!user && !!token;
  const [mounted, setMounted] = useState(false);
  const hasRedirected = useRef(false);
  const authChecked = useRef(false);

  // Mark as client-rendered immediately after first render
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Emergency access check - only runs on client
  const checkEmergencyAccess = () => {
    if (!isClient) return false;
    try {
      return localStorage.getItem('emergency_access') === 'true';
    } catch (e) {
      return false;
    }
  };

  // Debug logging - only on client
  useEffect(() => {
    if (!isClient) return;
    
    try {
      const emergencyAccess = checkEmergencyAccess();
      console.log('ProtectedRoute:', {
        path: window.location.pathname,
        isLoading,
        isAuthenticated,
        authRequired,
        mounted,
        hasRedirected: hasRedirected.current,
        authChecked: authChecked.current,
        emergencyAccess
      });
    } catch (e) {
      console.error('Error in debug logging:', e);
    }
  }, [isLoading, isAuthenticated, authRequired, mounted, isClient]);

  // Auth check effect - only on client
  useEffect(() => {
    if (!isClient) return;
    
    // Skip if auth is still loading or already redirected
    if (authChecked.current || isLoading || hasRedirected.current) return;
    
    // Set a longer timeout to ensure auth has fully processed
    const timeoutId = setTimeout(() => {
      setMounted(true);
      
      try {
        // Check for emergency access mode - bypass all auth checks
        if (checkEmergencyAccess()) {
          console.log('ProtectedRoute: Emergency access mode detected, bypassing auth checks');
          // If trying to access auth page in emergency mode, redirect to library
          if (window.location.pathname.includes('/auth')) {
            window.location.replace('/library');
          }
          authChecked.current = true;
          return;
        }
        
        // Never redirect during these conditions
        const isAuthPage = window.location.pathname === '/auth';
        const isCallbackPage = window.location.pathname.includes('/callback');
        const hasAuthTokens = window.location.hash.includes('access_token');
        const hasCodeParam = new URLSearchParams(window.location.search).has('code');
        
        // Skip all redirects in special cases
        if (isAuthPage || isCallbackPage || hasAuthTokens || hasCodeParam) {
          console.log('ProtectedRoute: Special case detected, skipping redirects');
          authChecked.current = true;
          return;
        }
        
        // Don't redirect if we have auth cookies but context isn't updated yet
        const hasCookie = document.cookie.includes('sb-');
        
        // Handle authorization redirects
        if (authRequired && !isAuthenticated && !hasCookie) {
          console.log('ProtectedRoute: Not authenticated, redirecting to auth');
          hasRedirected.current = true;
          
          const currentPath = window.location.pathname;
          const returnPath = currentPath !== '/auth' ? currentPath : '/library';
          
          window.location.replace(`${redirectTo}?returnTo=${encodeURIComponent(returnPath)}`);
          return;
        }
        
        // Handle redirects for non-auth pages
        if (!authRequired && isAuthenticated) {
          console.log('ProtectedRoute: Already authenticated, redirecting to library');
          hasRedirected.current = true;
          window.location.replace('/library');
          return;
        }
        
        // Mark as checked if we didn't redirect
        authChecked.current = true;
      } catch (e) {
        console.error('Error in auth check:', e);
        // Fail open - show content rather than getting stuck
        authChecked.current = true;
      }
    }, 800);
    
    return () => clearTimeout(timeoutId);
  }, [authRequired, isAuthenticated, redirectTo, isLoading, isClient]);

  // On the server or during initial client render, just render children
  // This prevents hydration mismatches
  if (!isClient) {
    return <>{children}</>;
  }

  // Show loading state if auth is still loading and we're not on auth/callback pages
  if (isClient && isLoading && !mounted) {
    // Skip showing loading state if in emergency access mode
    if (checkEmergencyAccess()) {
      return <>{children}</>;
    }
    
    try {
      const path = window.location.pathname;
      // Skip loading indicator on auth pages to avoid flicker
      if (!path.includes('/auth') && !path.includes('/callback')) {
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <span className="loading loading-infinity loading-xl w-20"></span>
          </div>
        );
      }
    } catch (e) {
      console.error('Error checking path:', e);
    }
  }

  // Always render children on client
  return <>{children}</>;
} 