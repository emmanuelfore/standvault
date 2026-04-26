import { useEffect, useState } from 'react';
import { Bell, ChevronRight, Info, MessageSquare, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';

const PurchaserAnnouncements = () => {
  const [activeTab, setActiveTab] = useState<'updates' | 'support'>('updates');
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/notifications/mine');
      // Filter for ANNOUNCEMENT type or show all notifications if they are important
      const sorted = (response.data || []).sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setAnnouncements(sorted);
    } catch (err: any) {
      console.error('Failed to fetch announcements', err);
      setError('Failed to load updates. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Updates & Support</h1>
          <p className="text-secondary-400 mt-2">Stay informed about your property account and project notices.</p>
        </div>

        <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl w-fit border border-white/5">
          <button
            onClick={() => setActiveTab('updates')}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all',
              activeTab === 'updates' ? 'bg-secondary-800 text-white shadow-lg' : 'text-secondary-500 hover:text-white'
            )}
          >
            <Bell size={18} />
            Announcements
          </button>
          <button
            onClick={() => setActiveTab('support')}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all',
              activeTab === 'support' ? 'bg-secondary-800 text-white shadow-lg' : 'text-secondary-500 hover:text-white'
            )}
          >
            <MessageSquare size={18} />
            Support
          </button>
        </div>
      </div>

      {activeTab === 'updates' ? (
        <div className="flex flex-col gap-6 animate-in">
          {loading ? (
             Array(3).fill(0).map((_, i) => (
               <div key={i} className="h-40 glass rounded-[2rem] animate-pulse"></div>
             ))
          ) : announcements.length === 0 ? (
            <div className="glass p-20 rounded-[3rem] text-center flex flex-col items-center gap-4">
              <div className="p-6 bg-white/5 rounded-full text-secondary-600">
                <Bell size={40} />
              </div>
              <p className="text-secondary-500 font-medium max-w-xs">No updates or announcements have been posted to your account yet.</p>
            </div>
          ) : (
            announcements.map((announcement) => (
              <div
                key={announcement.id}
                onClick={!announcement.is_read ? () => markAsRead(announcement.id) : undefined}
                className={cn(
                  'glass p-8 rounded-[2rem] border-l-4 flex flex-col gap-4 transition-all relative group',
                  !announcement.is_read ? 'bg-primary-600/5 border-l-primary-500' : 'border-l-secondary-700 opacity-80 hover:opacity-100',
                  announcement.type === 'ANNOUNCEMENT' && announcement.priority === 'HIGH' ? 'border-l-red-500' : ''
                )}
              >
                {!announcement.is_read && (
                  <div className="absolute top-8 right-8 w-2 h-2 bg-primary-500 rounded-full shadow-lg shadow-primary-500/50"></div>
                )}
                
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-secondary-500 font-black uppercase tracking-widest">
                      {new Date(announcement.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                    </span>
                    <h3 className="text-xl font-bold">{announcement.title}</h3>
                  </div>
                  {announcement.type === 'FEE_ADDED' && (
                    <span className="px-2 py-0.5 rounded bg-primary-600 text-[9px] font-black uppercase tracking-widest text-white">Financial</span>
                  )}
                </div>
                <p className="text-secondary-400 leading-relaxed max-w-3xl">{announcement.message}</p>
                <div className="flex items-center gap-4 mt-2">
                   <button className="text-xs font-bold text-primary-400 hover:underline flex items-center gap-1.5 w-fit">
                    Read Details <ChevronRight size={14} />
                  </button>
                  {announcement.type === 'FEE_ADDED' && (
                     <button 
                        onClick={(e) => { e.stopPropagation(); /* navigate to ledger */ }}
                        className="text-xs font-bold text-secondary-500 hover:text-white transition-colors"
                     >
                        View Ledger
                     </button>
                  )}
                </div>
              </div>
            ))
          )}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
              <AlertCircle size={20} />
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in">
          <div className="glass p-8 rounded-[2.5rem] border-white/5 bg-secondary-900/40">
            <h3 className="text-xl font-bold mb-6">Raise a Support Ticket</h3>
            <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-secondary-400 uppercase tracking-widest">Issue Category</label>
                <select className="w-full bg-secondary-950 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-600/50 outline-none">
                  <option>Payment Verification</option>
                  <option>Statement Discrepancy</option>
                  <option>Document Request</option>
                  <option>Infrastructure Inquiry</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-secondary-400 uppercase tracking-widest">Description</label>
                <textarea
                  rows={4}
                  placeholder="Please provide details about your issue or request..."
                  className="w-full bg-secondary-950 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-600/50 outline-none resize-none"
                ></textarea>
              </div>
              <button className="py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black tracking-tight transition-all active:scale-95 shadow-xl shadow-primary-600/20">
                Submit Support Request
              </button>
            </form>
          </div>

          <div className="p-8 rounded-[2rem] bg-indigo-600/5 border border-indigo-500/10 flex items-start gap-4">
            <div className="p-3 bg-indigo-600/20 rounded-2xl text-indigo-400 shrink-0">
              <Info size={24} />
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="font-bold">Contact Administration</h4>
              <p className="text-secondary-400 text-xs leading-relaxed">
                For urgent allocation, payment, or documentation questions, please contact project administration directly.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaserAnnouncements;
