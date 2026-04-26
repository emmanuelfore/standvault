import { useEffect, useMemo, useState } from 'react';
import { Calendar, Download, Eye, FileText, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useProject } from '../contexts/ProjectContext';
import TablePagination from '../components/TablePagination';
import { usePagination } from '../hooks/usePagination';

interface PaymentRow {
  id: string;
  amount: string | number;
  description: string;
  effective_date: string;
  is_verified: boolean;
  buyer: {
    id: string;
    first_name: string;
    last_name: string;
    stand?: { stand_number: string };
    user?: { email?: string };
  };
  proof_url?: string;
}

const Payments = () => {
  const navigate = useNavigate();
  const { selectedProject } = useProject();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [standNumber, setStandNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchPayments = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const buyersRes = await api.get(`/projects/${selectedProject.id}/buyers`);
      const buyers = buyersRes.data || [];

      const ledgerResponses = await Promise.all(
        buyers.map(async (buyer: any) => {
          const ledgerRes = await api.get(`/buyers/${buyer.id}/ledger`);
          const paymentEntries = (ledgerRes.data || [])
            .filter((entry: any) => entry.entry_type === 'PAYMENT')
            .map((entry: any) => ({
              ...entry,
              buyer,
              proof_url: entry.pop_submissions?.[0]?.file_url
            }));
          return paymentEntries;
        })
      );

      const flattened = ledgerResponses.flat().sort(
        (a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime()
      );

      setPayments(flattened);
    } catch (err) {
      console.error('Failed to fetch payments', err);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [selectedProject]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const fullName = `${payment.buyer.first_name} ${payment.buyer.last_name}`.toLowerCase();
      const paymentDate = new Date(payment.effective_date);

      if (name && !fullName.includes(name.toLowerCase())) return false;
      if (standNumber && !(payment.buyer.stand?.stand_number || '').toLowerCase().includes(standNumber.toLowerCase())) return false;
      if (startDate && paymentDate < new Date(startDate)) return false;
      if (endDate) {
        const inclusiveEnd = new Date(endDate);
        inclusiveEnd.setHours(23, 59, 59, 999);
        if (paymentDate > inclusiveEnd) return false;
      }

      return true;
    });
  }, [payments, name, standNumber, startDate, endDate]);

  const {
    currentPage,
    pageSize,
    paginatedItems: paginatedPayments,
    rangeEnd,
    rangeStart,
    totalItems,
    totalPages,
    setCurrentPage,
    setPageSize,
  } = usePagination(filteredPayments, 10);

  useEffect(() => {
    setCurrentPage(1);
  }, [endDate, name, setCurrentPage, standNumber, startDate]);

  const exportCsv = () => {
    const rows = [
      ['Date', 'Purchaser', 'Stand', 'Description', 'Amount', 'Status'],
      ...filteredPayments.map((payment) => [
        new Date(payment.effective_date).toLocaleDateString(),
        `${payment.buyer.first_name} ${payment.buyer.last_name}`,
        payment.buyer.stand?.stand_number || '',
        payment.description,
        Number(payment.amount).toFixed(2),
        payment.is_verified ? 'Verified' : 'Pending'
      ])
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `payments_${selectedProject?.name || 'project'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportExcel = () => {
    const tableHtml = `
      <table>
        <tr><th>Date</th><th>Purchaser</th><th>Stand</th><th>Description</th><th>Amount</th><th>Status</th></tr>
        ${filteredPayments.map((payment) => `
          <tr>
            <td>${new Date(payment.effective_date).toLocaleDateString()}</td>
            <td>${payment.buyer.first_name} ${payment.buyer.last_name}</td>
            <td>${payment.buyer.stand?.stand_number || ''}</td>
            <td>${payment.description}</td>
            <td>${Number(payment.amount).toFixed(2)}</td>
            <td>${payment.is_verified ? 'Verified' : 'Pending'}</td>
          </tr>
        `).join('')}
      </table>
    `;
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `payments_${selectedProject?.name || 'project'}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const exportPdf = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=700');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>Payments</title></head>
        <body>
          <h1>Payments</h1>
          <table border="1" cellspacing="0" cellpadding="8" width="100%">
            <tr><th>Date</th><th>Purchaser</th><th>Stand</th><th>Description</th><th>Amount</th><th>Status</th></tr>
            ${filteredPayments.map((payment) => `
              <tr>
                <td>${new Date(payment.effective_date).toLocaleDateString()}</td>
                <td>${payment.buyer.first_name} ${payment.buyer.last_name}</td>
                <td>${payment.buyer.stand?.stand_number || ''}</td>
                <td>${payment.description}</td>
                <td>${Number(payment.amount).toFixed(2)}</td>
                <td>${payment.is_verified ? 'Verified' : 'Pending'}</td>
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

  const totalAmount = useMemo(
    () => filteredPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [filteredPayments]
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-secondary-400 mt-1">Review payment records pulled directly from purchaser statements.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportPdf} disabled={!filteredPayments.length} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold transition-all">PDF</button>
          <button onClick={exportExcel} disabled={!filteredPayments.length} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold transition-all">Excel</button>
          <button
            onClick={exportCsv}
            disabled={!filteredPayments.length}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/40 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-600/20"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Filter by purchaser name"
            className="w-full bg-secondary-950/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-600/50"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
          <input
            type="text"
            value={standNumber}
            onChange={(e) => setStandNumber(e.target.value)}
            placeholder="Filter by stand number"
            className="w-full bg-secondary-950/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-600/50"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            className="w-full bg-secondary-950/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-600/50"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            className="w-full bg-secondary-950/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-600/50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass p-6 rounded-2xl">
          <p className="text-secondary-400 text-xs font-bold uppercase tracking-wider">Payments Found</p>
          <h3 className="text-2xl font-bold mt-1">{filteredPayments.length}</h3>
        </div>
        <div className="glass p-6 rounded-2xl">
          <p className="text-secondary-400 text-xs font-bold uppercase tracking-wider">Total Value</p>
          <h3 className="text-2xl font-bold mt-1">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-secondary-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4 border-b border-white/10">Date</th>
                <th className="px-6 py-4 border-b border-white/10">Purchaser</th>
                <th className="px-6 py-4 border-b border-white/10">Stand</th>
                <th className="px-6 py-4 border-b border-white/10">Description</th>
                <th className="px-6 py-4 border-b border-white/10 text-right">Amount</th>
                <th className="px-6 py-4 border-b border-white/10">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array(6).fill(0).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-white/10 rounded w-full"></div></td>
                  </tr>
                ))
              ) : paginatedPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-secondary-400">{new Date(payment.effective_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-semibold">{payment.buyer.first_name} {payment.buyer.last_name}</td>
                  <td className="px-6 py-4">{payment.buyer.stand?.stand_number}</td>
                  <td className="px-6 py-4 text-secondary-300">{payment.description}</td>
                  <td className="px-6 py-4 text-right font-bold">${Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/buyers/${payment.buyer.id}`)}
                        className="p-2 text-secondary-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        title="Open profile"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => navigate(`/buyers/${payment.buyer.id}?tab=ledger`)}
                        className="p-2 text-primary-400 hover:bg-primary-500/10 rounded-lg transition-all"
                        title="Open statement"
                      >
                        <FileText size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filteredPayments.length === 0 && (
          <div className="p-12 text-center text-secondary-500">No payments found for the selected filters.</div>
        )}
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
    </div>
  );
};

export default Payments;
