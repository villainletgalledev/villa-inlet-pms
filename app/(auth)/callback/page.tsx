import React, { useState, useEffect } from 'react';
import { Hotel, Lock, KeyRound, CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';

interface AuthCallbackPageProps {
  onSuccess: (user: any) => void;
  onNavigateToLogin: () => void;
}

export const AuthCallbackPage: React.FC<AuthCallbackPageProps> = ({
  onSuccess,
  onNavigateToLogin,
}) => {
  const [status, setStatus] = useState<'processing' | 'set_password' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function handleAuthCallback() {
      try {
        if (typeof window === 'undefined') return;

        const hash = window.location.hash ? window.location.hash.substring(1) : '';
        const hashParams = new URLSearchParams(hash);
        const queryParams = new URLSearchParams(window.location.search);

        // 1. Check for errors returned in hash or query parameters
        const urlError =
          hashParams.get('error_description') ||
          queryParams.get('error_description') ||
          hashParams.get('error') ||
          queryParams.get('error');

        if (urlError) {
          if (!isMounted) return;
          setErrorMessage(decodeURIComponent(urlError.replace(/\+/g, ' ')));
          setStatus('error');
          return;
        }

        // 2. PKCE code exchange (?code=...)
        const code = queryParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (!isMounted) return;
            setErrorMessage(error.message);
            setStatus('error');
            return;
          }
          if (data?.user) {
            if (!isMounted) return;
            setAuthUser(data.user);
            setStatus('set_password');
            return;
          }
        }

        // 3. Hash fragment tokens (#access_token=...&refresh_token=...)
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            if (!isMounted) return;
            setErrorMessage(error.message);
            setStatus('error');
            return;
          }

          if (data?.user) {
            if (!isMounted) return;
            setAuthUser(data.user);
            setStatus('set_password');
            return;
          }
        }

        // 4. Check active Supabase session (detectSessionInUrl might have auto-resolved it)
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          if (!isMounted) return;
          setErrorMessage(error.message);
          setStatus('error');
          return;
        }

        if (data?.session?.user) {
          if (!isMounted) return;
          setAuthUser(data.session.user);
          setStatus('set_password');
          return;
        }

        // If no active session or tokens found, reject
        if (!isMounted) return;
        setErrorMessage('No authentication token or invitation session was found in this link.');
        setStatus('error');
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMessage(err?.message || 'An unexpected error occurred while verifying the invitation link.');
        setStatus('error');
      }
    }

    handleAuthCallback();

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please verify and try again.');
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setFormError(error.message || 'Failed to set password in Supabase.');
        setSubmitting(false);
        return;
      }

      const user = data.user || authUser;
      setStatus('success');
      setTimeout(() => {
        onSuccess(user);
      }, 1200);
    } catch (err: any) {
      setFormError(err?.message || 'An unexpected error occurred updating password.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Hotel className="w-7 h-7" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-white">
          Villa Inlet PMS
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Staff Onboarding & Security Verification
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-slate-900 border border-slate-800 py-7 px-6 shadow-2xl rounded-2xl sm:px-8">
          {/* 1. PROCESSING STATE */}
          {status === 'processing' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <div>
                <h3 className="text-sm font-semibold text-white">Verifying Invitation Link</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Connecting to Supabase Authentication and preparing your session...
                </p>
              </div>
            </div>
          )}

          {/* 2. ERROR STATE */}
          {status === 'error' && (
            <div className="py-4 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-white">Invitation Verification Failed</h3>
                <p className="text-xs text-rose-300/90 mt-2 leading-relaxed bg-rose-950/40 p-3 rounded-lg border border-rose-900/50">
                  {errorMessage || 'The invitation link is expired, invalid, or has already been used.'}
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  id="btn-return-login-error"
                  onClick={onNavigateToLogin}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <span>Return to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 3. SET PASSWORD SCREEN */}
          {status === 'set_password' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto mb-2.5">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Set Your Account Password</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Welcome to Villa Inlet PMS! Please create a secure password to complete your staff account setup.
                </p>
              </div>

              {/* User badge */}
              {authUser && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {authUser.user_metadata?.full_name || 'Team Member'}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{authUser.email}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 uppercase">
                    {authUser.user_metadata?.role || 'STAFF'}
                  </span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {formError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="input-new-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="input-new-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="block w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="input-confirm-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="input-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      className="block w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  id="btn-submit-set-password"
                  type="submit"
                  disabled={submitting}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {submitting ? (
                    <span>Saving Password...</span>
                  ) : (
                    <>
                      <span>Save Password & Enter Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* 4. SUCCESS STATE */}
          {status === 'success' && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Account Password Configured!</h3>
              <p className="text-xs text-slate-400">
                Redirecting you to the Villa Inlet PMS dashboard...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallbackPage;
