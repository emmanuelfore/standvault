import React, { useState } from 'react';
import { X, DollarSign, Calendar, FileText, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyerId: string;
  buyerName: string;
  onSuccess: () => void;
}

import { supabase } from '../lib/supabase';

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, buyerId, buyerName, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('Manual Payment Recording');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [allocationType, setAllocationType] = useState('STAND');
  const [allocationTargetId, setAllocationTargetId] = useState('');
  const [outstandingFees, setOutstandingFees] = useState<any[]>([]);

  React.useEffect(() => {
    if (isOpen && buyerId) {
      api.get(`/buyers/${buyerId}/ledger`).then(res => {
         // Simplified: Any FEE or PENALTY is considered outstanding for this UI
         const fees = res.data.filter((e: any) => e.entry_type === 'FEE' || e.entry_type === 'PENALTY');
         setOutstandingFees(fees);
      });
    }
  }, [isOpen, buyerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Please enter a valid positive amount');
      setLoading(false);
      return;
    }

    if (allocationType === 'FEE' && !allocationTargetId) {
      setError('Please select a specific fee account for this allocation');
      setLoading(false);
      return;
    }


    try {
      let fileUrl: string | undefined;

      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `pops/${buyerId}/${Math.random()}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError } = await supabase.storage
          .from('vault')
          .upload(filePath, proofFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('vault')
          .getPublicUrl(filePath);
        
        fileUrl = publicUrl;
      }

      await api.post(`/buyers/${buyerId}/ledger/payments`, {
        amount: Number(amount),
        description,
        effective_date: new Date(date).toISOString(),
        allocation_type: allocationType,
        allocation_target_id: allocationType === 'FEE' ? allocationTargetId : undefined,
        ...(fileUrl ? { file_url: fileUrl } : {})
      });
      
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
        setAmount('');
        setProofFile(null);
      }, 2000);
    } catch (err: any) {
      console.error('Payment recording failed:', err);
      const apiError = err.response?.data?.error;
      const apiMessage = err.response?.data?.message;
      setError(apiError || apiMessage || 'An unexpected error occurred while recording payment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-950/80 backdrop-blur-sm animate-in fade-in transition-opacity" onClick={onClose}></div>
      
      <div className="glass w-full max-w-lg rounded-[2.5rem] border-white/10 shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
        {success ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center border-4 border-green-500/20">
              <CheckCircle2 size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Payment Recorded!</h2>
              <p className="text-secondary-400 mt-2">The buyer's ledger has been updated immediately.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div>
                <h2 className="text-xl font-bold">Record Payment</h2>
                <p className="text-xs text-secondary-400 mt-1">Recording for <span className="text-white font-bold">{buyerName}</span></p>
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
                <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Payment Amount ($)</label>
                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
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

              <div className="flex flex-col gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Allocate Payment To</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setAllocationType('STAND')}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all border",
                      allocationType === 'STAND' 
                        ? "bg-primary-600 text-white border-primary-500 shadow-lg shadow-primary-600/20" 
                        : "bg-secondary-950 text-secondary-400 border-white/10 hover:border-white/20"
                    )}
                  >
                    Property Instalment
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocationType('FEE')}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all border",
                      allocationType === 'FEE' 
                        ? "bg-primary-600 text-white border-primary-500 shadow-lg shadow-primary-600/20" 
                        : "bg-secondary-950 text-secondary-400 border-white/10 hover:border-white/20"
                    )}
                  >
                    Specific Fee
                  </button>
                </div>

                {allocationType === 'FEE' && (
                  <div className="flex flex-col gap-2 mt-2 animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-secondary-600 uppercase tracking-widest ml-1">Select Fee Account</label>
                    <select
                      value={allocationTargetId}
                      onChange={(e) => setAllocationTargetId(e.target.value)}
                      className="w-full bg-secondary-950 border border-white/10 rounded-xl py-3 px-4 outline-none transition-all text-sm font-bold appearance-none cursor-pointer"
                      required={allocationType === 'FEE'}
                    >
                      <option value="">Choose a fee...</option>
                      {outstandingFees.map(fee => (
                        <option key={fee.id} value={fee.id}>{fee.description} (${Number(fee.amount).toLocaleString()})</option>
                      ))}
                      {outstandingFees.length === 0 && <option disabled>No outstanding fees found</option>}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Payment Date</label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Reference / Description</label>
                  <div className="relative group">
                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                    <input 
                      type="text" 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Cash payment at office"
                      className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all text-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Proof Of Payment (Optional)</label>
                <div className={cn(
                  "border-2 border-dashed rounded-2xl p-5 transition-all",
                  proofFile ? "border-primary-500/50 bg-primary-500/5" : "border-white/10 bg-white/5 hover:border-white/20"
                )}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-secondary-400">
                      <Upload size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{proofFile ? proofFile.name : 'Attach receipt, transfer slip, or proof document'}</p>
                      <p className="text-xs text-secondary-500 mt-1">PDF, JPG, or PNG up to 5MB</p>
                    </div>
                    <label className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-bold cursor-pointer transition-colors">
                      {proofFile ? 'Replace' : 'Upload'}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    {proofFile && (
                      <button
                        type="button"
                        onClick={() => setProofFile(null)}
                        className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3 animate-in fade-in">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-4 mt-2">
                <div className="p-4 rounded-2xl bg-primary-600/5 border border-primary-500/10 text-[11px] text-secondary-400 leading-relaxed italic">
                  Note: This action is recorded in the permanent audit trail. Large payments may trigger automated notifications to the buyer.
                </div>
                
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-primary-600/30 active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      Confirm & Post to Ledger
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
