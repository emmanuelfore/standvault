import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin,
  FileText,
  History,
  CreditCard,
  Shield,
  Download,
  Plus,
  MoreVertical,
  ExternalLink,
  Calendar,
  Printer,
  MailCheck,
  Edit3,
  KeyRound,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';
import { useProject } from '../contexts/ProjectContext';
import PaymentModal from '../components/PaymentModal';
import EditBuyerModal from '../components/EditBuyerModal';
import AddFeeModal from '../components/AddFeeModal';
import ConfirmScheduleModal from '../components/ConfirmScheduleModal';
import AddDocumentModal from '../components/AddDocumentModal';
import TablePagination from '../components/TablePagination';
import { usePagination } from '../hooks/usePagination';
import SetPasswordModal from '../components/SetPasswordModal';

const toAmount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const tabs = [
  { id: 'ledger', label: 'Transactions', icon: CreditCard },
  { id: 'fees', label: 'Fee Settlement', icon: History },
  { id: 'schedule', label: 'Payment Plan', icon: Calendar },
  { id: 'documents', label: 'Document Vault', icon: FileText },
  { id: 'audit', label: 'Audit Trail', icon: ExternalLink },
  { id: 'profile', label: 'Account Details', icon: Shield },
];

const BuyerProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedProject } = useProject();
  const [activeTab, setActiveTab] = useState('ledger');
  const [buyer, setBuyer] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
  const [isConfirmScheduleModalOpen, setIsConfirmScheduleModalOpen] = useState(false);
  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
  const [sendingAccess, setSendingAccess] = useState(false);
  const [accessMessage, setAccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isGeneratingSchedule] = useState(false);
  const [asAtDate, setAsAtDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [buyerRes, ledgerRes, docsRes, scheduleRes] = await Promise.all([
        api.get(`/buyers/${id}`),
        api.get(`/buyers/${id}/ledger`),
        api.get(`/buyers/${id}/documents`),
        api.get(`/buyers/${id}/schedule`).catch(() => ({ data: null }))
      ]);
      
      setBuyer(buyerRes.data);
      setLedger(ledgerRes.data);
      setDocuments(docsRes.data);
      setSchedule(scheduleRes.data || buyerRes.data?.schedules?.[0] || null);

      if (selectedProject) {
         const auditRes = await api.get(`/projects/${selectedProject.id}/audit-logs?entity_id=${id}`);
         setAuditLogs(auditRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch buyer data', err);
    } finally {
      setLoading(false);
    }
  }, [id, selectedProject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab && tabs.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  const handleGenerateSchedule = async () => {
    setIsConfirmScheduleModalOpen(true);
  };

  const handlePrintStatement = () => {
    window.print();
  };

  const handleSendAccess = async () => {
    if (!selectedProject || !buyer?.id) return;
    setSendingAccess(true);
    setAccessMessage('');
    try {
      const response = await api.post(`/projects/${selectedProject.id}/buyer-accounts/${buyer.id}/send-access`);
      setAccessMessage(response.data.mode === 'invite' ? 'Invitation email sent.' : 'Password reset email sent.');
    } catch (err: any) {
      setAccessMessage(err.response?.data?.error || 'Failed to send access email.');
    } finally {
      setSendingAccess(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!buyer || !id) return;
    if (!window.confirm(`Are you SURE you want to permanently delete the account for ${buyer.first_name} ${buyer.last_name}? This will destroy all financial records and reset the stand status. This action CANNOT be undone.`)) {
       return;
    }

    setIsDeleting(true);
    try {
      await api.delete(`/buyers/${id}`);
      navigate('/buyers');
    } catch (err: any) {
      console.error('Failed to delete account', err);
      alert(err.response?.data?.error || 'Failed to delete account');
      setIsDeleting(false);
    }
  };



  const displayLedger = useMemo(() => {
    // 1. Create virtual "Opening Balance" entry (Stand Value + Expected Interest)
    const standPrincipal = Number(buyer?.stand?.size_sqm || 0) * Number(buyer?.stand?.price_per_sqm || 0);
    const totalInterest = schedule?.periods?.reduce((acc: number, p: any) => acc + Number(p.interest_expected || 0), 0) || 0;
    const contractValue = standPrincipal + totalInterest;

    const openingBalanceEntry = {
        id: 'opening-balance',
        amount: contractValue,
        effective_date: buyer?.allocation_date || buyer?.created_at || new Date().toISOString(),
        description: 'Stand Purchase Agreement',
        entry_type: 'DEBIT',
        is_verified: true,
        sourceType: 'VIRTUAL'
    };

    // 2. Identify Deposit: Mark the first verified payment as Deposit
    const sortedVerifiedLedger = [...(ledger || [])]
        .filter(e => e.entry_type === 'PAYMENT' && e.is_verified)
        .sort((a, b) => new Date(a.effective_date || a.created_at).getTime() - new Date(b.effective_date || b.created_at).getTime());
    
    const firstPaymentId = sortedVerifiedLedger[0]?.id;

    const combined = [
        openingBalanceEntry,
        ...ledger.map(l => ({
            ...l,
            isDeposit: l.id === firstPaymentId && l.allocation_type === 'STAND'
        }))
    ].sort((a, b) => {
        const dateA = new Date(a.effective_date).getTime();
        const dateB = new Date(b.effective_date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        // If dates are same, DEBIT (opening) should come first
        if (a.id === 'opening-balance') return -1;
        if (b.id === 'opening-balance') return 1;
        return 0;
    });

    let runningBalance = 0;
    let totalPoolCounted = 0;
    const depositRequired = standPrincipal * (buyer?.config?.deposit_pct / 100 || 0);

    return combined.map(entry => {
        let allocationBreakdown = "";
        const amount = Number(entry.amount);

        if (entry.entry_type === 'DEBIT' || entry.entry_type === 'FEE' || entry.entry_type === 'PENALTY' || entry.entry_type === 'REVERSAL') {
            runningBalance += amount;
        } else if (entry.entry_type === 'PAYMENT' && entry.is_verified) {
            runningBalance -= amount;
            
            // Calculate virtual allocation
            const startOfPayment = totalPoolCounted;
            const endOfPayment = totalPoolCounted + amount;
            
            if (startOfPayment < depositRequired) {
                allocationBreakdown = "DEPOSIT";
            }
            
            let periodEdge = depositRequired;
            schedule?.periods?.forEach((p: any) => {
                const pTotal = Number(p.total_expected);
                const pStart = periodEdge;
                const pEnd = periodEdge + pTotal;
                
                if (endOfPayment > pStart && startOfPayment < pEnd) {
                    if (allocationBreakdown) allocationBreakdown += ", ";
                    allocationBreakdown += `PERIOD ${p.period_number}`;
                }
                periodEdge = pEnd;
            });
            
            totalPoolCounted += amount;
        }

        return { ...entry, runningBalance, allocationBreakdown };
    });
  }, [ledger, buyer, schedule]);

  const filteredLedger = useMemo(() => {
    if (!asAtDate) return displayLedger;
    const limit = new Date(`${asAtDate}T23:59:59`).getTime();
    return displayLedger.filter(entry => {
        const date = new Date(entry.effective_date).getTime();
        return date <= limit;
    });
  }, [displayLedger, asAtDate]);

  const {
    currentPage: ledgerPage,
    pageSize: ledgerPageSize,
    paginatedItems: paginatedLedger,
    rangeEnd: ledgerRangeEnd,
    rangeStart: ledgerRangeStart,
    totalItems: ledgerTotalItems,
    totalPages: ledgerTotalPages,
    setCurrentPage: setLedgerPage,
    setPageSize: setLedgerPageSize,
  } = usePagination(filteredLedger, 10);

  const schedulePeriods = schedule?.periods || [];

  const {
    currentPage: schedulePage,
    pageSize: schedulePageSize,
    paginatedItems: paginatedSchedulePeriods,
    rangeEnd: scheduleRangeEnd,
    rangeStart: scheduleRangeStart,
    totalItems: scheduleTotalItems,
    totalPages: scheduleTotalPages,
    setCurrentPage: setSchedulePage,
    setPageSize: setSchedulePageSize,
  } = usePagination(schedulePeriods, 10);

  const feeStats = useMemo(() => {
    const fees = ledger.filter(e => (e.entry_type === 'FEE' || e.entry_type === 'PENALTY'));
    return fees.map(fee => {
        // Sum verified payments allocated to this fee
        const paymentsAllocated = ledger
            .filter(e => e.entry_type === 'PAYMENT' && e.allocation_target_id === fee.id && e.is_verified);
        const paymentsTotal = paymentsAllocated.reduce((sum, e) => sum + Number(e.amount), 0);
        
        // Sum reversals that target those payments
        const paymentIds = paymentsAllocated.map(p => p.id);
        const reversalsTotal = ledger
            .filter(e => e.entry_type === 'REVERSAL' && e.reverses_id && paymentIds.includes(e.reverses_id) && e.is_verified)
            .reduce((sum, e) => sum + Number(e.amount), 0);

        const allocated = paymentsTotal - reversalsTotal;
        return {
            ...fee,
            paid: allocated,
            remaining: Math.max(0, Number(fee.amount) - allocated)
        };
    }).sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());
  }, [ledger]);

  const {
    currentPage: feePage,
    pageSize: feePageSize,
    paginatedItems: paginatedFees,
    rangeEnd: feeRangeEnd,
    rangeStart: feeRangeStart,
    totalItems: feeTotalItems,
    totalPages: feeTotalPages,
    setCurrentPage: setFeePage,
    setPageSize: setFeePageSize,
  } = usePagination(feeStats, 10);

  useEffect(() => {
    setLedgerPage(1);
  }, [asAtDate, setLedgerPage]);

  if (loading) return <div className="p-12 text-center animate-pulse">Loading profile...</div>;
  if (!buyer) return <div className="p-12 text-center">Buyer not found.</div>;

  const totalPaid = ledger
    .filter(e => e.is_verified)
    .reduce((sum, e) => {
        if (e.entry_type === 'PAYMENT') return sum + Number(e.amount);
        if (e.entry_type === 'REVERSAL') return sum - Number(e.amount);
        return sum;
    }, 0);
  
  const totalPrice = Number(buyer.stand.size_sqm) * Number(buyer.stand.price_per_sqm);
  const totalInterest = schedule?.periods?.reduce((acc: number, p: any) => acc + Number(p.interest_expected || 0), 0) || 0;
  const totalContractValue = totalPrice + totalInterest;

  const totalCharges = ledger
    .filter(e => (e.entry_type === 'FEE' || e.entry_type === 'PENALTY'))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const remainingBalance = Math.max(0, (totalContractValue + totalCharges) - totalPaid);

  return (
    <div className="flex flex-col gap-8 animate-in">
      <div className="print:hidden space-y-8 contents">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-4">
          <Link to="/buyers" className="flex items-center gap-2 text-secondary-400 hover:text-white transition-colors w-fit">
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back to Purchases & Allocations</span>
          </Link>
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-primary-600/20">
              {(buyer.first_name?.[0] || '')}{(buyer.last_name?.[0] || '')}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{buyer.first_name} {buyer.last_name}</h1>
                <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black tracking-widest border border-blue-500/20">
                  {buyer.payment_status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-secondary-400 text-sm">
                <span className="flex items-center gap-1.5"><MapPin size={14} /> Stand {buyer.stand?.stand_number}</span>
                <span className="flex items-center gap-1.5"><Mail size={14} /> {buyer.user?.email}</span>
                <span className="flex items-center gap-1.5"><Phone size={14} /> {buyer.phone_number}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintStatement}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center gap-2"
          >
            <Printer size={16} /> Print Statement
          </button>
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all active:scale-95"
          >
            Edit Profile
          </button>
          <button 
            onClick={() => setIsPaymentModalOpen(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary-600/20 active:scale-95"
          >
            Record Payment
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
        <div className="glass p-6 rounded-2xl">
          <p className="text-secondary-400 text-xs font-bold uppercase tracking-wider">Total Contract Value</p>
          <h3 className="text-2xl font-bold mt-1 text-white">${totalContractValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
        </div>
        <div className="glass p-6 rounded-2xl border-l-4 border-l-green-500">
          <p className="text-secondary-400 text-xs font-bold uppercase tracking-wider">Total Amount Paid</p>
          <h3 className="text-2xl font-bold mt-1 text-green-400">
            ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-xs font-medium ml-2 text-secondary-500">
              ({((totalPaid / (totalContractValue + totalCharges)) * 100).toFixed(1)}%)
            </span>
          </h3>
          <div className="w-full bg-secondary-900 h-1.5 rounded-full mt-3 overflow-hidden">
             <div 
               className="bg-green-500 h-full transition-all duration-1000" 
               style={{ width: `${Math.min(100, (totalPaid / (totalContractValue + totalCharges)) * 100)}%` }}
             ></div>
          </div>
        </div>
        <div className="glass p-6 rounded-2xl border-l-4 border-l-primary-500">
          <p className="text-secondary-400 text-xs font-bold uppercase tracking-wider">Remaining Balance</p>
          <h3 className="text-2xl font-bold mt-1 text-primary-400">${remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
        </div>
      </div>

      {/* Missing Schedule Alert */}
      {!schedule && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse shadow-xl shadow-orange-600/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
              <Calendar size={24} />
            </div>
            <div>
              <h4 className="font-bold text-orange-400">Action Required: No Active Payment Plan</h4>
              <p className="text-sm text-secondary-400 mt-1">This purchaser has been allocated a stand but does not have a payment schedule yet. Monthly installments cannot be tracked until a plan is generated.</p>
            </div>
          </div>
          <button 
            onClick={handleGenerateSchedule}
            className="w-full md:w-auto px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-orange-500/20"
          >
            Create Payment Plan Now
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl w-fit border border-white/5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                activeTab === tab.id 
                  ? "bg-secondary-800 text-white shadow-lg" 
                  : "text-secondary-500 hover:text-secondary-200"
              )}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="glass rounded-3xl min-h-[400px] overflow-hidden">
          {activeTab === 'ledger' && (
            <div className="animate-in">
              <div className="p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5">
                <div>
                  <h3 className="font-bold">Transaction History</h3>
                  <p className="text-xs text-secondary-500 mt-0.5">Full record of payments, fees, and reversals</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-secondary-500 tracking-widest">Balance As At:</span>
                    <input 
                      type="date"
                      value={asAtDate}
                      onChange={(e) => setAsAtDate(e.target.value)}
                      className="bg-secondary-950 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-600/50 text-white"
                    />
                  </div>
                  <button 
                    onClick={() => setIsFeeModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-orange-600/20"
                  >
                    <Plus size={16} /> Apply Fee
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-secondary-500 text-[10px] font-black uppercase tracking-widest border-b border-white/10">
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Reference</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4 text-right">Debit</th>
                      <th className="px-6 py-4 text-right">Credit</th>
                      <th className="px-6 py-4 text-right">Running Balance</th>
                      <th className="px-6 py-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {paginatedLedger.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-secondary-400">{new Date(entry.effective_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 font-medium italic">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    {entry.isDeposit ? (
                                        <>
                                            <span>Deposit Payment</span>
                                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[8px] font-black tracking-widest border border-blue-500/20">DEPOSIT</span>
                                        </>
                                    ) : (
                                        <span>{entry.description || 'No description'}</span>
                                    )}
                                </div>
                                {entry.allocationBreakdown && (
                                    <div className="text-[9px] font-bold text-secondary-500 flex items-center gap-1.5 uppercase tracking-tighter">
                                        <History size={10} />
                                        Applied to: <span className="text-secondary-400">{entry.allocationBreakdown}</span>
                                    </div>
                                )}
                            </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter",
                            entry.entry_type === 'PAYMENT' ? 'bg-green-500/10 text-green-400' : 
                            entry.entry_type === 'FEE' ? 'bg-orange-500/10 text-orange-400' : 
                            entry.entry_type === 'DEBIT' ? 'bg-primary-500/10 text-primary-400' :
                            'bg-blue-500/10 text-blue-400'
                          )}>
                            {entry.entry_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {(entry.entry_type === 'FEE' || entry.entry_type === 'PENALTY' || entry.entry_type === 'DEBIT') ? `$${Number(entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {entry.entry_type === 'PAYMENT' ? `$${Number(entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-white">
                          ${Number(entry.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            {entry.pop_submissions?.[0] && (
                                <a 
                                    href={entry.pop_submissions[0].file_url} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    title="View Proof of Payment"
                                    className="p-1.5 rounded-lg bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 transition-all"
                                >
                                    <FileText size={14} />
                                </a>
                            )}
                            <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                entry.is_verified ? "bg-secondary-800 text-secondary-400" : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                            )}>
                                {entry.is_verified ? 'Verified' : 'Pending'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredLedger.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-secondary-500 italic">No statement entries found for this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={ledgerPage}
                pageSize={ledgerPageSize}
                totalItems={ledgerTotalItems}
                totalPages={ledgerTotalPages}
                rangeStart={ledgerRangeStart}
                rangeEnd={ledgerRangeEnd}
                onPageChange={setLedgerPage}
                onPageSizeChange={setLedgerPageSize}
              />
            </div>
          )}

          {activeTab === 'fees' && (
            <div className="animate-in">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="font-bold">Fee Settlement Status</h3>
                  <p className="text-xs text-secondary-500 mt-0.5">Tracking payment allocations to project fees</p>
                </div>
                <button 
                  onClick={() => setIsFeeModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary-800 hover:bg-secondary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <Plus size={14} /> Add New Fee
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] uppercase tracking-widest text-secondary-500 bg-white/5">
                    <tr>
                      <th className="px-6 py-4 font-black">Fee Description</th>
                      <th className="px-6 py-4 font-black">Date Listed</th>
                      <th className="px-6 py-4 font-black text-right">Total Fee</th>
                      <th className="px-6 py-4 font-black text-right">Amount Paid</th>
                      <th className="px-6 py-4 font-black text-right">Remaining</th>
                      <th className="px-6 py-4 font-black">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFees.map((fee) => (
                      <tr key={fee.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                            <div className="font-bold">{fee.description}</div>
                            <div className="text-[10px] text-secondary-500 uppercase tracking-tighter mt-0.5">{fee.allocation_type || 'General'}</div>
                        </td>
                        <td className="px-6 py-4 text-secondary-400">
                          {new Date(fee.effective_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-white">
                          ${Number(fee.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right text-green-400 font-bold">
                          ${fee.paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right text-primary-400 font-bold">
                          ${fee.remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5 min-w-[120px]">
                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                                <span className={fee.remaining === 0 ? "text-green-400" : "text-secondary-500"}>
                                    {fee.remaining === 0 ? 'Settled' : 'Outstanding'}
                                </span>
                                <span className="text-secondary-400">{Math.round((fee.paid / Number(fee.amount)) * 100)}%</span>
                            </div>
                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                    className={cn(
                                        "h-full rounded-full transition-all duration-500",
                                        fee.remaining === 0 ? "bg-green-500" : "bg-primary-500"
                                    )}
                                    style={{ width: `${(fee.paid / Number(fee.amount)) * 100}%` }}
                                />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {feeStats.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-secondary-500 italic">No additional fees or penalties recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={feePage}
                pageSize={feePageSize}
                totalItems={feeTotalItems}
                totalPages={feeTotalPages}
                rangeStart={feeRangeStart}
                rangeEnd={feeRangeEnd}
                onPageChange={setFeePage}
                onPageSizeChange={setFeePageSize}
              />
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="animate-in">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="font-bold">Payment Plan</h3>
                  <p className="text-xs text-secondary-500 mt-0.5">Projected instalments and milestones</p>
                </div>
                {!schedule && (
                  <button 
                    onClick={handleGenerateSchedule}
                    disabled={isGeneratingSchedule}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {isGeneratingSchedule ? 'Creating...' : 'Create Payment Plan'}
                  </button>
                )}
              </div>
              {!schedule ? (
                <div className="p-12 text-center flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-secondary-600">
                    <Calendar size={32} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">No Payment Plan Created</h4>
                    <p className="text-secondary-500 max-w-sm mx-auto mt-2">This purchaser does not have an active payment plan yet. Create one to set up their monthly instalments.</p>
                  </div>
                  <button 
                    onClick={handleGenerateSchedule}
                    className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold mt-2 shadow-lg shadow-primary-600/20"
                  >
                    Create Payment Plan Now
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-secondary-500 text-[10px] font-black uppercase tracking-widest border-b border-white/10">
                          <th className="px-6 py-4">#</th>
                          <th className="px-6 py-4">Due Date</th>
                          <th className="px-6 py-4 text-right">Principal</th>
                          <th className="px-6 py-4 text-right">Interest</th>
                          <th className="px-6 py-4 text-right font-black text-white">Total Due</th>
                          <th className="px-6 py-4 text-right">Paid</th>
                          <th className="px-6 py-4 text-right">Balance</th>
                          <th className="px-6 py-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-sm">
                        {paginatedSchedulePeriods.map((p: any) => {
                          const principalExpected = toAmount(p.principal_expected);
                          const interestExpected = toAmount(p.interest_expected);
                          const totalExpected = toAmount(p.total_expected);
                          const paidAmount = toAmount(p.paid_amount);
                          const balance = Math.max(0, totalExpected - paidAmount);
                          return (
                          <tr key={p.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 text-secondary-500 font-bold">{p.period_number}</td>
                            <td className="px-6 py-4 font-medium">{new Date(p.due_date).toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-right font-mono text-secondary-400">${principalExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-6 py-4 text-right font-mono text-secondary-400">${interestExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-white">${totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-6 py-4 text-right font-mono text-green-400">${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-6 py-4 text-right font-mono text-secondary-400">${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-6 py-4 text-right">
                               <span className={cn(
                                 "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter",
                                 p.status === 'PAID' ? 'bg-green-500/10 text-green-400' : 
                                 p.status === 'PARTIAL' ? 'bg-orange-500/10 text-orange-400' : 
                                 'bg-red-500/10 text-red-400'
                               )}>
                                 {p.status}
                               </span>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination
                    currentPage={schedulePage}
                    pageSize={schedulePageSize}
                    totalItems={scheduleTotalItems}
                    totalPages={scheduleTotalPages}
                    rangeStart={scheduleRangeStart}
                    rangeEnd={scheduleRangeEnd}
                    onPageChange={setSchedulePage}
                    onPageSizeChange={setSchedulePageSize}
                  />
                </>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="p-8 animate-in grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((doc, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-4 glass-hover group">
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-xl bg-primary-600/10 text-primary-400">
                      <FileText size={24} />
                    </div>
                    <button className="text-secondary-500 hover:text-white transition-colors">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm truncate">{doc.title}</h4>
                    <p className="text-[10px] text-secondary-500 uppercase font-black mt-1 tracking-widest">{doc.document_type} • {new Date(doc.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/5">
                    <span className="text-xs text-secondary-500">V{doc.versions?.[0]?.version_number || 1}</span>
                    <div className="flex gap-2">
                       <a href={doc.versions?.[0]?.file_url} target="_blank" rel="noreferrer" className="p-1.5 text-secondary-400 hover:text-white"><Download size={16} /></a>
                       <a href={doc.versions?.[0]?.file_url} target="_blank" rel="noreferrer" className="p-1.5 text-secondary-400 hover:text-white"><ExternalLink size={16} /></a>
                    </div>
                  </div>
                </div>
              ))}
              <button 
                onClick={() => setIsAddDocModalOpen(true)}
                className="p-8 rounded-2xl border-2 border-dashed border-white/10 hover:border-primary-500/50 hover:bg-primary-500/5 transition-all group flex flex-col items-center justify-center gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-secondary-500 group-hover:text-primary-400 group-hover:bg-primary-500/10 transition-all">
                  <Plus size={24} />
                </div>
                <span className="text-sm font-bold text-secondary-400 group-hover:text-primary-400">Upload Document</span>
              </button>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="p-6 animate-in">
              <div className="flex flex-col gap-6">
                {auditLogs.map((log, i) => (
                  <div key={i} className="flex gap-4 relative">
                    {i !== auditLogs.length - 1 && <div className="absolute left-[15px] top-8 bottom-[-24px] w-px bg-white/10"></div>}
                    <div className="w-8 h-8 rounded-full bg-secondary-800 flex items-center justify-center z-10 border border-white/10">
                      <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                    </div>
                    <div className="flex-1 pb-8">
                       <div className="flex items-center justify-between">
                         <p className="text-sm font-bold text-white">{log.action}</p>
                         <span className="text-[10px] text-secondary-500 font-mono">{new Date(log.created_at).toLocaleString()}</span>
                       </div>
                       <p className="text-xs text-secondary-400 mt-1">
                         Initiated by <span className="font-semibold text-secondary-200">{log.user?.email || 'System'}</span> on <span className="text-secondary-200 italic">{log.entity_type}</span>
                       </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="p-8 animate-in grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="flex flex-col gap-8">
                 <h4 className="text-lg font-bold border-b border-white/10 pb-2">Personal Information</h4>
                 <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs text-secondary-500 font-bold uppercase tracking-wider">First Name</p>
                      <p className="font-medium mt-1">{buyer.first_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-secondary-500 font-bold uppercase tracking-wider">Last Name</p>
                      <p className="font-medium mt-1">{buyer.last_name}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-secondary-500 font-bold uppercase tracking-wider">Email Address</p>
                      <p className="font-medium mt-1">{buyer.user?.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-secondary-500 font-bold uppercase tracking-wider">National ID</p>
                      <p className="font-medium mt-1 tracking-widest">{buyer.id_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-secondary-500 font-bold uppercase tracking-wider">Phone</p>
                      <p className="font-medium mt-1">{buyer.phone_number}</p>
                    </div>
                 </div>
                 <div className="p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-bold">Portal Account</h4>
                        <p className="text-xs text-secondary-500 mt-1">Manage the purchaser login and access email.</p>
                      </div>
                      <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                      >
                        <Edit3 size={16} />
                        Edit Account
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <p className="text-xs text-secondary-500 font-bold uppercase tracking-wider">Login Email</p>
                        <p className="font-medium mt-1">{buyer.user?.email}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          onClick={handleSendAccess}
                          disabled={sendingAccess || !selectedProject}
                          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/40 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                        >
                          <MailCheck size={16} />
                          {sendingAccess ? 'Sending...' : 'Send Access Email'}
                        </button>
                        <button
                          onClick={() => setIsPasswordModalOpen(true)}
                          className="px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                        >
                          <KeyRound size={16} />
                          Set Custom Password
                        </button>
                        <button
                          onClick={handleDeleteAccount}
                          disabled={isDeleting}
                          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 border border-red-500/20 text-red-400 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                        >
                          {isDeleting ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          {isDeleting ? 'Deleting...' : 'Delete Account'}
                        </button>
                      </div>
                      {accessMessage && (
                        <p className="text-sm text-secondary-300">{accessMessage}</p>
                      )}
                    </div>
                 </div>
              </div>
              <div className="flex flex-col gap-8">
                 <h4 className="text-lg font-bold border-b border-white/10 pb-2">Stand Allocation</h4>
                 <div className="p-6 rounded-2xl bg-primary-600/5 border border-primary-500/10 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-secondary-400 font-bold uppercase tracking-wider">Stand Details</span>
                       <span className="px-2 py-0.5 rounded bg-primary-600 text-[10px] font-black tracking-widest uppercase">Verified</span>
                    </div>
                    <div className="flex flex-col gap-2">
                       <h3 className="text-3xl font-black italic">{buyer.stand.stand_number}</h3>
                       <p className="text-sm text-secondary-400">{buyer.stand.size_sqm} Square Meters @ ${buyer.stand.price_per_sqm}/sqm</p>
                    </div>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <PaymentModal 
        isOpen={isPaymentModalOpen} 
        onClose={() => setIsPaymentModalOpen(false)}
        buyerId={id!}
        buyerName={`${buyer.first_name} ${buyer.last_name}`}
        onSuccess={fetchData}
      />

      <EditBuyerModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        buyer={buyer}
        onSuccess={fetchData}
      />

      <AddFeeModal
        isOpen={isFeeModalOpen}
        onClose={() => setIsFeeModalOpen(false)}
        buyerId={id!}
        buyerName={`${buyer.first_name} ${buyer.last_name}`}
        onSuccess={fetchData}
      />

      <SetPasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        buyer={buyer}
        onSuccess={fetchData}
      />
      </div>

      <ConfirmScheduleModal
        isOpen={isConfirmScheduleModalOpen}
        onClose={() => setIsConfirmScheduleModalOpen(false)}
        buyerId={id!}
        buyerName={`${buyer.first_name} ${buyer.last_name}`}
        onSuccess={() => {
          fetchData();
          setActiveTab('schedule');
        }}
      />

      <AddDocumentModal
        isOpen={isAddDocModalOpen}
        onClose={() => setIsAddDocModalOpen(false)}
        buyerId={id!}
        buyerName={`${buyer.first_name} ${buyer.last_name}`}
        onSuccess={fetchData}
      />      {/* Simplified Print-only Statement - Vertical Clean Layout */}
      <div className="hidden print:block bg-white text-secondary-900 p-0 min-h-screen font-sans">
        <div className="p-16 space-y-16">
            {/* Simple Branded Header */}
            <div className="flex justify-between items-start border-b border-secondary-100 pb-12">
               <div>
                  <h1 className="text-2xl font-black tracking-tight text-primary-600">STANDVAULT</h1>
                  <p className="text-[10px] font-bold text-secondary-400 tracking-[0.3em] uppercase mt-1">Property Systems</p>
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-black text-secondary-400 uppercase tracking-widest">Statement of Account</p>
                  <p className="text-xs font-bold text-secondary-600 mt-1">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
               </div>
            </div>

            {/* Vertical Info Blocks */}
            <div className="grid grid-cols-2 gap-20">
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400 mb-4">Purchaser</p>
                  <p className="text-3xl font-black">{buyer.first_name} {buyer.last_name}</p>
                  <p className="text-sm text-secondary-500 mt-2 font-medium">ID: {buyer.id_number}</p>
                  <p className="text-sm text-secondary-500 font-medium">{buyer.user?.email}</p>
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400 mb-4">Allocation</p>
                  <p className="text-3xl font-black">Stand {buyer.stand?.stand_number}</p>
                  <p className="text-sm text-secondary-500 mt-2 font-medium">{buyer.stand?.size_sqm}m² Area @ ${buyer.stand?.price_per_sqm}/m²</p>
                  <p className="text-[10px] font-black text-primary-600 mt-2 uppercase tracking-tight">{buyer.stand?.project?.name}</p>
               </div>
            </div>

            {/* Linear Summary (No boxes) */}
            <div className="border-y border-secondary-100 py-12 grid grid-cols-4 gap-4">
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400 mb-2">Stand Value</p>
                   <p className="text-2xl font-black">${totalContractValue.toLocaleString()}</p>
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400 mb-2">Project Fees</p>
                   <p className="text-2xl font-black">${totalCharges.toLocaleString()}</p>
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-2">Total Paid</p>
                   <p className="text-2xl font-black text-green-600">${totalPaid.toLocaleString()}</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black uppercase tracking-widest text-primary-600 mb-2">Outstanding Balance</p>
                   <p className="text-4xl font-black text-primary-600">${remainingBalance.toLocaleString()}</p>
                </div>
            </div>

            {/* Simple Ledger Table */}
            <div className="space-y-8">
                <h3 className="text-xs font-black uppercase tracking-widest text-secondary-900 border-b border-secondary-900 pb-4">Transaction History</h3>
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-secondary-400 text-[10px] font-black uppercase tracking-widest">
                            <th className="pb-6">Effective Date</th>
                            <th className="pb-6">Description</th>
                            <th className="pb-6">Entry Type</th>
                            <th className="pb-6 text-right">Amount (USD)</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {displayLedger.filter(e => e.is_verified).map((entry, idx) => (
                            <tr key={idx} className="border-b border-secondary-50">
                                <td className="py-6 text-secondary-500 font-medium">{new Date(entry.effective_date).toLocaleDateString()}</td>
                                <td className="py-6 font-bold text-secondary-900 uppercase tracking-tight">
                                    {entry.isDeposit ? 'DEPOSIT PAYMENT' : entry.description}
                                </td>
                                <td className="py-6">
                                    <span className="text-[10px] font-black uppercase text-secondary-400">
                                        {entry.entry_type}
                                    </span>
                                </td>
                                <td className="py-6 text-right font-black text-secondary-900 text-lg">
                                    ${Number(entry.amount).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Minimal Footer */}
            <div className="pt-20 mt-auto border-t border-secondary-100 text-center">
                <p className="text-[10px] font-black text-secondary-300 uppercase tracking-[1em]">OFFICIAL RECORD</p>
                <p className="text-[9px] text-secondary-400 mt-4 leading-relaxed max-w-lg mx-auto italic">
                   Certified statement of account issued by StandVault. Reflects verified financial transactions as of certification date. Reference: {buyer.id.toUpperCase()}
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default BuyerProfile;
