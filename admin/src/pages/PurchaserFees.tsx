import { useEffect, useState } from 'react';
import { AlertCircle, HelpCircle, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const PurchaserFees = () => {
  const { user } = useAuth();
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFees = async () => {
      if (!user?.buyerId) return;

      try {
        const response = await api.get(`/buyers/${user.buyerId}/ledger`);
        const filtered = response.data
          .filter((entry: any) => entry.entry_type !== 'PAYMENT' && entry.entry_type !== 'REVERSAL')
          .map((entry: any) => ({
            id: entry.id,
            description: entry.description,
            amount: Number(entry.amount),
            date: new Date(entry.effective_date).toLocaleDateString(),
            type: entry.entry_type
          }));
        setFees(filtered);
      } catch (err) {
        console.error('Failed to fetch fees', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFees();
  }, [user?.buyerId]);

  const totalFees = fees.reduce((sum, fee) => sum + fee.amount, 0);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Additional Fees</h1>
          <p className="text-secondary-400 mt-2">View all penalties, levies, and non-standard fees applied to your account.</p>
        </div>
        <div className="glass p-6 rounded-3xl border-l-4 border-l-orange-500 flex items-center gap-4">
          <div className="p-3 bg-orange-500/10 text-orange-400 rounded-2xl">
            <Zap size={24} />
          </div>
          <div>
            <p className="text-[10px] text-secondary-500 font-black uppercase tracking-widest">Total Fees</p>
            <p className="text-xl font-black italic">${totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in">
        {loading ? (
          Array(2)
            .fill(0)
            .map((_, index) => <div key={index} className="h-40 glass rounded-3xl animate-pulse"></div>)
        ) : fees.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center text-secondary-500 lg:col-span-2">
            No additional fees have been applied to your account.
          </div>
        ) : (
          fees.map((fee) => (
            <div key={fee.id} className="glass p-8 rounded-[2rem] flex flex-col gap-6 relative overflow-hidden group glass-hover">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                {fee.type === 'PENALTY' ? <AlertCircle size={100} /> : <Zap size={100} />}
              </div>

              <div className="flex items-start justify-between relative z-10">
                <div className="flex flex-col gap-1">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase w-fit',
                      fee.type === 'PENALTY' ? 'bg-red-500 text-white' : 'bg-primary-600 text-white'
                    )}
                  >
                    {fee.type}
                  </span>
                  <h3 className="text-xl font-bold mt-2">{fee.description}</h3>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black italic text-white">${fee.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-secondary-500 font-bold uppercase tracking-widest mt-1">{fee.date}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-secondary-400 pt-6 border-t border-white/5 relative z-10">
                <HelpCircle size={14} className="text-secondary-600" />
                <span>This fee has been recorded on your purchaser ledger.</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PurchaserFees;
