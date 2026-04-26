import { useEffect, useMemo, useState } from 'react';
import { 
  Search, 
  Filter, 
  ChevronRight, 
  UserPlus,
  ArrowUpDown,
  Printer,
  CreditCard,
  User,
  Download,
  FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { cn } from '../lib/utils';
import api from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../contexts/ProjectContext';

import AddBuyerModal from '../components/AddBuyerModal';
import PaymentModal from '../components/PaymentModal';
import TablePagination from '../components/TablePagination';
import { usePagination } from '../hooks/usePagination';

interface Buyer {
  id: string;
  first_name: string;
  last_name: string;
  user: {
    email: string;
  };
  stand: {
    stand_number: string;
  };
  payment_status: string;
  arrears_status: boolean;
}

const tableHeaders = [
  { label: 'Name', sortable: true },
  { label: 'Stand #', sortable: true },
  { label: 'Email', sortable: false },
  { label: 'Payment Status', sortable: true },
  { label: 'Arrears', sortable: true },
  { label: 'Actions', sortable: false },
];

const getPaymentStatusClass = (status: string) => {
  switch (status) {
    case 'FULLY_PAID':
      return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'CURRENT':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'IN_ARREARS':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    default:
      return 'bg-secondary-800/80 text-secondary-300 border-white/10';
  }
};

const BuyerListSummary = ({ buyers }: { buyers: Buyer[] }) => {
  const stats = useMemo(() => {
    const total = buyers.length;
    const inArrears = buyers.filter(b => b.arrears_status).length;
    const fullyPaid = buyers.filter(b => b.payment_status === 'FULLY_PAID').length;
    const current = buyers.filter(b => b.payment_status === 'CURRENT' && !b.arrears_status).length;
    
    return { total, inArrears, fullyPaid, current };
  }, [buyers]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="glass p-5 rounded-2xl border-l-4 border-primary-500 grow">
        <p className="text-[10px] font-black uppercase tracking-widest text-secondary-500">Total Allocations</p>
        <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
      </div>
      <div className="glass p-5 rounded-2xl border-l-4 border-green-500 grow">
        <p className="text-[10px] font-black uppercase tracking-widest text-secondary-500">Fully Paid</p>
        <h3 className="text-2xl font-bold mt-1 text-green-400">{stats.fullyPaid}</h3>
      </div>
      <div className="glass p-5 rounded-2xl border-l-4 border-blue-500 grow">
        <p className="text-[10px] font-black uppercase tracking-widest text-secondary-500">Current Plans</p>
        <h3 className="text-2xl font-bold mt-1 text-blue-400">{stats.current}</h3>
      </div>
      <div className="glass p-5 rounded-2xl border-l-4 border-red-500 grow">
        <p className="text-[10px] font-black uppercase tracking-widest text-secondary-500">In Arrears</p>
        <h3 className="text-2xl font-bold mt-1 text-red-400">{stats.inArrears}</h3>
      </div>
    </div>
  );
};

const BuyerList = () => {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [arrearsFilter, setArrearsFilter] = useState('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedBuyerForPayment, setSelectedBuyerForPayment] = useState<Buyer | null>(null);
  const { selectedProject } = useProject();

  const fetchBuyers = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const response = await api.get(`/projects/${selectedProject.id}/buyers`);
      setBuyers(response.data);
    } catch (err) {
      console.error('Failed to fetch buyers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuyers();
  }, [selectedProject]);

  const handleExportExcel = () => {
    const data = filteredBuyers.map(b => ({
      'Name': `${b.first_name} ${b.last_name}`,
      'Stand Number': b.stand?.stand_number,
      'Email': b.user?.email,
      'Payment Status': b.payment_status,
      'Arrears': b.arrears_status ? 'In Arrears' : 'Current'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchasers');
    XLSX.writeFile(wb, `Purchasers_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Purchases & Allocations - ${selectedProject?.name}`, 14, 15);
    (doc as any).autoTable({
      startY: 20,
      head: [['Name', 'Stand #', 'Email', 'Payment Status', 'Arrears']],
      body: filteredBuyers.map(b => [
        `${b.first_name} ${b.last_name}`,
        b.stand?.stand_number,
        b.user?.email,
        b.payment_status,
        b.arrears_status ? 'In Arrears' : 'None'
      ]),
    });
    doc.save(`Purchasers_Export_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportCSV = () => {
    const rows = [
      ['Name', 'Stand #', 'Email', 'Status', 'Arrears'],
      ...filteredBuyers.map(b => [
        `${b.first_name} ${b.last_name}`,
        b.stand?.stand_number,
        b.user?.email,
        b.payment_status,
        b.arrears_status ? 'YES' : 'NO'
      ])
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `purchasers_export.csv`;
    link.click();
  };

  const filteredBuyers = useMemo(() => {
    let result = buyers.filter((b) => {
      const matchesSearch =
        `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.stand?.stand_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.user?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = paymentStatusFilter === 'ALL' || b.payment_status === paymentStatusFilter;
      const matchesArrears =
        arrearsFilter === 'ALL' ||
        (arrearsFilter === 'IN_ARREARS' ? b.arrears_status : !b.arrears_status);

      return matchesSearch && matchesStatus && matchesArrears;
    });

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        switch (sortConfig.key) {
          case 'Name':
            valA = `${a.first_name} ${a.last_name}`;
            valB = `${b.first_name} ${b.last_name}`;
            break;
          case 'Stand #':
            valA = a.stand?.stand_number || '';
            valB = b.stand?.stand_number || '';
            break;
          case 'Payment Status':
            valA = a.payment_status;
            valB = b.payment_status;
            break;
          case 'Arrears':
            valA = a.arrears_status ? 1 : 0;
            valB = b.arrears_status ? 1 : 0;
            break;
          default:
            break;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [arrearsFilter, buyers, paymentStatusFilter, searchTerm, sortConfig]);

  const handleSort = (label: string) => {
    setSortConfig((prev) => {
      if (prev?.key === label) {
        if (prev.direction === 'asc') return { key: label, direction: 'desc' };
        return null;
      }
      return { key: label, direction: 'asc' };
    });
  };

  const {
    currentPage,
    pageSize,
    paginatedItems: paginatedBuyers,
    rangeEnd,
    rangeStart,
    totalItems,
    totalPages,
    setCurrentPage,
    setPageSize,
  } = usePagination(filteredBuyers, 10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, paymentStatusFilter, arrearsFilter, setCurrentPage]);

  const navigate = useNavigate();

  return (
    <>
      <div className="flex flex-col gap-8 print:hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Purchases & Allocations</h1>
          <p className="text-secondary-400 mt-1">Manage purchasers, stand allocations, and account statuses.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all"
          >
            <Download size={16} />
            PDF
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all"
          >
            <Download size={16} />
            Excel
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all"
          >
            <FileDown size={16} />
            CSV
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all"
          >
            <Printer size={16} />
            Print List
          </button>
          {!selectedProject ? null : (
            <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-600/20 active:scale-95"
            >
                <UserPlus size={18} />
                <span>Register Purchaser</span>
            </button>
          )}
        </div>
      </div>

      <BuyerListSummary buyers={buyers} />

      <AddBuyerModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        projectId={selectedProject?.id || ''} 
        onSuccess={fetchBuyers} 
      />
      {selectedBuyerForPayment && (
        <PaymentModal
          isOpen={!!selectedBuyerForPayment}
          onClose={() => setSelectedBuyerForPayment(null)}
          buyerId={selectedBuyerForPayment.id}
          buyerName={`${selectedBuyerForPayment.first_name} ${selectedBuyerForPayment.last_name}`}
          onSuccess={fetchBuyers}
        />
      )}

      <div className="glass rounded-2xl overflow-hidden animate-in">
        <div className="p-6 border-b border-white/10 flex flex-col md:flex-row gap-4 justify-between bg-white/5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
            <input 
              type="text" 
              placeholder="Search by name or stand number..." 
              className="w-full bg-secondary-950/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-600/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium">
              <Filter size={16} />
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="bg-transparent outline-none text-sm font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="CURRENT">Current</option>
                <option value="IN_ARREARS">In Arrears</option>
                <option value="FULLY_PAID">Fully Paid</option>
              </select>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium">
              <ArrowUpDown size={16} />
              <select
                value={arrearsFilter}
                onChange={(e) => setArrearsFilter(e.target.value)}
                className="bg-transparent outline-none text-sm font-medium"
              >
                <option value="ALL">All Arrears</option>
                <option value="CURRENT">Current Only</option>
                <option value="IN_ARREARS">In Arrears Only</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-secondary-400 text-xs font-bold uppercase tracking-wider">
                {tableHeaders.map((h, i) => (
                  <th 
                    key={i} 
                    className={cn(
                        "px-6 py-4 font-bold border-b border-white/10",
                        h.sortable && "cursor-pointer select-none"
                    )}
                    onClick={() => h.sortable && handleSort(h.label)}
                  >
                    <div className="flex items-center gap-2 hover:text-white transition-colors">
                      {h.label}
                      {h.sortable && (
                        <div className="flex flex-col">
                            <ArrowUpDown 
                                size={12} 
                                className={cn(
                                    "transition-colors",
                                    sortConfig?.key === h.label ? "text-primary-400" : "text-secondary-600"
                                )} 
                            />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array(6).fill(0).map((__, j) => (
                      <td key={j} className="px-6 py-4"><div className="h-4 bg-white/10 rounded w-full"></div></td>
                    ))}
                  </tr>
                ))
              ) : paginatedBuyers.map((buyer) => (
                <tr 
                  key={buyer.id} 
                  onClick={() => navigate(`/buyers/${buyer.id}`)}
                  className="group hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-600/20 text-primary-400 flex items-center justify-center font-bold text-xs">
                        {(buyer.first_name?.[0] || '')}{(buyer.last_name?.[0] || '')}
                      </div>
                      <span className="font-semibold">{buyer.first_name} {buyer.last_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg bg-secondary-800 text-secondary-200 text-xs font-bold border border-white/5">
                      {buyer.stand?.stand_number}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-secondary-400 text-sm">{buyer.user?.email}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      getPaymentStatusClass(buyer.payment_status)
                    )}>
                      {buyer.payment_status.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {buyer.arrears_status ? (
                      <span className="flex items-center gap-1.5 text-red-400 text-xs font-bold">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                        In Arrears
                      </span>
                    ) : (
                      <span className="text-secondary-500 text-xs font-medium">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => navigate(`/buyers/${buyer.id}`)}
                        title="Open Profile"
                        className="p-2 text-secondary-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      >
                        <User size={18} />
                      </button>
                      <button
                        onClick={() => setSelectedBuyerForPayment(buyer)}
                        title="Record Payment"
                        className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-all"
                      >
                        <CreditCard size={18} />
                      </button>
                      <button 
                        onClick={() => navigate(`/buyers/${buyer.id}?tab=ledger`)}
                        title="Proper Statement (from Profile)"
                        className="p-2 text-primary-400 hover:bg-primary-500/10 rounded-lg transition-all"
                      >
                        <Printer size={18} />
                      </button>
                      <button 
                        onClick={() => navigate(`/buyers/${buyer.id}`)}
                        className="p-2 text-secondary-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filteredBuyers.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search size={32} className="text-secondary-500" />
            </div>
            <h3 className="text-xl font-bold">No purchasers found</h3>
            <p className="text-secondary-500 mt-2">Try adjusting your search or filters to find the allocation you're looking for.</p>
          </div>
        )}

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

    </div>

      {/* Professional List Print Surface */}
      <div className="hidden print:block bg-white text-secondary-950 p-10 min-h-screen fixed inset-0 z-[9999]">
         <div className="flex items-end justify-between border-b-4 border-primary-600 pb-6 mb-8 text-secondary-900">
            <div>
               <h1 className="text-3xl font-black tracking-tighter">STANDVAULT PURCHASER REGISTRY</h1>
               <p className="text-xs font-black uppercase tracking-widest text-secondary-500 mt-1">Project: {selectedProject?.name}</p>
            </div>
            <div className="text-right">
               <p className="text-xs font-bold text-secondary-400">Export Date: {new Date().toLocaleDateString()}</p>
               <p className="text-xs font-black text-secondary-900 uppercase mt-1">Status: Official Record</p>
            </div>
         </div>

         <table className="w-full text-left border-collapse">
            <thead>
               <tr className="bg-secondary-900 text-white text-[10px] font-black uppercase tracking-widest">
                  <th className="px-4 py-3">Purchaser Name</th>
                  <th className="px-4 py-3">Stand Allocation</th>
                  <th className="px-4 py-3">Contact Email</th>
                  <th className="px-4 py-3 text-right">Payment Status</th>
                  <th className="px-4 py-3 text-right">Arrears</th>
               </tr>
            </thead>
            <tbody className="text-xs font-medium divide-y divide-secondary-100 italic">
               {filteredBuyers.map((b) => (
                  <tr key={b.id}>
                     <td className="px-4 py-4 font-bold text-secondary-900 border-b border-secondary-50">{b.first_name} {b.last_name}</td>
                     <td className="px-4 py-4 font-black italic uppercase border-b border-secondary-50">{b.stand?.stand_number}</td>
                     <td className="px-4 py-4 text-secondary-500 border-b border-secondary-50">{b.user?.email}</td>
                     <td className="px-4 py-4 text-right border-b border-secondary-50">
                        <span className="font-black text-secondary-900">{b.payment_status}</span>
                     </td>
                     <td className="px-4 py-4 text-right font-black text-rose-600 border-b border-secondary-50">
                        {b.arrears_status ? 'IN ARREARS' : 'NONE'}
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>

         <div className="mt-12 pt-8 border-t border-secondary-200 flex justify-between items-center opacity-50 italic text-[10px]">
            <p>© {new Date().getFullYear()} StandVault Property Systems. Confidential Document.</p>
            <p>Total Records Processed: {filteredBuyers.length}</p>
         </div>
      </div>
    </>
  );
};

export default BuyerList;
