import React, { useState } from 'react';
import { X, Plus, Calendar, CreditCard, AlertCircle } from 'lucide-react';
import api from '../lib/api';

interface AddFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyerId: string;
  buyerName: string;
  onSuccess: () => void;
}

const AddFeeModal: React.FC<AddFeeModalProps> = ({ isOpen, onClose, buyerId, buyerName, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post(`/buyers/${buyerId}/ledger/fees`, { // Keeping the endpoint path for compatibility or updating if needed
        amount: parseFloat(amount),
        description,
        effective_date: effectiveDate
      });
      
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
        setAmount('');
        setDescription('');
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to apply fee');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-950/80 backdrop-blur-sm animate-in fade-in" onClick={onClose}></div>
      
      <div className="glass w-full max-w-xl rounded-[2.5rem] border-white/10 shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
        {success ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center border-4 border-orange-500/20">
              <Plus size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Fee Applied!</h2>
              <p className="text-secondary-400 mt-2">The additional fee has been recorded successfully.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div>
                <h2 className="text-xl font-bold">Apply Fee</h2>
                <p className="text-xs text-secondary-400 mt-1">Record a one-off fee for {buyerName}</p>
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
                <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Amount ($)</label>
                <div className="relative group">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                  <input 
                    type="number" 
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-bold text-xl"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Description</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Connection Fee, Wall Extension, etc."
                  className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 px-6 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-medium"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Effective Date</label>
                <div className="relative group">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                  <input 
                    type="date" 
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-medium"
                    required
                  />
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
                className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-orange-600/30 flex items-center justify-center gap-3 mt-4"
              >
                {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (
                  <>
                    <Plus size={24} />
                    Apply Fee
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default AddFeeModal;
