import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, KeyRound, Eye, EyeOff } from 'lucide-react';
import api from '../lib/api';

interface SetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyer: any;
  onSuccess: () => void;
}

const SetPasswordModal: React.FC<SetPasswordModalProps> = ({ isOpen, onClose, buyer, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post(`/buyers/${buyer.id || buyer.buyer_id}/password`, {
        password
      });
      
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
        setPassword('');
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-950/80 backdrop-blur-sm animate-in fade-in" onClick={onClose}></div>
      
      <div className="glass w-full max-w-md rounded-[2.5rem] border-white/10 shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
        {success ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center border-4 border-green-500/20">
              <CheckCircle2 size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Password Set!</h2>
              <p className="text-secondary-400 mt-2">The new password has been applied to this purchaser's account.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div>
                <h2 className="text-xl font-bold">Set Custom Password</h2>
                <p className="text-xs text-secondary-400 mt-1">Assign a manual login password for this account</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors text-secondary-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">New Password</label>
                <div className="relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter at least 6 characters"
                    className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-12 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-bold"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-primary-600/30 flex items-center justify-center gap-3 mt-4"
              >
                {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (
                  <>
                    <KeyRound size={24} />
                    Update Password
                  </>
                )}
              </button>
              
              <p className="text-[10px] text-center text-secondary-500 uppercase font-black tracking-widest leading-relaxed">
                Changes will take effect immediately. <br/> The purchaser can log in with this password right away.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default SetPasswordModal;
