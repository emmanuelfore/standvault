import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, 
  Users, 
  User, 
  DollarSign, 
  Calendar, 
  FileText,
  AlertCircle,
  CheckCircle2,
  Eye
} from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';
import { useProject } from '../contexts/ProjectContext';
import { useNavigate } from 'react-router-dom';
import TablePagination from '../components/TablePagination';
import { usePagination } from '../hooks/usePagination';

const AdditionalFees = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<'apply' | 'history'>('history');
  const [mode, setMode] = useState<'bulk' | 'individual'>('bulk');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [historyName, setHistoryName] = useState('');
  const [historyStand, setHistoryStand] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const { selectedProject } = useProject();

  const fetchFees = async () => {
    if (!selectedProject) return;
    try {
      const buyersRes = await api.get(`/projects/${selectedProject.id}/buyers`);
      const projectBuyers = buyersRes.data || [];

      const ledgerResponses = await Promise.all(
        projectBuyers.map(async (buyer: any) => {
          const ledgerRes = await api.get(`/buyers/${buyer.id}/ledger`);
          return (ledgerRes.data || [])
            .filter((entry: any) => entry.entry_type === 'FEE' || entry.entry_type === 'PENALTY')
            .map((entry: any) => ({
              ...entry,
              buyer
            }));
        })
      );

      const flattened = ledgerResponses
        .flat()
        .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());

      setFees(flattened);
    } catch (err) {
      console.error('Failed to fetch fees', err);
      setFees([]);
    }
  };

  useEffect(() => {
    if (selectedProject) {
      fetchFees();
    }
    if (mode === 'individual' && selectedProject) {
      const fetchBuyers = async () => {
        try {
          const res = await api.get(`/projects/${selectedProject.id}/buyers`);
          setBuyers(res.data);
        } catch (err) {
          console.error('Failed to fetch buyers', err);
        }
      };
      fetchBuyers();
    }
  }, [mode, selectedProject]);

  const filteredFees = useMemo(() => {
    return fees.filter((fee) => {
      const purchaserName = `${fee.buyer.first_name} ${fee.buyer.last_name}`.toLowerCase();
      const standScope = fee.buyer.stand?.stand_number || 'All Stands';
      const standValue = standScope.toLowerCase();
      const feeDate = new Date(fee.effective_date);

      if (historyName && !purchaserName.includes(historyName.toLowerCase())) return false;
      if (historyStand && !standValue.includes(historyStand.toLowerCase())) return false;
      if (historyStartDate && feeDate < new Date(historyStartDate)) return false;
      if (historyEndDate) {
        const inclusiveEnd = new Date(historyEndDate);
        inclusiveEnd.setHours(23, 59, 59, 999);
        if (feeDate > inclusiveEnd) return false;
      }
      return true;
    });
  }, [fees, historyEndDate, historyName, historyStand, historyStartDate]);

  const {
    currentPage,
    pageSize,
    paginatedItems: paginatedFees,
    rangeEnd,
    rangeStart,
    totalItems,
    totalPages,
    setCurrentPage,
    setPageSize,
  } = usePagination(filteredFees, 10);

  useEffect(() => {
    setCurrentPage(1);
  }, [historyEndDate, historyName, historyStand, historyStartDate, setCurrentPage]);

  const getStandScope = (fee: any) => {
    const description = String(fee.description || '').toLowerCase();
    if (description.includes('bulk') || description.includes('all stands') || description.includes('project')) {
      return 'All Stands';
    }
    return fee.buyer.stand?.stand_number || 'All Stands';
  };

  const exportFeesCsv = () => {
    const rows = [
      ['Date', 'Purchaser', 'Stand Scope', 'Description', 'Amount'],
      ...filteredFees.map((fee) => [
        new Date(fee.effective_date).toLocaleDateString(),
        `${fee.buyer.first_name} ${fee.buyer.last_name}`,
        getStandScope(fee),
        fee.description,
        Number(fee.amount).toFixed(2)
      ])
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `fee_history_${selectedProject?.name || 'project'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportFeesExcel = () => {
    const tableHtml = `
      <table>
        <tr><th>Date</th><th>Purchaser</th><th>Stand Scope</th><th>Description</th><th>Amount</th></tr>
        ${filteredFees.map((fee) => `
          <tr>
            <td>${new Date(fee.effective_date).toLocaleDateString()}</td>
            <td>${fee.buyer.first_name} ${fee.buyer.last_name}</td>
            <td>${getStandScope(fee)}</td>
            <td>${fee.description}</td>
            <td>${Number(fee.amount).toFixed(2)}</td>
          </tr>
        `).join('')}
      </table>
    `;
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fee_history_${selectedProject?.name || 'project'}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const exportFeesPdf = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=700');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>Fee History</title></head>
        <body>
          <h1>Fee History</h1>
          <table border="1" cellspacing="0" cellpadding="8" width="100%">
            <tr><th>Date</th><th>Purchaser</th><th>Stand Scope</th><th>Description</th><th>Amount</th></tr>
            ${filteredFees.map((fee) => `
              <tr>
                <td>${new Date(fee.effective_date).toLocaleDateString()}</td>
                <td>${fee.buyer.first_name} ${fee.buyer.last_name}</td>
                <td>${getStandScope(fee)}</td>
                <td>${fee.description}</td>
                <td>${Number(fee.amount).toFixed(2)}</td>
              </tr>
            `).join('')}
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    
    setLoading(true);
    setError('');
    try {
      if (mode === 'bulk') {
        await api.post(`/projects/${selectedProject.id}/bulk-fees`, {
          amount: Number(amount),
          description,
          effective_date: new Date(date).toISOString()
        });
      } else {
        if (!selectedBuyer) throw new Error('Please select a buyer');
        await api.post(`/buyers/${selectedBuyer}/ledger/fees`, {
          amount: Number(amount),
          description,
          effective_date: new Date(date).toISOString()
        });
      }
      setSuccess(true);
      setAmount('');
      setDescription('');
      setDate('');
      setSelectedBuyer('');
      fetchFees();
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error('Failed to apply fee', err);
      setError(err.response?.data?.error || err.message || 'Failed to apply fee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
          <h1 className="text-3xl font-bold">Apply Fees</h1>
          <p className="text-secondary-400 mt-1">Apply one-off fees or penalties to purchasers.</p>
      </div>

      <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl w-fit border border-white/5">
        <button
          onClick={() => setActiveView('history')}
          className={cn(
            "px-6 py-3 rounded-xl text-sm font-bold transition-all",
            activeView === 'history' ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20" : "text-secondary-500 hover:text-white"
          )}
        >
          Fee History
        </button>
        <button
          onClick={() => setActiveView('apply')}
          className={cn(
            "px-6 py-3 rounded-xl text-sm font-bold transition-all",
            activeView === 'apply' ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20" : "text-secondary-500 hover:text-white"
          )}
        >
          Apply Fee
        </button>
      </div>

      {activeView === 'apply' && (
      <>
      <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl w-fit border border-white/5">
        <button
          onClick={() => setMode('bulk')}
          className={cn(
            "flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all",
            mode === 'bulk' 
              ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20" 
              : "text-secondary-500 hover:text-white"
          )}
        >
          <Users size={18} />
          Bulk Project Fees
        </button>
        <button
          onClick={() => setMode('individual')}
          className={cn(
            "flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all",
            mode === 'individual' 
              ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20" 
              : "text-secondary-500 hover:text-white"
          )}
        >
          <User size={18} />
          Individual Fee
        </button>
      </div>

      <div className="glass rounded-3xl overflow-hidden animate-in">
        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {mode === 'individual' && (
              <div className="col-span-2 flex flex-col gap-2">
                <label className="text-xs font-bold text-secondary-400 uppercase tracking-widest">Select Purchaser</label>
                <select 
                  value={selectedBuyer}
                  onChange={(e) => setSelectedBuyer(e.target.value)}
                  className="w-full bg-secondary-950 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-600/50 outline-none transition-all"
                >
                  <option value="">Select a purchaser...</option>
                  {buyers.map(b => (
                    <option key={b.id} value={b.id}>{b.first_name} {b.last_name} ({b.stand?.stand_number})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-secondary-400 uppercase tracking-widest">Fee Amount ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
                <input 
                  type="number" 
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-secondary-950 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary-600/50 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-secondary-400 uppercase tracking-widest">Effective Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                  className="w-full bg-secondary-950 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary-600/50 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="col-span-2 flex flex-col gap-2">
              <label className="text-xs font-bold text-secondary-400 uppercase tracking-widest">Description / Reason</label>
              <div className="relative">
                <FileText className="absolute left-4 top-4 text-secondary-500" size={18} />
                <textarea 
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Penalty for late payment March 2026"
                  className="w-full bg-secondary-950 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary-600/50 outline-none transition-all resize-none"
                  required
                ></textarea>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex gap-3 text-sm">
              <AlertCircle size={20} className="shrink-0" />
              <div>
                <p className="font-bold">Caution: Append-Only Ledger</p>
                <p className="mt-0.5 opacity-80">
                  {mode === 'bulk' 
                    ? "This will apply the fee to ALL purchasers in the current project. This action cannot be undone and can only be corrected via reversal."
                    : "This fee will be permanently added to the purchaser's ledger. Reversals require an administrator's reason."}
                </p>
              </div>
            </div>

            {success ? (
              <div className="flex items-center justify-center gap-2 text-green-400 font-bold py-3 animate-in">
                <CheckCircle2 size={24} />
                Fee applied successfully!
              </div>
            ) : error ? (
              <div className="flex items-center justify-center gap-2 text-red-400 font-bold py-3 animate-in">
                <AlertCircle size={24} />
                {error}
              </div>
            ) : (
              <button 
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-primary-600/20 active:scale-[0.98]"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Zap size={22} fill="currentColor" />
                    Apply {mode === 'bulk' ? 'Bulk Project Fee' : 'Fee to Purchaser'}
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
      </>
      )}

      {activeView === 'history' && (
        <div className="glass rounded-3xl overflow-hidden animate-in">
          <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <div>
              <h3 className="font-bold">Fee History</h3>
              <p className="text-xs text-secondary-500 mt-1">All posted project fees and penalties.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportFeesPdf} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold">PDF</button>
              <button onClick={exportFeesExcel} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold">Excel</button>
              <button onClick={exportFeesCsv} className="px-3 py-2 bg-primary-600 hover:bg-primary-700 rounded-xl text-xs font-bold text-white">CSV</button>
              <div className="text-sm text-secondary-400 ml-2">{filteredFees.length} records</div>
            </div>
          </div>
          <div className="p-6 border-b border-white/10 bg-white/5 grid grid-cols-1 md:grid-cols-4 gap-4">
            <input value={historyName} onChange={(e) => setHistoryName(e.target.value)} placeholder="Filter by purchaser" className="bg-secondary-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary-600/50" />
            <input value={historyStand} onChange={(e) => setHistoryStand(e.target.value)} placeholder="Filter by stand or all" className="bg-secondary-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary-600/50" />
            <input type="date" value={historyStartDate} onChange={(e) => setHistoryStartDate(e.target.value)} onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()} className="bg-secondary-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary-600/50" />
            <input type="date" value={historyEndDate} onChange={(e) => setHistoryEndDate(e.target.value)} onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()} className="bg-secondary-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary-600/50" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-secondary-500 text-[10px] font-black uppercase tracking-widest border-b border-white/10">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Purchaser</th>
                  <th className="px-6 py-4">Stand Scope</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {paginatedFees.map((fee) => (
                  <tr key={fee.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-secondary-400">{new Date(fee.effective_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-semibold">{fee.buyer.first_name} {fee.buyer.last_name}</td>
                    <td className="px-6 py-4">{getStandScope(fee)}</td>
                    <td className="px-6 py-4 text-secondary-300">{fee.description}</td>
                    <td className="px-6 py-4 text-right font-bold">${Number(fee.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/buyers/${fee.buyer.id}?tab=ledger`)}
                        className="p-2 text-primary-400 hover:bg-primary-500/10 rounded-lg transition-all"
                        title="Open statement"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredFees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-secondary-500 italic">No fees have been applied yet.</td>
                  </tr>
                )}
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
      )}
    </div>
  );
};

export default AdditionalFees;
