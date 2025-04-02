'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase';

// Simple standalone auth callback handler that doesn't depend on router
export default function AuthCallback() {
  const { login } = useAuth();
  const isProcessing = useRef(false);
  const [processingStatus, setProcessingStatus] = useState<string>('initializing');
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [showDebug, setShowDebug] = useState(false);
  
  useEffect(() => {
    async function handleAuthRedirect() {
      // Only run once
      if (isProcessing.current || typeof window === 'undefined') return;
      isProcessing.current = true;
      
      setProcessingStatus('Started processing auth callback');
      console.log('Processing auth callback...');
      console.log('URL:', window.location.href);
      
      // Display all cookies for debugging
      console.log('All cookies:', document.cookie);
      // Check for Supabase cookies specifically
      const hasSbCookie = document.cookie.split(';').some(cookie => cookie.trim().startsWith('sb-'));
      console.log('Has Supabase cookies:', hasSbCookie);
      
      // Store debug info
      setDebugInfo({
        url: window.location.href,
        cookies: document.cookie,
        hasSbCookie,
        timestamp: new Date().toISOString()
      });
      
      // Manual login for debug purposes
      const forceLogin = async () => {
        try {
          setProcessingStatus('Attempting debug login');
          console.log('Using direct login to bypass authentication flow issues');
          // Force login with direct email/password
          const email = localStorage.getItem('debug_email');
          const password = localStorage.getItem('debug_password');
          
          if (email && password) {
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password
            });
            
            if (error) {
              console.error('Debug login error:', error);
              setProcessingStatus('Debug login failed: ' + error.message);
              return false;
            }
            
            if (data?.session) {
              console.log('Debug login successful');
              setProcessingStatus('Debug login successful');
              login(data.session.access_token, data.session.user);
              return true;
            }
          }
          return false;
        } catch (error) {
          console.error('Debug login error:', error);
          setProcessingStatus('Debug login error: ' + (error as Error).message);
          return false;
        }
      };
      
      // Try getting the Supabase session directly first
      try {
        setProcessingStatus('Checking for existing session');
        console.log('Checking for existing session...');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
          setProcessingStatus('Error getting session: ' + sessionError.message);
        }
        
        if (sessionData?.session) {
          console.log('Session found! User is authenticated');
          console.log('User:', sessionData.session.user.email);
          setProcessingStatus('Session found! User: ' + sessionData.session.user.email);
          
          // Get next URL from query params
          const urlParams = new URLSearchParams(window.location.search);
          let next = urlParams.get('next') || '/library';
          if (next === '/auth') next = '/library';
          
          // Call login to update the auth context
          login(sessionData.session.access_token, sessionData.session.user);
          
          // Redirect to next page
          console.log('Redirecting to:', next);
          setProcessingStatus('Redirecting to: ' + next);
          setTimeout(() => {
            window.location.replace(next);
          }, 2000);
          return;
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setProcessingStatus('Error checking session: ' + (error as Error).message);
      }
      
      // If no session found, try to parse from URL
      console.log('No session found, checking URL parameters');
      setProcessingStatus('No session found, checking URL parameters');
      
      // Check different places where tokens might be
      const hashFragment = window.location.hash;
      console.log('Hash fragment present:', !!hashFragment);
      
      // Try to get tokens from hash fragment
      const hash = hashFragment.substring(1);
      const params = new URLSearchParams(hash);
      
      // Try to get tokens from URL query if not in hash
      const urlParams = new URLSearchParams(window.location.search);
      
      const accessToken = params.get('access_token') || urlParams.get('access_token');
      const refreshToken = params.get('refresh_token') || urlParams.get('refresh_token');
      const type = params.get('type') || urlParams.get('type');
      
      // Default to library if next is not specified or is /auth
      let next = params.get('next') || urlParams.get('next') || '/library';
      if (next === '/auth') next = '/library';
      
      console.log('Access token present:', !!accessToken);
      console.log('Refresh token present:', !!refreshToken);
      console.log('Auth type:', type);
      console.log('Next URL:', next);
      
      setDebugInfo(prev => ({
        ...prev,
        tokens: {
          accessToken: !!accessToken,
          refreshToken: !!refreshToken,
          type,
          next
        }
      }));

      try {
        // Handle case where we have no tokens but we might already be logged in
        if (!accessToken || !refreshToken) {
          setProcessingStatus('No tokens in URL, trying code exchange');
          console.log('No tokens in URL, trying to use exchangeCodeForSession...');
          
          // Try using code exchange if there's a code parameter
          const code = urlParams.get('code');
          if (code) {
            setProcessingStatus('Found code parameter, exchanging for session');
            console.log('Found code parameter, exchanging for session');
            try {
              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              if (error) {
                console.error('Error exchanging code for session:', error);
                setProcessingStatus('Error exchanging code: ' + error.message);
                
                // Try debug login as fallback
                if (await forceLogin()) {
                  window.location.replace('/library');
                  return;
                }
                
                setTimeout(() => {
                  window.location.replace('/auth?error=code_exchange_failed');
                }, 500);
                return;
              }
              
              if (data?.session) {
                console.log('Successfully exchanged code for session');
                setProcessingStatus('Successfully exchanged code for session');
                // Call login to update the auth context
                login(data.session.access_token, data.session.user);
                
                // Redirect to next page
                console.log('Redirecting to:', next);
                setProcessingStatus('Code exchange successful, redirecting to: ' + next);
                setTimeout(() => {
                  window.location.replace(next);
                }, 2000);
                return;
              }
            } catch (error) {
              console.error('Error during code exchange:', error);
              setProcessingStatus('Error during code exchange: ' + (error as Error).message);
            }
          }
          
          // Try debug login as fallback
          if (await forceLogin()) {
            window.location.replace('/library');
            return;
          }
          
          // Check if we already have a session
          setProcessingStatus('No code parameter, checking for session again');
          console.log('No code parameter, checking for existing session again');
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData?.session) {
            console.log('Session found on second check');
            setProcessingStatus('Session found on second check');
            login(sessionData.session.access_token, sessionData.session.user);
            setTimeout(() => {
              window.location.replace(next);
            }, 500);
            return;
          }
          
          console.error('All authentication methods failed');
          setProcessingStatus('All authentication methods failed');
          setTimeout(() => {
            window.location.replace('/auth?error=authentication_failed');
          }, 500);
          return;
        }

        console.log('Setting session with tokens...');
        setProcessingStatus('Setting session with tokens');
        // Force session update
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Error setting session:', error);
          setProcessingStatus('Error setting session: ' + error.message);
          
          // Try debug login as fallback
          if (await forceLogin()) {
            window.location.replace('/library');
            return;
          }
          
          setTimeout(() => {
            window.location.replace('/auth?error=session_error');
          }, 500);
          return;
        }

        // Now get the user
        console.log('Getting user data...');
        setProcessingStatus('Getting user data');
        const { data, error: userError } = await supabase.auth.getUser();
        
        if (userError || !data?.user) {
          console.error('Error getting user:', userError);
          setProcessingStatus('Error getting user: ' + (userError?.message || 'User data not found'));
          
          // Try debug login as fallback
          if (await forceLogin()) {
            window.location.replace('/library');
            return;
          }
          
          setTimeout(() => {
            window.location.replace('/auth?error=user_error');
          }, 500);
          return;
        }
        
        // Call login to update the auth context
        console.log('User authenticated, updating context:', data.user.email);
        setProcessingStatus('User authenticated: ' + data.user.email);
        login(accessToken, data.user);
            
        // Give time for login state to be set
        console.log('Waiting to redirect to:', next);
        setProcessingStatus('Waiting to redirect to: ' + next);
        // Use a longer timeout to ensure the auth state is properly updated
        setTimeout(() => {
          console.log('Now redirecting to:', next);
          // Use window.location.replace instead of href to prevent back button issues
          window.location.replace(next);
        }, 2000);
      } catch (error) {
        console.error('Auth callback error:', error);
        setProcessingStatus('Auth callback error: ' + (error as Error).message);
        
        // Try debug login as last resort
        if (await forceLogin()) {
          window.location.replace('/library');
          return;
        }
        
        setTimeout(() => {
          window.location.replace('/auth?error=unexpected_error');
        }, 500);
      }
    }

    handleAuthRedirect();
  }, [login]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4">
      <span className="loading loading-infinity loading-xl w-20 mb-4"></span>
      <p className="text-sm opacity-70">{processingStatus}</p>
      <div className="mt-6 flex flex-col items-center space-y-3">
        <button 
          onClick={() => {
            localStorage.setItem('emergency_access', 'true');
            window.location.replace('/library');
          }}
          className="btn btn-primary"
        >
          Emergency Library Access
        </button>
        <p className="text-xs opacity-50">
          If you're stuck at this screen, use the button above to bypass authentication completely
        </p>
        <div className="flex gap-2">
          <button 
            onClick={() => window.location.replace('/library')} 
            className="btn btn-sm btn-outline"
          >
            Go to Library
          </button>
          <button 
            onClick={() => {
              // Force a refresh without cache
              localStorage.setItem('force_refresh', 'true');
              window.location.href = `/library?t=${Date.now()}`;
            }}
            className="btn btn-sm btn-ghost"
          >
            Hard Refresh
          </button>
        </div>
        
        <div className="mt-4">
          <button 
            onClick={() => setShowDebug(!showDebug)} 
            className="btn btn-xs btn-ghost opacity-50 hover:opacity-100"
          >
            {showDebug ? 'Hide' : 'Show'} Debug Info
          </button>
          
          {showDebug && (
            <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg text-left text-xs max-w-lg max-h-80 overflow-auto">
              <h3 className="font-bold mb-2">Debug Information</h3>
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
