import React, { useState } from 'react';
import {
  Hotel,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  LogIn,
  CheckCircle2,
} from 'lucide-react';
import { signInWithEmail } from '../../../lib/supabase/auth-helper';

interface LoginPageProps {
  onSuccess: (user: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Sign In only - Public sign up is disabled. New accounts are invited by Owner/Manager.
      const { user, error: authError } = await signInWithEmail(email, password);
      if (authError) {
        const msg = authError.message || 'Failed to authenticate';
        setError(msg);
      } else if (user) {
        onSuccess(user);
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during authentication');
    } finally {
      setLoading(false);
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
          Property Management System • Staff Sign In
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-slate-900 border border-slate-800 py-7 px-6 shadow-2xl rounded-2xl sm:px-8">
          
          {/* Sign In Header Notice */}
          <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800 mb-5 text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <LogIn className="w-4 h-4 text-indigo-400" />
              <span>Staff Sign In</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Authorized Personnel Only</span>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleAuthSubmit}>
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            <div>
              <label htmlFor="input-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="input-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@villainlet.com"
                  className="block w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="input-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              id="btn-submit-auth"
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-xs"
            >
              {loading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <span>Sign In to Villa Inlet</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Invitation-Only Security Footnote */}
          <div className="mt-4 pt-3 text-center border-t border-slate-800/60">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              New team members are invited by the Property Owner or Manager. Check your email for an activation link.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
