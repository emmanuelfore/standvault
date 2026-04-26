import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle2, AlertCircle, Calculator } from 'lucide-react';
import api from '../lib/api';

interface ConfirmScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyerId: string;
  buyerName: string;
  onSuccess: () => void;
}

const ConfirmScheduleModal: React.FC<ConfirmScheduleModalProps> = ({ isOpen, onClose, buyerId, buyerName, onSuccess }) => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [customDeposit, setCustomDeposit] = useState<string>('');
  const [customInstalments, setCustomInstalments] = useState<string>('');
  const [buyer, setBuyer] = useState<any>(null);
  const [projectConfig, setProjectConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && buyerId) {
       const fetchContext = async () => {
         setFetching(true);
         try {
           const bRes = await api.get(`/buyers/${buyerId}`);
           setBuyer(bRes.data);
           
           if (bRes.data.stand?.project_id) {
              const pRes = await api.get(`/projects/${bRes.data.stand.project_id}`);
              setProjectConfig(pRes.data.config);
              setCustomInstalments(pRes.data.config.instalments_max.toString());
           }
         } catch (err) {
           console.error('Failed to fetch modal context', err);
         } finally {
           setFetching(false);
         }
       };
       fetchContext();
    }
  }, [isOpen, buyerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post(`/buyers/${buyerId}/schedule`, {
        start_date: startDate,
        customDeposit: customDeposit ? Number(customDeposit) : undefined,
        customInstalments: customInstalments ? Number(customInstalments) : undefined
      });
      
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
        setCustomDeposit('');
        setCustomInstalments('');
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate schedule');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const calculatePreview = () => {
    if (!buyer?.stand || !projectConfig) return null;
    const stand = buyer.stand;
    const totalPrice = Number(stand.size_sqm) * Number(stand.price_per_sqm);
    const deposit = Number(customDeposit) || (totalPrice * projectConfig.deposit_pct / 100);
    const principal = totalPrice - deposit;
    const periods = Number(customInstalments) || projectConfig.instalments_max;
    const estimatedMonthly = periods > 0 ? (principal / periods) : 0;

    return { totalPrice, deposit, principal, periods, estimatedMonthly };
  };

  const preview = calculatePreview();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-secondary-950/80 backdrop-blur-sm animate-in fade-in" onClick={onClose}></div>
      
      <div className="glass w-full max-w-2xl rounded-[2.5rem] border-white/10 shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden my-auto">
        {success ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center border-4 border-primary-500/20">
              <CheckCircle2 size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Payment Plan Active!</h2>
              <p className="text-secondary-400 mt-2">The custom repayment schedule has been activated for {buyerName}.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-primary-600/10 flex items-center justify-center text-primary-400">
                   <Calculator size={24} />
                 </div>
                 <div>
                    <h2 className="text-xl font-bold">Configure Payment Plan</h2>
                    <p className="text-xs text-secondary-400 mt-1">Set the financial terms for {buyerName}</p>
                 </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors text-secondary-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-8 max-h-[80vh] overflow-y-auto">
              {fetching ? (
                 <div className="py-12 flex items-center justify-center gap-3 text-secondary-400 font-bold italic">
                   <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                   Loading terms...
                 </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Custom Deposit ($)</label>
                      <input 
                        type="number" 
                        value={customDeposit}
                        onChange={(e) => setCustomDeposit(e.target.value)}
                        placeholder="Leave blank for project default"
                        className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 px-6 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-bold text-emerald-500"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Instalment Period (Months)</label>
                      <input 
                        type="number" 
                        value={customInstalments}
                        onChange={(e) => setCustomInstalments(e.target.value)}
                        placeholder="e.g. 24"
                        className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 px-6 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-bold text-primary-400"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">First Due Date</label>
                    <div className="relative group">
                      <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        onClick={(e) => (e.target as any).showPicker?.()}
                        style={{ colorScheme: 'dark' }}
                        className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-14 pr-6 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-bold cursor-pointer"
                        required
                      />
                    </div>
                  </div>

                  {/* Real-time Calculator Preview */}
                  {preview && (
                    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 flex flex-col gap-6">
                      <div className="grid grid-cols-2 gap-8 pb-6 border-b border-white/5">
                        <div className="flex flex-col">
                          <p className="text-[10px] font-black uppercase text-secondary-500 tracking-widest">Total Stand Price</p>
                          <p className="text-2xl font-black text-white mt-1">${preview.totalPrice.toLocaleString()}</p>
                        </div>
                        <div className="flex flex-col text-right">
                          <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest text-emerald-500/80">Initial Deposit</p>
                          <p className="text-2xl font-black text-emerald-500 mt-1">${preview.deposit.toLocaleString()}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                         <div>
                            <p className="text-[10px] font-black uppercase text-primary-500/80 tracking-widest">Projected Monthly Instalment</p>
                            <p className="text-3xl font-black text-primary-400 mt-1">
                               ${preview.estimatedMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                               <span className="text-sm font-bold text-secondary-500 ml-2 tracking-normal">/ month</span>
                            </p>
                         </div>
                         <div className="text-right">
                            <p className="text-[10px] font-black uppercase text-secondary-500 tracking-widest">To Finance</p>
                            <p className="text-xl font-bold text-secondary-300 mt-1">${preview.principal.toLocaleString()}</p>
                         </div>
                      </div>
                      
                      <p className="text-[10px] italic text-secondary-500 text-center">Calculations based on {preview.periods} months at {projectConfig?.interest_rate || 0}% annual interest.</p>
                    </div>
                  )}

                  {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-xl transition-all shadow-2xl shadow-primary-600/30 flex items-center justify-center gap-3"
                  >
                    {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (
                      <>
                        <CheckCircle2 size={24} />
                        Confirm & Generate Plan
                      </>
                    )}
                  </button>
                </>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ConfirmScheduleModal;
