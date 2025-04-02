'use client';
import { useEffect, useState, useRef } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

import { supabase } from '@/utils/supabase';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';

// Keep WEB_AUTH_CALLBACK constant for backward compatibility
import { READEST_WEB_BASE_URL } from '@/services/constants';

// Absolute URL is REQUIRED for Supabase Auth
const getRedirectUrl = () => {
  // In browser environments, use the current origin
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  // Fall back to env variable on server
  return `${READEST_WEB_BASE_URL}/auth/callback`;
};

export default function AuthPage() {
  const { t: _ } = useTranslation();
  const { isDarkMode } = useThemeStore();
  const { user, login } = useAuth();
  const [returnTo, setReturnTo] = useState<string>('/library');
  const [mounted, setMounted] = useState(false);
  const hasRedirected = useRef(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugEmail, setDebugEmail] = useState('');
  const [debugPassword, setDebugPassword] = useState('');

  // Add a function for emergency access
  const handleEmergencyAccess = () => {
    console.log('Using emergency access bypass');
    // Set a flag to indicate we're using emergency access
    localStorage.setItem('emergency_access', 'true');
    // Force redirect to library
    window.location.replace('/library');
  };

  // Handle successful authentication directly
  const handleAuthSuccess = async (session: any) => {
    console.log('Auth success detected, handling manually');
    if (session?.access_token && session?.user) {
      // Update auth context
      login(session.access_token, session.user);
      
      // Get the return URL
      let next = returnTo || '/library';
      if (next === '/auth') next = '/library';
      
      console.log('Login successful, redirecting to:', next);
      // Wait a moment to ensure state is updated
      setTimeout(() => {
        window.location.replace(next);
      }, 500);
    }
  };

  // Get return URL from query parameters if available
  useEffect(() => {
    if (hasRedirected.current) return;

    const timer = setTimeout(() => {
      setMounted(true);
      
      if (typeof window !== 'undefined') {
        // Parse returnTo from URL
        const urlParams = new URLSearchParams(window.location.search);
        const returnParam = urlParams.get('returnTo');
        if (returnParam && returnParam !== '/auth') {
          setReturnTo(returnParam);
        }
        
        // Check for error parameters
        const errorParam = urlParams.get('error');
        if (errorParam) {
          console.error('Auth error detected:', errorParam);
          // Auto-show debug options on error
          setShowDebug(true);
        }
        
        // Load debug credentials if they exist
        const savedEmail = localStorage.getItem('debug_email');
        if (savedEmail) {
          setDebugEmail(savedEmail);
        }
        
        // Display all cookies for debugging
        console.log('All cookies:', document.cookie);
        // Check for Supabase cookies specifically
        const hasSbCookie = document.cookie.split(';').some(cookie => cookie.trim().startsWith('sb-'));
        console.log('Has Supabase cookies:', hasSbCookie);
        
        // Set up auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          console.log('Auth state changed:', event);
          if (event === 'SIGNED_IN' && session) {
            handleAuthSuccess(session);
          }
        });
        
        return () => {
          subscription.unsubscribe();
        };
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  // Get the absolute redirect URL - critical for Supabase Auth
  const redirectUrl = getRedirectUrl();

  console.log('Auth redirect URL:', redirectUrl);
  console.log('Return to path:', returnTo);

  const handleDebugLogin = async () => {
    if (!debugEmail || !debugPassword) {
      return;
    }
    
    // Save for future emergency login
    localStorage.setItem('debug_email', debugEmail);
    localStorage.setItem('debug_password', debugPassword);
    
    // Try login
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: debugEmail,
        password: debugPassword
      });
      
      if (error) {
        console.error('Debug login error:', error);
        return;
      }
      
      if (data?.session) {
        console.log('Debug login successful, redirecting to library');
        // Use the same handler as the normal login flow
        handleAuthSuccess(data.session);
      }
    } catch (error) {
      console.error('Debug login error:', error);
    }
  };

  const handleSaveCredentials = () => {
    if (!debugEmail) return;
    localStorage.setItem('debug_email', debugEmail);
    if (debugPassword) {
      localStorage.setItem('debug_password', debugPassword);
    }
    alert('Debug credentials saved');
  };

  // Setup localization for auth UI
  const localization = {
    variables: {
      sign_in: {
        email_label: _('Email address'),
        password_label: _('Your Password'),
        email_input_placeholder: _('Your email address'),
        password_input_placeholder: _('Your password'),
        button_label: _('Sign in'),
        loading_button_label: _('Signing in...'),
        social_provider_text: _('Sign in with {{provider}}'),
        link_text: _('Already have an account? Sign in'),
      },
      sign_up: {
        email_label: _('Email address'),
        password_label: _('Create a Password'),
        email_input_placeholder: _('Your email address'),
        password_input_placeholder: _('Your password'),
        button_label: _('Sign up'),
        loading_button_label: _('Signing up...'),
        social_provider_text: _('Sign in with {{provider}}'),
        link_text: _('Don\'t have an account? Sign up'),
        confirmation_text: _('Check your email for the confirmation link'),
      },
      forgotten_password: {
        email_label: _('Email address'),
        password_label: _('Your Password'),
        email_input_placeholder: _('Your email address'),
        button_label: _('Send reset password instructions'),
        loading_button_label: _('Sending reset instructions...'),
        link_text: _('Forgot your password?'),
        confirmation_text: _('Check your email for the password reset link'),
      },
    },
  };

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md bg-base-100 rounded-lg shadow-lg p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">BookTalk</h1>
            <p className="text-sm opacity-70">{_('Sign in to your account')}</p>
            {/* Display any error messages */}
            {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('error') && (
              <div className="alert alert-error mt-4">
                <p>Login error: {new URLSearchParams(window.location.search).get('error')}</p>
                <button 
                  onClick={handleEmergencyAccess}
                  className="btn btn-sm btn-ghost mt-2"
                >
                  Emergency Library Access
                </button>
              </div>
            )}
          </div>

          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#0070f3',
                    brandAccent: '#0061d5',
                  },
                },
              },
            }}
            theme={isDarkMode ? 'dark' : 'light'}
            providers={[]}
            redirectTo={redirectUrl}
            localization={localization}
            queryParams={{
              next: returnTo,
            }}
            showLinks={true}
            onlyThirdPartyProviders={false}
          />
          
          {/* Debug login section - hidden by default */}
          <div className="mt-8 text-center">
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className="text-xs opacity-30 hover:opacity-100"
            >
              {showDebug ? 'Hide Debug Options' : 'Debug Options'}
            </button>
            
            {showDebug && (
              <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="text-sm font-bold mb-2">Debug Login</h3>
                <div className="space-y-2">
                  <input
                    type="email"
                    placeholder="Email for emergency login"
                    className="input input-sm input-bordered w-full"
                    value={debugEmail}
                    onChange={(e) => setDebugEmail(e.target.value)}
                  />
                  <input
                    type="password"
                    placeholder="Password for emergency login"
                    className="input input-sm input-bordered w-full"
                    value={debugPassword}
                    onChange={(e) => setDebugPassword(e.target.value)}
                  />
                  <div className="flex space-x-2 justify-center">
                    <button 
                      onClick={handleSaveCredentials}
                      className="btn btn-sm btn-outline"
                      disabled={!debugEmail}
                    >
                      Save Credentials
                    </button>
                    <button 
                      onClick={handleDebugLogin}
                      className="btn btn-sm btn-primary"
                      disabled={!debugEmail || !debugPassword}
                    >
                      Login
                    </button>
                  </div>
                  <div className="mt-2">
                    <button 
                      onClick={handleEmergencyAccess}
                      className="btn btn-sm btn-error"
                    >
                      Emergency Library Access
                    </button>
                    <p className="text-xs mt-1 opacity-70">Bypass login completely</p>
                  </div>
                  
                  <div className="mt-4 text-xs opacity-70">
                    <p>If login succeeds but fails to redirect:</p>
                    <button 
                      onClick={() => window.location.replace('/library')}
                      className="btn btn-xs mt-1"
                    >
                      Go to Library
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
