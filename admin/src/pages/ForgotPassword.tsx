import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import api from '../lib/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', {
        email,
        redirectTo: `${window.location.origin}/reset-password`
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Unable to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md glass rounded-[2rem] p-8 border border-white/10 shadow-2xl">
        <div className="mb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-secondary-500">StandVault</p>
          <h1 className="text-3xl font-black mt-3">Forgot Password</h1>
          <p className="text-secondary-400 text-sm mt-2">Enter your email address and we will send you a reset link.</p>
        </div>

        {success ? (
          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-green-300 flex items-start gap-3">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Reset email sent</p>
              <p className="text-sm mt-1">Check your inbox for the password reset link.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black uppercase tracking-[0.24em] text-secondary-500">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 focus:border-primary-500/50 outline-none transition-all text-white"
                  placeholder="you@example.com"
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
              disabled={loading}
              className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-white rounded-2xl font-black text-lg transition-all"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <Link to="/login" className="inline-flex items-center gap-2 text-primary-400 font-bold hover:text-primary-300 mt-6">
          <ArrowLeft size={16} />
          Back to login
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
