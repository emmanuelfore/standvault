import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Mail, RefreshCw, Search, User, Edit3, KeyRound, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useProject } from '../contexts/ProjectContext';
import TablePagination from '../components/TablePagination';
import { usePagination } from '../hooks/usePagination';
import SetPasswordModal from '../components/SetPasswordModal';

type BuyerAccount = {
  buyer_id: string;
  purchaser_name: string;
  email: string;
  stand_number: string;
  has_local_account: boolean;
  has_supabase_account: boolean;
  auth_status: 'ACTIVE' | 'INVITED' | 'NOT_PROVISIONED';
  last_sign_in_at: string | null;
  supabase_user_id: string | null;
};

const BuyerAccounts = () => {
  const navigate = useNavigate();
  const { selectedProject } = useProject();
  const [accounts, setAccounts] = useState<BuyerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingBuyerId, setSendingBuyerId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BuyerAccount['auth_status']>('ALL');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [selectedBuyer, setSelectedBuyer] = useState<any>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const fetchAccounts = async () => {
    if (!selectedProject) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/projects/${selectedProject.id}/buyer-accounts`);
      setAccounts(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load buyer accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [selectedProject]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const haystack = `${account.purchaser_name} ${account.email} ${account.stand_number}`.toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || account.auth_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [accounts, search, statusFilter]);

  const {
    currentPage,
    pageSize,
    paginatedItems: paginatedAccounts,
    rangeEnd,
    rangeStart,
    totalItems,
    totalPages,
    setCurrentPage,
    setPageSize,
  } = usePagination(filteredAccounts, 10);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, setCurrentPage, statusFilter]);

  const handleSendAccess = async (buyerId: string) => {
    if (!selectedProject) return;
    setSendingBuyerId(buyerId);
    setError('');
    setMessage('');
    try {
      const response = await api.post(`/projects/${selectedProject.id}/buyer-accounts/${buyerId}/send-access`);
      setMessage(response.data.mode === 'invite' ? 'Invitation email sent.' : 'Password reset email sent.');
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send access email');
    } finally {
      setSendingBuyerId('');
    }
  };

  const handleDeleteAccount = async (buyerId: string, name: string) => {
    if (!window.confirm(`Are you SURE you want to permanently delete the account for ${name}? This will destroy all financial records and reset the stand status. This action CANNOT be undone.`)) {
       return;
    }

    setDeletingIds(prev => new Set(prev).add(buyerId));
    setError('');
    setMessage('');
    try {
      await api.delete(`/buyers/${buyerId}`);
      setMessage(`Account for ${name} has been deleted.`);
      fetchAccounts();
    } catch (err: any) {
      console.error('Delete failed:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to delete account';
      setError(name + ': ' + errorMsg);
      alert('Delete failed for ' + name + ': ' + errorMsg);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(buyerId);
        return next;
      });
    }
  };

  const statusClass = (status: BuyerAccount['auth_status']) => {
    if (status === 'ACTIVE') return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (status === 'INVITED') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    return 'bg-orange-500/10 text-orange-300 border-orange-500/20';
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold">Buyer Accounts</h1>
        <p className="text-secondary-400 mt-1">See portal account status, resend access emails, and confirm purchasers have working user accounts.</p>
      </div>

      <div className="glass rounded-2xl p-5 border border-white/10 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative max-w-xl flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by purchaser, stand, or email"
              className="w-full bg-secondary-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-600/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | BuyerAccount['auth_status'])}
            className="bg-secondary-950/50 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-600/50 text-sm font-bold"
          >
            <option value="ALL">All account statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INVITED">Invited</option>
            <option value="NOT_PROVISIONED">Needs Invite</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary-500">Accounts</p>
            <p className="text-2xl font-bold mt-2">{accounts.length}</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary-500">Active</p>
            <p className="text-2xl font-bold mt-2">{accounts.filter((account) => account.auth_status === 'ACTIVE').length}</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary-500">Needs Access</p>
            <p className="text-2xl font-bold mt-2">{accounts.filter((account) => account.auth_status !== 'ACTIVE').length}</p>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-green-300 text-sm flex items-center gap-3">
            <CheckCircle2 size={18} />
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-secondary-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4 border-b border-white/10">Purchaser</th>
                <th className="px-6 py-4 border-b border-white/10">Stand</th>
                <th className="px-6 py-4 border-b border-white/10">Email</th>
                <th className="px-6 py-4 border-b border-white/10">Account Status</th>
                <th className="px-6 py-4 border-b border-white/10">Last Sign In</th>
                <th className="px-6 py-4 border-b border-white/10">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {loading ? (
                Array(5).fill(0).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-white/10 rounded w-full"></div></td>
                  </tr>
                ))
              ) : paginatedAccounts.map((account) => (
                <tr key={account.buyer_id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-semibold">{account.purchaser_name}</td>
                  <td className="px-6 py-4">{account.stand_number}</td>
                  <td className="px-6 py-4 text-secondary-300">{account.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusClass(account.auth_status)}`}>
                      {account.auth_status === 'NOT_PROVISIONED' ? 'Needs Invite' : account.auth_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-secondary-400">
                    {account.last_sign_in_at ? new Date(account.last_sign_in_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => navigate(`/buyers/${account.buyer_id}`)}
                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold flex items-center gap-2"
                      >
                        <User size={14} />
                        Profile
                      </button>
                      <button
                        onClick={() => navigate(`/buyers/${account.buyer_id}?tab=profile`)}
                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold flex items-center gap-2"
                      >
                        <Edit3 size={14} />
                        Edit Account
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBuyer({ id: account.buyer_id, ...account });
                          setIsPasswordModalOpen(true);
                        }}
                        className="px-3 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 text-sm font-bold flex items-center gap-2"
                      >
                        <KeyRound size={14} />
                        Set Password
                      </button>
                      <button
                        onClick={() => handleSendAccess(account.buyer_id)}
                        disabled={sendingBuyerId === account.buyer_id}
                        className="px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/40 text-white text-sm font-bold flex items-center gap-2"
                      >
                        {sendingBuyerId === account.buyer_id ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                        Send Access
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(account.buyer_id, account.purchaser_name)}
                        disabled={deletingIds.has(account.buyer_id)}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 border border-red-500/20 text-red-400 transition-colors"
                        title="Delete Account"
                      >
                        {deletingIds.has(account.buyer_id) ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filteredAccounts.length === 0 && (
          <div className="p-10 text-center text-secondary-500">No buyer accounts found for this project.</div>
        )}
      </div>

      <SetPasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        buyer={selectedBuyer}
        onSuccess={fetchAccounts}
      />

      {!loading && (
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
      )}
    </div>
  );
};

export default BuyerAccounts;
