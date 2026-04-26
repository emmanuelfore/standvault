import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, Printer, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import TablePagination from '../components/TablePagination';
import { usePagination } from '../hooks/usePagination';

const PurchaserPayments = () => {
  const { user } = useAuth();
  const [showDetails, setShowDetails] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [asAtDate, setAsAtDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [buyer, setBuyer] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user?.buyerId) return;
      try {
        const [ledgerResponse, buyerResponse] = await Promise.all([
          api.get(`/buyers/${user.buyerId}/ledger`),
          api.get(`/buyers/${user.buyerId}`)
        ]);
        setTransactions(ledgerResponse.data);
        setBuyer(buyerResponse.data);

        try {
          const scheduleResponse = await api.get(`/buyers/${user.buyerId}/schedule`);
          setSchedule(scheduleResponse.data);
        } catch {
          setSchedule(null);
        }
      } catch (err) {
        console.error('Failed to fetch purchaser ledger', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [user?.buyerId]);

  const ledgerFilteredByAsAt = useMemo(() => {
    return transactions.filter(t => {
        const transactionDate = new Date(t.effective_date);
        return !asAtDate || transactionDate <= new Date(`${asAtDate}T23:59:59`);
    });
  }, [transactions, asAtDate]);

  const filteredTransactionsData = useMemo(() => {
    return ledgerFilteredByAsAt.filter((transaction) => {
      const matchesSearch = `${transaction.description} ${transaction.entry_type}`.toLowerCase().includes(search.toLowerCase());
      const normalizedType = transaction.entry_type === 'CHARGE' ? 'FEE' : transaction.entry_type;
      const matchesType = typeFilter === 'ALL' || normalizedType === typeFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'VERIFIED' ? transaction.is_verified : !transaction.is_verified);
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [ledgerFilteredByAsAt, search, statusFilter, typeFilter]);

  const runningTransactions = useMemo(() => {
    // 1. Create virtual "Opening Balance" entry
    const standPrincipal = Number(buyer?.stand?.size_sqm || 0) * Number(buyer?.stand?.price_per_sqm || 0);
    const totalInterest = schedule?.periods?.reduce((acc: number, p: any) => acc + Number(p.interest_expected || 0), 0) || 0;
    const contractValue = standPrincipal + totalInterest;

    const openingBalanceEntry = {
        id: 'opening-balance',
        amount: contractValue,
        description: 'Stand Purchase Agreement',
        entry_type: 'DEBIT',
        effective_date: buyer?.created_at,
        is_verified: true,
        sourceType: 'VIRTUAL'
    };

    // 2. Identify Deposit: Mark the first verified payment as Deposit
    const sortedVerifiedLedger = [...(ledgerFilteredByAsAt || [])]
        .filter(e => e.entry_type === 'PAYMENT' && e.is_verified)
        .sort((a, b) => new Date(a.effective_date || a.created_at).getTime() - new Date(b.effective_date || b.created_at).getTime());
    
    const firstPaymentId = sortedVerifiedLedger[0]?.id;

    let balance = 0;
    const combined = [
        openingBalanceEntry,
        ...filteredTransactionsData.map(l => ({
            ...l,
            isDeposit: l.id === firstPaymentId && l.allocation_type === 'STAND'
        }))
    ].sort((a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime());

    return combined.map((transaction) => {
        const amount = Number(transaction.amount);
        if (transaction.entry_type === 'PAYMENT') {
          balance -= amount;
        } else {
          balance += amount;
        }

        return {
          ...transaction,
          runningBalance: balance
        };
    });
  }, [filteredTransactionsData, ledgerFilteredByAsAt, buyer, schedule]);

  const {
    currentPage,
    pageSize,
    paginatedItems: paginatedTransactions,
    rangeEnd,
    rangeStart,
    totalItems,
    totalPages,
    setCurrentPage,
    setPageSize,
  } = usePagination(runningTransactions, 10);

  useEffect(() => {
    setCurrentPage(1);
  }, [asAtDate, search, setCurrentPage, statusFilter, typeFilter]);


  const downloadPrintableStatement = () => {
    window.print();
  };

  const totalPaid = transactions
    .filter((transaction) => transaction.is_verified)
    .reduce((sum, transaction) => {
        if (transaction.entry_type === 'PAYMENT') return sum + Number(transaction.amount);
        if (transaction.entry_type === 'REVERSAL') return sum - Number(transaction.amount);
        return sum;
    }, 0);

  const totalCharges = transactions
    .filter((transaction) => ['FEE', 'CHARGE', 'PENALTY'].includes(transaction.entry_type))
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const feeStats = useMemo(() => {
    const fees = transactions.filter(e => ['FEE', 'CHARGE', 'PENALTY'].includes(e.entry_type));
    return fees.map(fee => {
        const paymentsAllocated = transactions
            .filter(e => e.entry_type === 'PAYMENT' && e.allocation_target_id === fee.id && e.is_verified);
        const paymentsTotal = paymentsAllocated.reduce((sum, e) => sum + Number(e.amount), 0);
        
        const paymentIds = paymentsAllocated.map(p => p.id);
        const reversalsTotal = transactions
            .filter(e => e.entry_type === 'REVERSAL' && e.reverses_id && paymentIds.includes(e.reverses_id) && e.is_verified)
            .reduce((sum, e) => sum + Number(e.amount), 0);

        const allocated = paymentsTotal - reversalsTotal;
        return {
            ...fee,
            paid: allocated,
            remaining: Math.max(0, Number(fee.amount) - allocated)
        };
    }).sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());
  }, [transactions]);

  const standPrice = buyer?.stand ? Number(buyer.stand.size_sqm) * Number(buyer.stand.price_per_sqm) : 0;
  const totalInterest = schedule?.periods?.reduce((acc: number, p: any) => acc + Number(p.interest_expected || 0), 0) || 0;
  const totalPayable = standPrice + totalInterest + totalCharges;
  const outstandingBalance = Math.max(0, totalPayable - totalPaid);

  const sortedSchedulePeriods = useMemo(() => {
    if (!schedule?.periods?.length) {
      return [];
    }

    return [...schedule.periods].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [schedule?.periods]);

  const currentDay = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const nextPaymentPeriod = useMemo(() => {
    if (!sortedSchedulePeriods.length) {
      return null;
    }

    const upcoming = sortedSchedulePeriods.find((period) => {
      const dueDate = new Date(period.due_date);
      const remaining = Math.max(0, Number(period.total_expected) - Number(period.paid_amount || 0));
      return dueDate >= currentDay && remaining > 0;
    });

    if (upcoming) {
      return upcoming;
    }

    return sortedSchedulePeriods.find((period) => Math.max(0, Number(period.total_expected) - Number(period.paid_amount || 0)) > 0) || null;
  }, [currentDay, sortedSchedulePeriods]);

  const lastPaymentPeriod = useMemo(() => {
    if (!sortedSchedulePeriods.length) {
      return null;
    }

    const paidPeriods = sortedSchedulePeriods.filter((period) => Number(period.paid_amount || 0) > 0);
    return paidPeriods.length ? paidPeriods[paidPeriods.length - 1] : null;
  }, [sortedSchedulePeriods]);

  const arrearsAmount = useMemo(() => {
    if (!sortedSchedulePeriods.length) {
      return 0;
    }

    let expectedToDate = 0;
    let paidToDate = 0;

    sortedSchedulePeriods.forEach((period) => {
      const dueDate = new Date(period.due_date);
      if (dueDate <= currentDay) {
        const expected = Number(period.total_expected || 0);
        const paid = Number(period.paid_amount || 0);
        expectedToDate += expected;
        paidToDate += Math.min(expected, paid);
      }
    });

    return Math.max(0, expectedToDate - paidToDate);
  }, [currentDay, sortedSchedulePeriods]);

  const accountStatus = arrearsAmount > 0 ? 'In Arrears' : 'On Track';

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())
      .slice(0, 5);
  }, [transactions]);

  const nextPaymentAmount = nextPaymentPeriod
    ? Math.max(0, Number(nextPaymentPeriod.total_expected || 0) - Number(nextPaymentPeriod.paid_amount || 0))
    : 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Statement</h1>
          <p className="text-secondary-400 mt-2">Clear summary first, full details on demand.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadPrintableStatement}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 border border-primary-500 rounded-2xl font-bold transition-all shadow-xl text-white"
          >
            <Printer size={20} />
            Download Statement PDF
          </button>
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-500" size={14} />
                <input
                  type="date"
                  value={asAtDate}
                  onChange={(e) => setAsAtDate(e.target.value)}
                  className="bg-secondary-900/50 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-primary-500/50 appearance-none transition-all"
                />
              </div>
            </div>
        </div>
      </div>

      <div className="print:hidden glass rounded-[2rem] p-8 animate-in space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-secondary-500 font-black">Total Payable</p>
            <p className="text-2xl font-black mt-2">${totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-secondary-500 font-black">Total Paid</p>
            <p className="text-2xl font-black mt-2 text-green-400">${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-secondary-500 font-black">Outstanding</p>
            <p className="text-2xl font-black mt-2">${outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-secondary-500 font-black">Next Payment Due</p>
            <p className="text-sm font-bold mt-2">
              {nextPaymentPeriod ? new Date(nextPaymentPeriod.due_date).toLocaleDateString() : 'No upcoming due date'}
            </p>
            <p className="text-lg font-black mt-1">${nextPaymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-secondary-500 font-black">Status</p>
            <p className={cn('text-lg font-black mt-2', accountStatus === 'In Arrears' ? 'text-red-400' : 'text-green-400')}>
              {accountStatus}
            </p>
            {arrearsAmount > 0 && (
              <p className="text-xs text-secondary-400 mt-1">Arrears: ${arrearsAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-secondary-500 mb-4">Short Schedule</p>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-secondary-400">Last Payment</span>
              <span className="font-bold">
                {lastPaymentPeriod
                  ? `${new Date(lastPaymentPeriod.due_date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} - ${lastPaymentPeriod.status}`
                  : 'No paid period yet'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary-400">Next Payment</span>
              <span className="font-bold">
                {nextPaymentPeriod
                  ? `${new Date(nextPaymentPeriod.due_date).toLocaleDateString()} - $${nextPaymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : 'No upcoming payment'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary-400">Arrears</span>
              <span className={cn('font-bold', arrearsAmount > 0 ? 'text-red-400' : 'text-green-400')}>
                {arrearsAmount > 0 ? `$${arrearsAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'None'}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-secondary-500">Recent Transactions (Last 5)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-secondary-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/10">
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Description</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  Array(3)
                    .fill(0)
                    .map((_, index) => (
                      <tr key={index} className="animate-pulse">
                        <td colSpan={4} className="px-5 py-4">
                          <div className="h-5 bg-white/5 rounded-lg w-full"></div>
                        </td>
                      </tr>
                    ))
                ) : recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-secondary-500">
                      No recent transactions found.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-5 py-4 text-sm text-secondary-400">{new Date(transaction.effective_date).toLocaleDateString()}</td>
                      <td className="px-5 py-4 text-sm font-bold">{transaction.description}</td>
                      <td className="px-5 py-4 text-sm text-secondary-400">{transaction.entry_type}</td>
                      <td className={cn('px-5 py-4 text-sm text-right font-black', transaction.entry_type === 'PAYMENT' ? 'text-green-400' : 'text-white')}>
                        {transaction.entry_type === 'PAYMENT' ? '+' : '-'}${Number(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="print:hidden glass rounded-[2rem] overflow-hidden animate-in">
        <button
          type="button"
          onClick={() => setShowDetails((current) => !current)}
          className="w-full px-8 py-5 bg-white/5 border-b border-white/10 flex items-center justify-between text-left"
        >
          <div>
            <p className="text-sm font-black">Detailed Statement</p>
            <p className="text-xs text-secondary-400 mt-1">Full ledger history, filters, and export-ready data.</p>
          </div>
          {showDetails ? <ChevronUp size={18} className="text-secondary-400" /> : <ChevronDown size={18} className="text-secondary-400" />}
        </button>

        {showDetails && (
          <>
            <div className="p-8 border-b border-white/10 bg-white/5 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search transactions..."
                  className="w-full bg-secondary-950 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary-600/50 outline-none transition-all"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="bg-secondary-950 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-600/50 outline-none transition-all font-bold"
              >
                <option value="ALL">All types</option>
                <option value="PAYMENT">Payments</option>
                <option value="FEE">Charges</option>
                <option value="PENALTY">Penalties</option>
                <option value="REVERSAL">Reversals</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="bg-secondary-950 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-600/50 outline-none transition-all font-bold"
              >
                <option value="ALL">All statuses</option>
                <option value="VERIFIED">Verified</option>
                <option value="PENDING">Pending</option>
              </select>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  onClick={(event) => (event.currentTarget as HTMLInputElement).showPicker?.()}
                  className="w-full bg-secondary-950 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary-600/50 outline-none transition-all"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  onClick={(event) => (event.currentTarget as HTMLInputElement).showPicker?.()}
                  className="w-full bg-secondary-950 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary-600/50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5 text-secondary-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/10">
                    <th className="px-8 py-5">Date</th>
                    <th className="px-8 py-5">Description</th>
                    <th className="px-8 py-5">Type</th>
                    <th className="px-8 py-5 text-right">Amount</th>
                    <th className="px-8 py-5 text-right">Running Balance</th>
                    <th className="px-8 py-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    Array(5)
                      .fill(0)
                      .map((_, index) => (
                        <tr key={index} className="animate-pulse">
                          <td colSpan={6} className="px-8 py-6">
                            <div className="h-6 bg-white/5 rounded-lg w-full"></div>
                          </td>
                        </tr>
                      ))
                  ) : runningTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-12 text-center text-secondary-500">
                        No statement entries were found.
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-8 py-6 text-sm font-medium text-secondary-400">
                          {new Date(transaction.effective_date).toLocaleDateString()}
                        </td>
                        <td className="px-8 py-6">
                          <p className="font-bold text-white group-hover:text-primary-400 transition-colors uppercase tracking-tight text-sm">
                            {transaction.isDeposit ? 'DEPOSIT PAYMENT' : transaction.description}
                          </p>
                          <p className="text-[10px] text-secondary-500 mt-0.5 tracking-widest font-black uppercase">
                            {transaction.id === 'opening-balance' ? 'ACQUISITION' : `Ref ${transaction.id.substring(0, 8).toUpperCase()}`}
                          </p>
                        </td>
                        <td className="px-8 py-6">
                          <span
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border',
                              transaction.entry_type === 'PAYMENT'
                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                : transaction.entry_type === 'DEBIT' 
                                ? 'bg-primary-500/10 text-primary-400 border-primary-500/20'
                                : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                            )}
                          >
                            {transaction.entry_type}
                          </span>
                        </td>
                        <td
                          className={cn(
                            'px-8 py-6 text-right font-black text-lg',
                            transaction.entry_type === 'PAYMENT' ? 'text-green-400' : 'text-white'
                          )}
                        >
                          {transaction.entry_type === 'PAYMENT' ? '+' : '-'}${Number(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-8 py-6 text-right font-black text-secondary-300">
                          ${Math.abs(transaction.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-secondary-500">
                            {transaction.is_verified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
          </>
        )}
      </div>

      {/* Fee Settlement Status */}
      <div className="print:hidden glass rounded-[2rem] overflow-hidden animate-in">
        <div className="p-8 border-b border-white/10 bg-white/5">
            <p className="text-sm font-black">Fee Settlement Status</p>
            <p className="text-xs text-secondary-400 mt-1">Status of project-specific charges and their payment allocations.</p>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="text-[10px] uppercase tracking-widest text-secondary-500 bg-white/5">
                    <tr>
                        <th className="px-8 py-4 font-black">Fee Description</th>
                        <th className="px-8 py-4 font-black text-right">Total</th>
                        <th className="px-8 py-4 font-black text-right">Paid</th>
                        <th className="px-8 py-4 font-black text-right">Balance</th>
                        <th className="px-8 py-4 font-black">Settlement</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {feeStats.map(fee => (
                        <tr key={fee.id}>
                            <td className="px-8 py-5">
                                <div className="font-bold text-sm tracking-tight">{fee.description}</div>
                                <div className="text-[10px] text-secondary-500 font-black uppercase tracking-widest mt-0.5">{new Date(fee.effective_date).toLocaleDateString()}</div>
                            </td>
                            <td className="px-8 py-5 text-right font-bold text-sm text-white">
                                ${Number(fee.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-8 py-5 text-right font-bold text-sm text-green-400">
                                ${fee.paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-8 py-5 text-right font-bold text-sm text-primary-400">
                                ${fee.remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-8 py-5">
                                <div className="flex flex-col gap-1.5 min-w-[100px]">
                                    <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                                        <span className={fee.remaining === 0 ? "text-green-400" : "text-secondary-500"}>
                                            {fee.remaining === 0 ? 'Settled' : 'In Progress'}
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
                            <td colSpan={5} className="px-8 py-12 text-center text-secondary-500 italic text-sm">
                                No additional fees or charges on this account.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Simplified Print-only Statement - Vertical Clean Layout */}
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
                  <p className="text-3xl font-black">{buyer?.first_name} {buyer?.last_name}</p>
                  <p className="text-sm text-secondary-500 mt-2 font-medium">ID: {buyer?.id_number}</p>
                  <p className="text-sm text-secondary-500 font-medium">{buyer?.user?.email || user?.email}</p>
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400 mb-4">Allocation</p>
                  <p className="text-3xl font-black">Stand {buyer?.stand?.stand_number}</p>
                  <p className="text-sm text-secondary-500 mt-2 font-medium">{buyer?.stand?.size_sqm}m² Area @ ${buyer?.stand?.price_per_sqm}/m²</p>
                  <p className="text-[10px] font-black text-primary-600 mt-2 uppercase tracking-tight">{buyer?.stand?.project?.name}</p>
               </div>
            </div>

            {/* Linear Summary (No boxes) */}
            <div className="border-y border-secondary-100 py-12 grid grid-cols-4 gap-4">
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400 mb-2">Property Value</p>
                   <p className="text-2xl font-black">${(standPrice + totalInterest).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400 mb-2">Other Fees</p>
                   <p className="text-2xl font-black">${totalCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-2">Total Paid</p>
                   <p className="text-2xl font-black text-green-600">${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black uppercase tracking-widest text-primary-600 mb-2">Outstanding Balance</p>
                   <p className="text-4xl font-black text-primary-600">${outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
                        {runningTransactions.map((entry: any, idx: number) => (
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
                                    ${Number(entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Minimal Footer */}
            <div className="pt-20 mt-auto border-t border-secondary-100 text-center">
                <p className="text-[10px] font-black text-secondary-300 uppercase tracking-[1em]">OFFICIAL CERTIFIED RECORD</p>
                <p className="text-[9px] text-secondary-400 mt-4 leading-relaxed max-w-lg mx-auto italic">
                   This document is a certified statement of account issued via the StandVault Purchaser Portal. It reflects all verified transactions as of certification date.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaserPayments;
