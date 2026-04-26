import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Plus, 
  Search, 
  Trash2, 
  Users, 
  Info,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';
import { useProject } from '../contexts/ProjectContext';
import { usePagination } from '../hooks/usePagination';
import TablePagination from '../components/TablePagination';

/**
 * ManageAnnouncements component.
 * Standardizes hook usage to avoid invalid hook call errors during HMR.
 */
const ManageAnnouncements = () => {
  const { selectedProject } = useProject();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState('');
  
  // New Announcement Form
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL');

  const fetchAnnouncements = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      // announcements logic currently mixes with notifications table. 
      // We will fetch where type = ANNOUNCEMENT for this project
      const response = await api.get(`/projects/${selectedProject.id}/announcements`);
      setAnnouncements(response.data);
    } catch (err: any) {
      console.error('Failed to fetch announcements', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [selectedProject]);

  const filteredAnnouncements = announcements.filter(a => 
    a.title.toLowerCase().includes(search.toLowerCase()) || 
    a.message.toLowerCase().includes(search.toLowerCase())
  );

  const {
    currentPage,
    pageSize,
    paginatedItems: paginatedAnnouncements,
    rangeEnd,
    rangeStart,
    totalItems,
    totalPages,
    setCurrentPage,
    setPageSize,
  } = usePagination(filteredAnnouncements, 10);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setModalLoading(true);
    setError('');
    try {
      await api.post(`/projects/${selectedProject.id}/announcements`, {
        title,
        message,
        priority // Added priority if the backend supports it, else it will be ignored
      });
      setIsModalOpen(false);
      setTitle('');
      setMessage('');
      fetchAnnouncements();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to broadcast announcement');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold">Project Announcements</h1>
          <p className="text-secondary-400 mt-1">Broadcast important updates and notices to all project purchasers.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-primary-600/20 transition-all active:scale-95"
        >
          <Plus size={20} /> Broadcast Notice
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search announcements..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary-600/50"
          />
        </div>
        <div className="glass p-3 rounded-xl flex items-center gap-3 border-white/10">
          <Users size={20} className="text-secondary-500" />
          <span className="text-sm font-bold">{announcements.length} Total Broadcasts</span>
        </div>
      </div>

      <div className="glass rounded-3xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-secondary-500 text-[10px] font-black uppercase tracking-widest border-b border-white/10">
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Broadcast Message</th>
                <th className="px-6 py-4">Date Sent</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {loading ? (
                 Array(3).fill(0).map((_, i) => (
                   <tr key={i} className="animate-pulse">
                     <td colSpan={5} className="px-6 py-8"><div className="h-4 bg-white/5 rounded"></div></td>
                   </tr>
                 ))
              ) : paginatedAnnouncements.map((ann) => (
                <tr key={ann.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                      ann.priority === 'HIGH' ? "bg-red-500/10 text-red-500 border border-red-500/20" : 
                      "bg-primary-500/10 text-primary-500 border border-primary-500/20"
                    )}>
                      {ann.priority || 'NORMAL'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold">{ann.title}</td>
                  <td className="px-6 py-4 text-secondary-400 max-w-md truncate">{ann.message}</td>
                  <td className="px-6 py-4 text-secondary-500 font-mono text-xs">{new Date(ann.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-secondary-500 hover:text-red-400 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && announcements.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-secondary-500 italic">No historical announcements found.</td>
                </tr>
              ) }
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={totalPages}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Broadcast Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-secondary-950/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="glass w-full max-w-lg rounded-[2.5rem] p-8 border-white/10 relative z-10 animate-in zoom-in-95 overflow-hidden">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary-600/20 rounded-2xl text-primary-400">
                  <Megaphone size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold italic uppercase tracking-tighter">Broadcast Update</h3>
                  <p className="text-xs text-secondary-500">Send a notification to all project purchasers</p>
                </div>
              </div>

              <form onSubmit={handleBroadcast} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black text-secondary-500 uppercase tracking-widest ml-1">Announcement Title</label>
                  <input 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Phase 2 Road Taring Commencement"
                    className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:ring-4 focus:ring-primary-600/20 transition-all font-bold"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black text-secondary-500 uppercase tracking-widest ml-1">Priority Level</label>
                  <div className="flex gap-4">
                    {['LOW', 'NORMAL', 'HIGH'].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p as any)}
                        className={cn(
                          "flex-1 py-3 rounded-xl text-xs font-bold transition-all border",
                          priority === p 
                            ? "bg-secondary-800 text-white border-white/20 shadow-xl" 
                            : "bg-secondary-950 text-secondary-600 border-white/5 hover:border-white/10"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black text-secondary-500 uppercase tracking-widest ml-1">Message Content</label>
                  <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Provide full details of the update..."
                    className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:ring-4 focus:ring-primary-600/20 transition-all resize-none leading-relaxed"
                    required
                  ></textarea>
                </div>

                {error && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-2xl bg-primary-600/5 border border-primary-500/10 flex items-start gap-3">
                    <Info size={16} className="text-primary-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-secondary-400 leading-relaxed italic">
                      This broadcast will be visible instantly to all purchasers on their private portal. It will also trigger in-app notifications.
                    </p>
                  </div>
                  <button 
                    type="submit"
                    disabled={modalLoading}
                    className="w-full py-5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-primary-600/20 active:scale-95"
                  >
                    {modalLoading ? 'Broadcasting...' : 'Confirm & Broadcast Now'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageAnnouncements;
