import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight, 
  CreditCard,
  FileText,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

const Dashboard = () => {
  const { user } = useAuth() as any;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get(`/buyers/${user.buyerId}/dashboard`);
        setData(response.data);
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.buyerId) {
      fetchData();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Financial Overview</h1>
          <p className="text-secondary-400 mt-2 text-lg">You have paid <span className="text-primary-400 font-bold">{data.progress_pct}%</span> of your total property contract.</p>
        </div>
        <div className={cn(
          "px-6 py-3 rounded-2xl border flex items-center gap-3 font-black tracking-widest text-xs uppercase",
          data.balance_status === 'HEALTHY' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
        )}>
          {data.balance_status === 'HEALTHY' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          Account Status: {data.balance_status}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Card */}
        <div className="lg:col-span-2 glass p-10 rounded-[2.5rem] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={120} />
          </div>
          
          <div className="relative z-10 flex flex-col gap-8">
            <div className="flex flex-col gap-4">
               <h3 className="text-secondary-400 text-sm font-bold uppercase tracking-widest">Property Progress</h3>
               <div className="flex items-end justify-between">
                  <div className="flex flex-col">
                    <span className="text-5xl font-black">${data.total_paid.toLocaleString()}</span>
                    <span className="text-secondary-500 font-medium mt-1">Paid out of ${data.total_price.toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-primary-400">{data.progress_pct}%</span>
                  </div>
               </div>
               
               <div className="mt-4 h-6 w-full bg-secondary-900 rounded-full p-1 border border-white/5">
                 <div 
                   className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full progress-glow relative"
                   style={{ width: `${data.progress_pct}%` }}
                 >
                   <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[pulse_2s_linear_infinite] opacity-20"></div>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-8 border-t border-white/10">
               <div>
                  <p className="text-[10px] text-secondary-500 font-black uppercase tracking-widest mb-1">Stand #</p>
                  <p className="font-bold text-lg italic">{data.stand_number}</p>
               </div>
               <div>
                  <p className="text-[10px] text-secondary-500 font-black uppercase tracking-widest mb-1">Outstanding</p>
                  <p className="font-bold text-lg">${data.outstanding.toLocaleString()}</p>
               </div>
               <div className="col-span-2 sm:col-span-2 bg-white/5 rounded-2xl p-4 flex items-center justify-between border border-white/5 ring-1 ring-white/10">
                  <div>
                    <p className="text-[10px] text-primary-400 font-black uppercase tracking-widest mb-1">Next Payment</p>
                    <p className="font-bold">{data.next_payment_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-xl">${data.next_payment_amount}</p>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Quick Actions / Side */}
        <div className="flex flex-col gap-8">
           <div className="glass p-8 rounded-[2rem] flex flex-col gap-6">
              <h3 className="font-bold text-xl">Quick Actions</h3>
              <div className="flex flex-col gap-3">
                 <Link to="/pop-upload" className="flex items-center justify-between p-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black tracking-tight transition-all active:scale-95 shadow-xl shadow-primary-600/20 group">
                    <span>Submit Proof Of Payment</span>
                    <ArrowUpRight size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                 </Link>
                 <button className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold transition-all text-sm group">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center">
                      <CreditCard size={18} />
                    </div>
                    Pay with Card/QR
                 </button>
                 <button className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold transition-all text-sm group">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <FileText size={18} />
                    </div>
                    Download Statement
                 </button>
              </div>
           </div>

           <div className="glass p-8 rounded-[2rem] flex-1">
              <h3 className="font-bold mb-6">Security</h3>
              <div className="flex gap-4 p-4 bg-secondary-900/50 rounded-2xl border border-white/5">
                 <div className="shrink-0 w-10 h-10 rounded-full bg-primary-400/10 flex items-center justify-center text-primary-400">
                    <CheckCircle2 size={24} />
                 </div>
                 <div>
                    <p className="text-sm font-bold">Ledger Verified</p>
                    <p className="text-xs text-secondary-500 mt-1">Your payments are immutable and cryptographically logged.</p>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Activity Section */}
      <div className="flex flex-col gap-6">
         <div className="flex items-center justify-between">
           <h3 className="text-2xl font-black tracking-tight">Recent Activity</h3>
           <button className="text-primary-500 text-sm font-bold hover:underline">Full Payment History</button>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.recent_activity.map((activity: any) => (
              <div key={activity.id} className="glass p-6 rounded-3xl flex flex-col gap-4 glass-hover hover:-translate-y-1 transition-all">
                <div className="flex items-start justify-between">
                   <div className={cn(
                     "w-12 h-12 rounded-2xl flex items-center justify-center",
                     activity.entry_type === 'PAYMENT' ? "bg-green-500/10 text-green-400" :
                     activity.entry_type === 'FEE' ? "bg-orange-500/10 text-orange-400" :
                     "bg-purple-500/10 text-purple-400"
                   )}>
                      {activity.entry_type === 'PAYMENT' ? <CreditCard size={24} /> :
                       activity.entry_type === 'FEE' ? <Clock size={24} /> :
                       <TrendingUp size={24} />}
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary-500">{new Date(activity.created_at).toLocaleDateString()}</span>
                </div>
                <div>
                   <h4 className="font-bold text-lg">{activity.description}</h4>
                   <p className="text-sm text-secondary-400 mt-1">Ref #{activity.id.substring(0, 8).toUpperCase()}</p>
                </div>
                {activity.amount && (
                  <div className="mt-2 pt-4 border-t border-white/5 flex justify-between items-baseline">
                     <span className="text-secondary-500 text-xs">Amount</span>
                     <span className={cn(
                       "text-xl font-black",
                       activity.entry_type === 'PAYMENT' ? "text-green-400" : "text-white"
                     )}>
                       {activity.entry_type === 'PAYMENT' ? '+' : '-'}${Number(activity.amount).toLocaleString()}
                     </span>
                  </div>
                )}
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default Dashboard;
