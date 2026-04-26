import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const SetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSessionReady(Boolean(data.session));
    };

    syncSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      if (!mounted) return;
      setSessionReady(Boolean(session));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Unable to set password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md glass rounded-[2rem] p-8 border border-white/10 shadow-2xl">
        <div className="mb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-secondary-500">StandVault</p>
          <h1 className="text-3xl font-black mt-3">Set Portal Password</h1>
          <p className="text-secondary-400 text-sm mt-2">Create a password to activate your purchaser portal account.</p>
        </div>

        {success ? (
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-green-300 flex items-start gap-3">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Password set successfully</p>
                <p className="text-sm mt-1">Your portal account is ready. You can sign in with your email and new password.</p>
              </div>
            </div>
            <Link
              to="/login"
              className="w-full flex items-center justify-center gap-3 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-lg transition-all"
            >
              Go to Login
              <ArrowRight size={20} />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {!sessionReady && (
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-orange-200 text-sm">
                Open this page from the Supabase invitation email so the account session can be verified automatically.
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black uppercase tracking-[0.24em] text-secondary-500">New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 focus:border-primary-500/50 outline-none transition-all text-white"
                  placeholder="Minimum 8 characters"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black uppercase tracking-[0.24em] text-secondary-500">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 focus:border-primary-500/50 outline-none transition-all text-white"
                  placeholder="Repeat your password"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 flex items-start gap-3">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !sessionReady}
              className="w-full flex items-center justify-center gap-3 py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-white rounded-2xl font-black text-lg transition-all"
            >
              {loading ? 'Saving...' : 'Activate Portal Access'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SetPassword;
