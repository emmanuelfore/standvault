import { useState, useEffect } from 'react';
import { 
  Zap, 
  HelpCircle, 
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const AdditionalCharges = () => {
  const { user } = useAuth() as any;
  const [charges, setCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.buyerId) return;
    
    const fetchCharges = async () => {
      try {
        const response = await api.get(`/buyers/${user.buyerId}/ledger`);
        // Filter for non-payments
        const filtered = response.data
          .filter((e: any) => e.entry_type !== 'PAYMENT')
          .map((e: any) => ({
            id: e.id,
            description: e.description,
            amount: Number(e.amount),
            date: new Date(e.effective_date).toLocaleDateString(),
            type: e.entry_type
          }));
        setCharges(filtered);
      } catch (err) {
        console.error('Failed to fetch charges', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCharges();
  }, [user]);

  const totalSurcharges = charges.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Additional Charges</h1>
          <p className="text-secondary-400 mt-2">View all non-standard charges, penalties, and levies applied to your account.</p>
        </div>
        <div className="glass p-6 rounded-3xl border-l-4 border-l-orange-500 flex items-center gap-4">
           <div className="p-3 bg-orange-500/10 text-orange-400 rounded-2xl">
              <Zap size={24} />
           </div>
           <div>
              <p className="text-[10px] text-secondary-500 font-black uppercase tracking-widest">Total Surcharges</p>
              <p className="text-xl font-black italic">${totalSurcharges.toLocaleString()}</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in">
         {loading ? (
            Array(2).fill(0).map((_, i) => (
              <div key={i} className="h-40 glass rounded-3xl animate-pulse"></div>
            ))
         ) : charges.map((charge) => (
           <div key={charge.id} className="glass p-8 rounded-[2rem] flex flex-col gap-6 relative overflow-hidden group glass-hover">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                 {charge.type === 'PENALTY' ? <AlertCircle size={100} /> : <Zap size={100} />}
              </div>

              <div className="flex items-start justify-between relative z-10">
                 <div className="flex flex-col gap-1">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase w-fit",
                      charge.type === 'PENALTY' ? "bg-red-500 text-white" : "bg-primary-600 text-white"
                    )}>
                      {charge.type}
                    </span>
                    <h3 className="text-xl font-bold mt-2">{charge.description}</h3>
                 </div>
                 <div className="text-right">
                    <p className="text-2xl font-black italic text-white">${charge.amount.toLocaleString()}</p>
                    <p className="text-[10px] text-secondary-500 font-bold uppercase tracking-widest mt-1">{charge.date}</p>
                 </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-secondary-400 pt-6 border-t border-white/5 relative z-10">
                 <HelpCircle size={14} className="text-secondary-600" />
                 <span>This charge has been verified by project administration and is ledger-immutable.</span>
              </div>
           </div>
         ))}
      </div>

      <div className="glass p-10 rounded-[2.5rem] !bg-secondary-900/40 border-primary-500/10 flex flex-col gap-6">
         <h4 className="text-xl font-black tracking-tight">Understanding Charges</h4>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
            <div className="flex flex-col gap-3">
               <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center font-black">1</div>
               <p className="text-secondary-300 font-bold">Standard Installments</p>
               <p className="text-secondary-500 leading-relaxed">These are your agreed-upon monthly payments for the property purchase.</p>
            </div>
            <div className="flex flex-col gap-3">
               <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center font-black">2</div>
               <p className="text-secondary-300 font-bold">Penalty Calculations</p>
               <p className="text-secondary-500 leading-relaxed">Applied if payments are received after the 5-day grace period following a due date.</p>
            </div>
            <div className="flex flex-col gap-3">
               <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-black">3</div>
               <p className="text-secondary-300 font-bold">Bulk Project Levies</p>
               <p className="text-secondary-500 leading-relaxed">One-off infrastructure or service fees applied to all buyers in the estate.</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default AdditionalCharges;
