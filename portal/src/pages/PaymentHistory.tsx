import { useState, useEffect } from 'react';
import { 
  Download, 
  Search, 
  Filter,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Transaction {
  id: string;
  date: string;
  description: string;
  type: 'PAYMENT' | 'CHARGE' | 'REVERSAL' | 'MIGRATION';
  amount: number;
  balance: number;
  status: 'VERIFIED' | 'PENDING' | 'REJECTED';
}

const PaymentHistory = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock Transaction History
    setTimeout(() => {
      setTransactions([
        { id: '1', date: '2026-04-15', description: 'CBZ Bank Transfer Ref: 998231', type: 'PAYMENT', amount: 5000, balance: 25200, status: 'VERIFIED' },
        { id: '2', date: '2026-04-12', description: 'Monthly Installment - April', type: 'CHARGE', amount: -1200, balance: 30200, status: 'VERIFIED' },
        { id: '3', date: '2026-04-10', description: 'Opening Balance (Migrated)', type: 'MIGRATION', amount: 25000, balance: 29000, status: 'VERIFIED' },
        { id: '4', date: '2026-03-30', description: 'Late Payment Penalty - March', type: 'CHARGE', amount: -50, balance: 4000, status: 'VERIFIED' },
        { id: '5', date: '2026-03-15', description: 'EcoCash Cash-In Ref: 77123', type: 'PAYMENT', amount: 1500, balance: 3950, status: 'VERIFIED' },
      ]);
      setLoading(false);
    }, 600);
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Payment History</h1>
          <p className="text-secondary-400 mt-2">View an immutable chronological record of all your financial transactions.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold transition-all shadow-xl">
          <Download size={20} />
          Statement
        </button>
      </div>

      <div className="glass rounded-[2rem] overflow-hidden animate-in">
        <div className="p-8 border-b border-white/10 bg-white/5 flex flex-col md:flex-row gap-4 justify-between">
           <div className="relative flex-1 max-w-md">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
             <input 
               type="text" 
               placeholder="Search transactions..." 
               className="w-full bg-secondary-950 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary-600/50 outline-none transition-all"
             />
           </div>
           <div className="flex gap-2">
             <button className="flex items-center gap-2 px-4 py-2 bg-secondary-900 border border-white/10 rounded-xl text-sm font-bold"><Filter size={16} /> Filter</button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-secondary-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/10">
                 <th className="px-8 py-5">Date</th>
                 <th className="px-8 py-5">Transaction Details</th>
                 <th className="px-8 py-5">Type</th>
                 <th className="px-8 py-5 text-right">Amount</th>
                 <th className="px-8 py-5 text-right">Running Balance</th>
                 <th className="px-8 py-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-6"><div className="h-6 bg-white/5 rounded-lg w-full"></div></td>
                  </tr>
                ))
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-white/5 transition-colors group cursor-pointer">
                  <td className="px-8 py-6 text-sm font-medium text-secondary-400">{tx.date}</td>
                  <td className="px-8 py-6">
                    <p className="font-bold text-white group-hover:text-primary-400 transition-colors uppercase tracking-tight text-sm">{tx.description}</p>
                    <p className="text-[10px] text-secondary-500 mt-0.5 tracking-widest font-black uppercase">Ref STV-{tx.id}00231</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                      tx.type === 'PAYMENT' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                      tx.type === 'CHARGE' ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                      tx.type === 'MIGRATION' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      "bg-red-500/10 text-red-400 border-red-500/20"
                    )}>
                      {tx.type}
                    </span>
                  </td>
                  <td className={cn(
                    "px-8 py-6 text-right font-black text-lg",
                    tx.amount > 0 ? "text-green-400" : "text-white"
                  )}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </td>
                  <td className="px-8 py-6 text-right font-black text-secondary-300">
                    ${tx.balance.toLocaleString()}
                  </td>
                  <td className="px-8 py-6 text-right">
                     <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-secondary-500">
                       <CheckCircle2 size={12} className="text-primary-500" />
                       {tx.status}
                     </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-8 border-t border-white/10 bg-white/5 flex items-center justify-between text-secondary-500 text-xs font-bold uppercase tracking-widest">
           <span>Total 5 Transactions</span>
           <div className="flex gap-4">
             <button className="hover:text-white transition-colors">Previous</button>
             <button className="hover:text-white transition-colors">Next</button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistory;
