import { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SchedulePeriod {
  period_number: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: 'PAID' | 'PARTIAL'| 'PENDING' | 'OVERDUE';
}

const PaymentSchedule = () => {
  const [schedule, setSchedule] = useState<SchedulePeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock Schedule
    setTimeout(() => {
      const mockSchedule: SchedulePeriod[] = [];
      const now = new Date();
      
      for (let i = 1; i <= 24; i++) {
        const dueDate = new Date(2026, i - 1, 1);
        let status: 'PAID' | 'PARTIAL'| 'PENDING' | 'OVERDUE' = 'PENDING';
        let paid = 0;
        
        if (dueDate < now) {
          status = 'PAID';
          paid = 1200;
        } else if (i === now.getMonth() + 1) {
          status = 'PENDING';
          paid = 0;
        }
        
        mockSchedule.push({
          period_number: i,
          due_date: dueDate.toISOString().split('T')[0],
          amount_due: 1200,
          amount_paid: paid,
          status: status
        });
      }
      setSchedule(mockSchedule);
      setLoading(false);
    }, 600);
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Payment Plan</h1>
          <p className="text-secondary-400 mt-2">Track your monthly instalments and upcoming due dates.</p>
        </div>
        <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
           <div className="text-right">
             <p className="text-xs text-secondary-500 font-bold uppercase tracking-widest">Total Terms</p>
             <p className="font-black text-xl">24 <span className="text-xs text-secondary-600 font-medium tracking-normal">Months</span></p>
           </div>
           <div className="w-px h-10 bg-white/10"></div>
           <div className="text-right">
             <p className="text-xs text-secondary-500 font-bold uppercase tracking-widest">Completed</p>
             <p className="font-black text-xl text-primary-400">4 <span className="text-xs text-secondary-600 font-medium tracking-normal">/ 24</span></p>
           </div>
        </div>
      </div>

      <div className="glass rounded-[2rem] overflow-hidden animate-in">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-secondary-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/10">
                 <th className="px-8 py-5">#</th>
                 <th className="px-8 py-5">Due Date</th>
                 <th className="px-8 py-5">Amount Due</th>
                 <th className="px-8 py-5">Amount Paid</th>
                 <th className="px-8 py-5">Balance for Period</th>
                 <th className="px-8 py-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-6"><div className="h-4 bg-white/5 rounded w-full"></div></td>
                  </tr>
                ))
              ) : schedule.map((period) => (
                <tr key={period.period_number} className={cn(
                  "transition-colors group",
                  period.status === 'OVERDUE' ? "bg-red-500/5 hover:bg-red-500/10" : "hover:bg-white/5"
                )}>
                  <td className="px-8 py-6 text-sm font-bold text-secondary-500">{period.period_number.toString().padStart(2, '0')}</td>
                  <td className="px-8 py-6 font-bold tracking-tight">{period.due_date}</td>
                  <td className="px-8 py-6 font-black">${period.amount_due.toLocaleString()}</td>
                  <td className="px-8 py-6 font-bold text-green-400">
                    {period.amount_paid > 0 ? `$${period.amount_paid.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-8 py-6 text-sm font-medium text-secondary-400">
                    ${(period.amount_due - period.amount_paid).toLocaleString()}
                  </td>
                  <td className="px-8 py-6 text-right">
                     <span className={cn(
                       "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-1.5",
                       period.status === 'PAID' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                       period.status === 'OVERDUE' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                       period.status === 'PARTIAL' ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                       "bg-white/5 text-secondary-500 border-white/10"
                     )}>
                       {period.status === 'PAID' && <CheckCircle2 size={12} />}
                       {period.status === 'OVERDUE' && <AlertCircle size={12} />}
                       {period.status === 'PENDING' && <Clock size={12} />}
                       {period.status}
                     </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-8 rounded-[2rem] bg-primary-600/5 border border-primary-500/10 flex items-start gap-4">
         <div className="p-3 bg-primary-600/20 rounded-2xl text-primary-400 shrink-0">
           <HelpCircle size={24} />
         </div>
         <div className="flex flex-col gap-2">
            <h4 className="font-bold text-lg">About your payment plan</h4>
            <p className="text-secondary-400 text-sm leading-relaxed">
              This payment plan is based on your initial contract for <span className="text-white font-bold italic">Stand A-101</span>. 
              Any additional charges, penalties, or bulk project fees applied to your account will automatically trigger a 
              recalculation of your future instalments upon administrator approval.
            </p>
         </div>
      </div>
    </div>
  );
};

export default PaymentSchedule;
