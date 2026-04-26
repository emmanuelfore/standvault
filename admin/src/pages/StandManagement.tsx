import { useEffect, useState } from 'react';
import { Download, LayoutGrid, List, Plus, Upload } from 'lucide-react';
import { Edit, History, Lock, Unlock } from 'lucide-react';
import { cn } from '../lib/utils';
import { useProject } from '../contexts/ProjectContext';
import api from '../lib/api';
import AddStandModal from '../components/AddStandModal';
import BulkImportModal from '../components/BulkImportModal';
import TablePagination from '../components/TablePagination';
import { usePagination } from '../hooks/usePagination';

interface Stand {
  id: string;
  stand_number: string;
  size_sqm: number;
  price_per_sqm: number;
  status: 'AVAILABLE' | 'ALLOCATED' | 'RESERVED' | 'HELD';
}

const StandManagement = () => {
  const [view, setView] = useState<'list' | 'map'>('list');
  const [stands, setStands] = useState<Stand[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sizeFilter, setSizeFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const { selectedProject } = useProject();

  const fetchStands = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await api.get(`/projects/${selectedProject.id}/stands`);
      setStands(res.data);
    } catch (err) {
      console.error('Failed to fetch stands', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStands();
  }, [selectedProject]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-500 shadow-green-500/20';
      case 'ALLOCATED':
        return 'bg-blue-500 shadow-blue-500/20';
      case 'RESERVED':
        return 'bg-orange-500 shadow-orange-500/20';
      case 'HELD':
        return 'bg-red-500 shadow-red-500/20';
      default:
        return 'bg-secondary-500';
    }
  };

  const filteredStands = stands.filter((stand) => {
    const matchesStatus = statusFilter === 'ALL' || stand.status === statusFilter;
    const matchesSearch = stand.stand_number.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesSize = true;
    if (sizeFilter === 'small') matchesSize = stand.size_sqm < 300;
    else if (sizeFilter === 'medium') matchesSize = stand.size_sqm >= 300 && stand.size_sqm <= 500;
    else if (sizeFilter === 'large') matchesSize = stand.size_sqm > 500;

    return matchesStatus && matchesSearch && matchesSize;
  });

  const {
    currentPage,
    pageSize,
    paginatedItems: paginatedStands,
    rangeEnd,
    rangeStart,
    totalItems,
    totalPages,
    setCurrentPage,
    setPageSize,
  } = usePagination(filteredStands, 12);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, setCurrentPage, sizeFilter, statusFilter, view]);

  const updateStandStatus = async (standId: string, status: string) => {
    try {
      await api.patch(`/projects/${selectedProject?.id}/stands/${standId}`, { status });
      fetchStands();
    } catch (err) {
      console.error('Status update failed', err);
    }
  };

  const exportStandCsv = () => {
    const rows = [
      ['Stand Number', 'Size', 'Base Price', 'Status'],
      ...filteredStands.map((stand) => [
        stand.stand_number,
        String(Math.round(stand.size_sqm)),
        String(Math.round(stand.size_sqm) * stand.price_per_sqm),
        stand.status
      ])
    ];
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `stands_${selectedProject?.name || 'project'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportStandExcel = () => {
    const tableHtml = `
      <table>
        <tr><th>Stand Number</th><th>Size</th><th>Base Price</th><th>Status</th></tr>
        ${filteredStands
          .map(
            (stand) => `
          <tr>
            <td>${stand.stand_number}</td>
            <td>${Math.round(stand.size_sqm)}</td>
            <td>${Math.round(stand.size_sqm) * stand.price_per_sqm}</td>
            <td>${stand.status}</td>
          </tr>
        `
          )
          .join('')}
      </table>
    `;
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stands_${selectedProject?.name || 'project'}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const exportStandPdf = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head><title>Stand Management</title></head>
        <body>
          <h1>Stand Management</h1>
          <table border="1" cellspacing="0" cellpadding="8" width="100%">
            <tr><th>Stand Number</th><th>Size</th><th>Base Price</th><th>Status</th></tr>
            ${filteredStands
              .map(
                (stand) => `
              <tr>
                <td>${stand.stand_number}</td>
                <td>${Math.round(stand.size_sqm)} m²</td>
                <td>${(Math.round(stand.size_sqm) * stand.price_per_sqm).toLocaleString()}</td>
                <td>${stand.status}</td>
              </tr>
            `
              )
              .join('')}
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Stand Management</h1>
          <p className="text-secondary-400 mt-1">Configure and monitor property stands across the project.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportStandPdf}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all"
          >
            <Download size={16} />
            PDF
          </button>
          <button
            onClick={exportStandExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all"
          >
            <Download size={16} />
            Excel
          </button>
          <button
            onClick={exportStandCsv}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all"
          >
            <Download size={16} />
            CSV
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            disabled={!selectedProject}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 border border-white/10 rounded-xl text-sm font-bold transition-all"
          >
            <Upload size={18} />
            Bulk Import
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            disabled={!selectedProject}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary-600/20 active:scale-95"
          >
            <Plus size={20} />
            Add Stand
          </button>
        </div>
      </div>

      <AddStandModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        projectId={selectedProject?.id || ''}
        onSuccess={fetchStands}
      />

      <BulkImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        projectId={selectedProject?.id || ''}
        onSuccess={fetchStands}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
          <button
            onClick={() => setView('list')}
            className={cn(
              'flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all',
              view === 'list' ? 'bg-secondary-800 text-white shadow-lg' : 'text-secondary-500 hover:text-white'
            )}
          >
            <List size={18} />
            List View
          </button>
          <button
            onClick={() => setView('map')}
            className={cn(
              'flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all',
              view === 'map' ? 'bg-secondary-800 text-white shadow-lg' : 'text-secondary-500 hover:text-white'
            )}
          >
            <LayoutGrid size={18} />
            Site Map
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-secondary-500">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-600/50 appearance-none cursor-pointer text-white"
            >
              <option value="ALL" className="bg-secondary-900 text-white">All Status</option>
              <option value="AVAILABLE" className="bg-secondary-900 text-white">Available</option>
              <option value="ALLOCATED" className="bg-secondary-900 text-white">Allocated</option>
              <option value="RESERVED" className="bg-secondary-900 text-white">Reserved</option>
              <option value="HELD" className="bg-secondary-900 text-white">Held</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-secondary-500">Size</span>
            <select
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-600/50 appearance-none cursor-pointer text-white"
            >
              <option value="ALL" className="bg-secondary-900 text-white">All Sizes</option>
              <option value="small" className="bg-secondary-900 text-white">Below 300m²</option>
              <option value="medium" className="bg-secondary-900 text-white">300m² - 500m²</option>
              <option value="large" className="bg-secondary-900 text-white">Above 500m²</option>
            </select>
          </div>
          <div className="h-4 w-px bg-white/10 mx-2"></div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-28 font-bold placeholder:text-secondary-600 text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-secondary-500">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-500"></div> Available</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-500"></div> Allocated</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-orange-500"></div> Reserved</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500"></div> Held</div>
        </div>
      </div>

      <div className="glass rounded-3xl overflow-hidden animate-in min-h-[500px]">
        {loading ? (
          <div className="p-10 text-center text-secondary-500 animate-pulse">Loading stands...</div>
        ) : view === 'list' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-secondary-400 text-xs font-bold uppercase tracking-widest border-b border-white/10">
                  <th className="px-8 py-4">Stand Number</th>
                  <th className="px-8 py-4">Dimensions</th>
                  <th className="px-8 py-4">Base Price</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedStands.map((stand) => (
                  <tr key={stand.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-8 py-4 font-black italic text-lg">{stand.stand_number}</td>
                    <td className="px-8 py-4 text-sm text-secondary-400">{Math.round(stand.size_sqm)} m²</td>
                    <td className="px-8 py-4 text-sm font-bold">${(Math.round(stand.size_sqm) * stand.price_per_sqm).toLocaleString()}</td>
                    <td className="px-8 py-4">
                      <span
                        className={cn(
                          'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white',
                          getStatusColor(stand.status)
                        )}
                      >
                        {stand.status}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {stand.status === 'AVAILABLE' ? (
                          <button
                            onClick={() => updateStandStatus(stand.id, 'HELD')}
                            title="Hold Stand"
                            className="p-2 text-secondary-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          >
                            <Lock size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => updateStandStatus(stand.id, 'AVAILABLE')}
                            title="Release Stand"
                            className="p-2 text-secondary-500 hover:text-green-500 hover:bg-green-500/10 rounded-lg transition-all"
                          >
                            <Unlock size={16} />
                          </button>
                        )}
                        <button className="p-2 text-secondary-500 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="View History">
                          <History size={16} />
                        </button>
                        <button className="p-2 text-secondary-500 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Edit Details">
                          <Edit size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 animate-in grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {paginatedStands.map((stand) => (
              <div
                key={stand.id}
                className={cn(
                  'aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-all cursor-pointer group shadow-xl',
                  stand.status === 'AVAILABLE'
                    ? 'border-green-500/20 bg-green-500/5 hover:bg-green-500/10'
                    : stand.status === 'ALLOCATED'
                      ? 'border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10'
                      : stand.status === 'RESERVED'
                        ? 'border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10'
                        : 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10'
                )}
              >
                <span className="text-xs font-bold text-secondary-500 group-hover:text-secondary-300">Stand</span>
                <span className="text-xl font-black italic">{stand.stand_number.split('-')[1]}</span>
                <div className={cn('w-2 h-2 rounded-full', getStatusColor(stand.status))}></div>
              </div>
            ))}
            {filteredStands.length === 0 && (
              <div className="col-span-full py-20 text-center text-secondary-500 font-bold opacity-30">No stands match your filters.</div>
            )}
          </div>
        )}
      </div>
      {!loading && (
        <div className="glass rounded-3xl overflow-hidden">
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

export default StandManagement;
