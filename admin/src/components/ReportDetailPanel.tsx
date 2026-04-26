import React, { useState, useEffect } from 'react';
import { X, Calendar, ArrowUpRight, ArrowDownLeft, FileText, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';

interface ReportDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  buyerId: string | null;
}

const ReportDetailPanel: React.FC<ReportDetailPanelProps> = ({ isOpen, onClose, buyerId }) => {
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [buyerInfo, setBuyerInfo] = useState<any>(null);

  useEffect(() => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(buyerId || '');
    
    if (isOpen && buyerId && isUuid) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const [ledgerRes, buyerRes] = await Promise.all([
            api.get(`/buyers/${buyerId}/ledger`),
            api.get(`/buyers/${buyerId}`)
          ]);
          setLedger(ledgerRes.data);
          setBuyerInfo(buyerRes.data);
        } catch (err) {
          console.error('Failed to fetch detail data', err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    } else if (isOpen) {
       // Reset state if no valid ID or different ID
       setLedger([]);
       setBuyerInfo(null);
    }
  }, [isOpen, buyerId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      <div className="absolute inset-0 bg-secondary-950/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl animate-in slide-in-from-right duration-500">
          <div className="h-full flex flex-col bg-neutral-900 border-l border-white/10 shadow-2xl relative">
            {/* Header */}
            <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest text-white">Auditor Detail View</h2>
                <p className="text-secondary-500 text-xs font-bold mt-1">Inspecting Ledger Repository</p>
              </div>
              <button 
                onClick={onClose}
                className="p-3 hover:bg-white/10 rounded-full transition-all text-secondary-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* Buyer Context */}
            {buyerInfo && (
               <div className="px-8 py-6 bg-primary-600/5 border-b border-white/5 flex items-center gap-6">
                  <div className="w-16 h-16 rounded-3xl bg-primary-600 flex items-center justify-center text-white text-xl font-black">
                     {buyerInfo.first_name[0]}{buyerInfo.last_name[0]}
                  </div>
                  <div>
                     <h3 className="text-lg font-bold">{buyerInfo.first_name} {buyerInfo.last_name}</h3>
                     <p className="text-secondary-500 text-sm font-medium">Stand {buyerInfo.stand?.stand_number} • {buyerInfo.email}</p>
                  </div>
               </div>
            )}

            {/* Ledger List */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 py-20">
                  <Loader2 size={32} className="text-primary-500 animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary-500">Fetching Remote Archive...</p>
                </div>
              ) : ledger.length > 0 ? (
                <div className="space-y-4">
                  {ledger.map((entry, i) => (
                    <div key={i} className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-all group">
                       <div className="flex items-center justify-between mb-2">
                          <div className={cn(
                             "flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                             entry.entry_type === 'PAYMENT' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                          )}>
                             {entry.entry_type === 'PAYMENT' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                             {entry.entry_type}
                          </div>
                          <span className="text-sm font-black text-white">${Number(entry.amount).toLocaleString()}</span>
                       </div>
                       <p className="text-sm text-secondary-300 font-medium mb-3">{entry.description}</p>
                       <div className="flex items-center gap-4 text-[10px] text-secondary-600 font-bold">
                          <span className="flex items-center gap-1.5"><Calendar size={12} /> {new Date(entry.effective_date).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1.5"><FileText size={12} /> REF: {entry.id.split('-')[0].toUpperCase()}</span>
                       </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-secondary-600 gap-4 py-20 px-12 text-center">
                   <FileText size={48} className="opacity-20" />
                   <div className="space-y-1">
                      <p className="font-bold text-white">Full Audit Not Available</p>
                      <p className="text-xs">Deep auditing is only available for individual purchaser records. Summary rows do not have a ledger archive.</p>
                   </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-8 border-t border-white/10 flex items-center gap-4 bg-white/[0.02]">
               <button 
                  onClick={onClose}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-secondary-400 font-black uppercase tracking-widest text-xs rounded-2xl border border-white/10 transition-all"
               >
                  Close Archive
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDetailPanel;
