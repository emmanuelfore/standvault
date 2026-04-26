import { useState, useEffect } from 'react';
import { 
  Bell, 
  MessageSquare, 
  HelpCircle, 
  ChevronRight,
  ExternalLink,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';

const Announcements = () => {
  const [activeTab, setActiveTab] = useState<'updates' | 'support'>('updates');
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    // Mock Announcements
    setAnnouncements([
      { id: 1, title: 'Road Infrastructure Update', message: 'Taring of Sector A roads is currently 80% complete. Access may be limited during weekends.', date: '2026-04-10', priority: 'NORMAL' },
      { id: 2, title: 'Easter Office Hours', message: 'Our main office will be closed from Friday 16th to Monday 19th April.', date: '2026-04-05', priority: 'LOW' },
      { id: 3, title: 'Security Upgrade: Portal Ledger', message: 'We have updated our ledger system to include cryptographic verification for all buyer payments.', date: '2026-04-01', priority: 'HIGH' },
    ]);
  }, []);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Updates & Support</h1>
          <p className="text-secondary-400 mt-2">Stay informed about your property project and get help when you need it.</p>
        </div>
        
        <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl w-fit border border-white/5">
           <button
             onClick={() => setActiveTab('updates')}
             className={cn(
               "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
               activeTab === 'updates' ? "bg-secondary-800 text-white shadow-lg" : "text-secondary-500 hover:text-white"
             )}
           >
             <Bell size={18} />
             Announcements
           </button>
           <button
             onClick={() => setActiveTab('support')}
             className={cn(
               "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
               activeTab === 'support' ? "bg-secondary-800 text-white shadow-lg" : "text-secondary-500 hover:text-white"
             )}
           >
             <MessageSquare size={18} />
             Support & Disputes
           </button>
        </div>
      </div>

      {activeTab === 'updates' ? (
        <div className="flex flex-col gap-6 animate-in">
           {announcements.map((ann) => (
             <div key={ann.id} className={cn(
               "glass p-8 rounded-[2rem] border-l-4 flex flex-col gap-4 glass-hover",
               ann.priority === 'HIGH' ? "border-l-red-500" :
               ann.priority === 'NORMAL' ? "border-l-primary-500" :
               "border-l-secondary-700"
             )}>
                <div className="flex justify-between items-start">
                   <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-secondary-500 font-black uppercase tracking-widest">{ann.date}</span>
                      <h3 className="text-xl font-bold">{ann.title}</h3>
                   </div>
                   {ann.priority === 'HIGH' && (
                     <span className="px-2 py-0.5 rounded bg-red-500 text-[9px] font-black uppercase tracking-widest text-white">Urgent</span>
                   )}
                </div>
                <p className="text-secondary-400 leading-relaxed max-w-3xl">{ann.message}</p>
                <div className="flex items-center gap-4 mt-2">
                   <button className="text-xs font-bold text-primary-400 hover:underline flex items-center gap-1.5">
                     Read Full Announcement <ChevronRight size={14} />
                   </button>
                </div>
             </div>
           ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in">
           <div className="flex flex-col gap-8">
              <div className="glass p-8 rounded-[2.5rem] border-white/5 bg-secondary-900/40">
                 <h3 className="text-xl font-bold mb-6">Raise a Support Ticket</h3>
                 <form className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                       <label className="text-xs font-bold text-secondary-400 uppercase tracking-widest">Issue Category</label>
                       <select className="w-full bg-secondary-950 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-600/50 outline-none">
                          <option>Payment Verification</option>
                          <option>Statement Discrepancy</option>
                          <option>Document Request</option>
                          <option>Infrastructure Inquiry</option>
                          <option>Other</option>
                       </select>
                    </div>
                    <div className="flex flex-col gap-2">
                       <label className="text-xs font-bold text-secondary-400 uppercase tracking-widest">Description</label>
                       <textarea 
                          rows={4}
                          placeholder="Please provide details about your issue or dispute..."
                          className="w-full bg-secondary-950 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-600/50 outline-none resize-none"
                       ></textarea>
                    </div>
                    <button className="py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black tracking-tight transition-all active:scale-95 shadow-xl shadow-primary-600/20">
                       Submit Support Request
                    </button>
                 </form>
              </div>
           </div>

           <div className="flex flex-col gap-8">
              <div className="glass p-8 rounded-[2rem]">
                 <h3 className="font-bold flex items-center gap-2 mb-6">
                    <HelpCircle size={20} className="text-primary-400" /> 
                    Common Questions
                 </h3>
                 <div className="flex flex-col gap-4">
                    {[
                      'How long does payment verification take?',
                      'Where can I find my property deed?',
                      'How are late payment penalties calculated?',
                    ].map((q, i) => (
                      <button key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 text-sm font-medium hover:bg-white/10 transition-colors">
                        {q} <ChevronRight size={16} className="text-secondary-600" />
                      </button>
                    ))}
                 </div>
              </div>

              <div className="p-8 rounded-[2rem] bg-indigo-600/5 border border-indigo-500/10 flex items-start gap-4">
                 <div className="p-3 bg-indigo-600/20 rounded-2xl text-indigo-400 shrink-0">
                   <Info size={24} />
                 </div>
                 <div className="flex flex-col gap-2">
                    <h4 className="font-bold">Contact Administration</h4>
                    <p className="text-secondary-400 text-xs leading-relaxed">
                       For urgent legal matters or direct inquiries, please visit our head office or call 
                       <span className="text-white font-bold ml-1">+263 242 770 000</span>.
                    </p>
                    <button className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mt-2 flex items-center gap-1">
                       View Office Map <ExternalLink size={10} />
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Announcements;
