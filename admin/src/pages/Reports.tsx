import { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Calendar, 
  Filter, 
  BarChart3, 
  PieChart, 
  ArrowRight,
  Shield,
  FileCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useProject } from '../contexts/ProjectContext';
import api from '../lib/api';
import CustomReportModal from '../components/CustomReportModal';
import { 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { Loader2, ExternalLink, Search, RefreshCw, Layers } from 'lucide-react';
import ReportDetailPanel from '../components/ReportDetailPanel';

const reportTypes = [
  { id: 'aged-debt', title: 'Aged Debt Report', description: 'Detailed breakdown of outstanding payments sorted by age.', icon: BarChart3, color: 'text-red-500', bg: 'bg-red-500/10' },
  { id: 'collection-summary', title: 'Collection Summary', description: 'Overview of total funds collected vs expected per period.', icon: PieChart, color: 'text-green-500', bg: 'bg-green-500/10' },
  { id: 'defaulters', title: 'Defaulters List', description: 'Identify buyers who have missed consecutive payments.', icon: Filter, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'project-summary', title: 'Project Status Summary', description: 'High-level financial health and stand allocation metrics.', icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'stand-registry', title: 'Stand Registry', description: 'Full list of project stands and their current allocation status.', icon: Layers, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'cashflow', title: 'Projected Cashflow', description: 'Estimated future collections based on current schedules.', icon: BarChart3, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'month-end', title: 'Month-End Reconciliation', description: 'Closing report for financial period audits.', icon: Calendar, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { id: 'verification-report', title: 'Verification Status', description: 'Audit of pending vs verified payment receipts.', icon: FileCheck, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { id: 'collections-breakdown', title: 'Allocation Breakdown', description: 'Detailed mapping of payments to property vs fee accounts.', icon: Layers, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'audit-log', title: 'System Audit Trail', description: 'Administrative action logs and security footprint.', icon: Shield, color: 'text-slate-500', bg: 'bg-slate-500/10' },
];

const Reports = () => {
  const { selectedProject } = useProject();
  const [activeReport, setActiveReport] = useState(reportTypes[0].id);
  const [reportData, setReportData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const fetchStats = async () => {
    if (!selectedProject) return;
    try {
      const res = await api.get(`/projects/${selectedProject.id}/dashboard`);
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    } finally {
      // Stats update independently from report table loading.
    }
  };

  const fetchReport = async (type: string) => {
    if (!selectedProject) return;
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      
      const res = await api.get(`/projects/${selectedProject.id}/reports/${type}?${params.toString()}`);
      setReportData(res.data);
    } catch (err) {
      console.error('Failed to fetch report data', err);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProject) {
      fetchStats();
      fetchReport(activeReport);
    }
  }, [selectedProject, activeReport]);

  const handleDownload = async (type: string, format: string) => {
    if (!selectedProject) return;
    setDownloading(`${type}-${format}`);
    try {
      const response = await api.get(`/projects/${selectedProject.id}/reports/${type}?format=${format}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-report.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download report', err);
    } finally {
      setDownloading(null);
    }
  };

  // Row expansion is deprecated to reduce reporting clutter as per auditor feedback.

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
          <FileText size={40} className="text-secondary-600" />
        </div>
        <h2 className="text-2xl font-bold">Select a Project First</h2>
        <p className="text-secondary-500 mt-2">You need to select a project to generate reports.</p>
      </div>
    );
  }

  const filteredRows = (reportData?.rows || []).filter((row: any[]) => {
    const matchesSearch = row.some(cell => String(cell).toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || row.some(cell => String(cell).includes(statusFilter));
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Dynamic Header Stats */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-2">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Report Engine <span className="text-primary-500 text-sm font-bold align-top ml-1">v2.0</span></h1>
          <p className="text-secondary-400 text-sm mt-1 flex items-center gap-2">
            <Layers size={14} className="text-primary-500" /> Live auditing & performance metrics for {selectedProject.name}
          </p>
        </div>

        {stats && (
          <div className="flex items-center gap-6 bg-white/5 border border-white/10 rounded-3xl p-4 animate-in">
             <div className="px-4">
                <p className="text-[10px] font-black uppercase text-secondary-500 tracking-widest mb-1">Active Accounts</p>
                <p className="text-lg font-black">{stats.totalBuyers}</p>
             </div>
             <div className="h-8 w-px bg-white/10"></div>
             <div className="px-4">
                <p className="text-[10px] font-black uppercase text-secondary-500 tracking-widest mb-1">Project Yield</p>
                <p className="text-lg font-black text-green-500">{stats.collectionProgress}%</p>
             </div>
             <div className="h-8 w-px bg-white/10"></div>
             <div className="px-4">
                <p className="text-[10px] font-black uppercase text-secondary-500 tracking-widest mb-1">Total Liquid</p>
                <p className="text-lg font-black">${Number(stats.totalCollected).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
             </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[70vh]">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-72 flex flex-col gap-2">
           <div className="bg-white/5 rounded-3xl border border-white/10 p-4 space-y-1">
              <p className="text-[10px] font-black uppercase text-secondary-500 tracking-[0.2em] mb-4 ml-4">Report Categories</p>
              {reportTypes.map(r => (
                 <button
                    key={r.id}
                    onClick={() => setActiveReport(r.id)}
                    className={cn(
                       "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group relative overflow-hidden",
                       activeReport === r.id ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20" : "text-secondary-400 hover:bg-white/5 hover:text-white"
                    )}
                 >
                    <r.icon size={20} className={cn(activeReport === r.id ? "text-white" : reportData ? r.color : "text-secondary-500")} />
                    <span>{r.title}</span>
                    {activeReport === r.id && <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20"></div>}
                 </button>
              ))}
              
              <div className="pt-4 mt-4 border-t border-white/5 gap-2 flex flex-col">
                 <button 
                  onClick={() => setIsWizardOpen(true)}
                  className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-white/5 text-secondary-300 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all group"
                 >
                    <span>Custom Wizard</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-all" />
                 </button>
              </div>
           </div>

           {/* Quick Reference Chart (Conditional) */}
           {activeReport === 'aged-debt' && stats?.agedDebtDistribution && (
              <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
                 <p className="text-[10px] font-black uppercase text-secondary-500 tracking-widest mb-4 italic">Arrears Snapshot</p>
                 <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <RePieChart>
                          <Pie 
                            data={stats.agedDebtDistribution} 
                            innerRadius={45} 
                            outerRadius={65} 
                            paddingAngle={5} 
                            dataKey="value"
                          >
                             {stats.agedDebtDistribution.map((_: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={['#22c55e', '#eab308', '#f97316', '#ef4444'][index]} stroke="none" />
                             ))}
                          </Pie>
                       </RePieChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col gap-6">
           <div className="bg-neutral-900/50 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 flex-1 flex flex-col overflow-hidden min-h-[600px] shadow-2xl">
              {/* Toolbar */}
              <div className="p-6 border-b border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 bg-white/[0.02]">
                 <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600" size={16} />
                       <input 
                        type="text" 
                        placeholder="Search report..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary-600/50 text-sm font-medium transition-all"
                       />
                    </div>
                    <button 
                      onClick={() => fetchReport(activeReport)}
                      className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-secondary-400 hover:text-white active:rotate-180 duration-500"
                    >
                       <RefreshCw size={20} />
                    </button>
                     
                     {['stand-registry', 'project-summary'].includes(activeReport) && (
                        <div className="flex items-center gap-2 ml-4 px-4 border-l border-white/10">
                           <p className="text-[10px] font-black uppercase text-secondary-600 tracking-widest">Status:</p>
                           <select 
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value)}
                              className="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold outline-none text-white cursor-pointer"
                           >
                              <option value="ALL" className="bg-neutral-900">All Project Units</option>
                              <option value="AVAILABLE" className="bg-neutral-900">Available Stands</option>
                              <option value="SOLD" className="bg-neutral-900">Sold (Completed)</option>
                              <option value="ALLOCATED" className="bg-neutral-900">Allocated (In Progress)</option>
                           </select>
                        </div>
                     )}

                     <div className="flex items-center gap-2 ml-4 px-4 border-l border-white/10">
                        <p className="text-[10px] font-black uppercase text-secondary-600 tracking-widest text-primary-500">Auditing Period:</p>
                        <input 
                           type="date" 
                           value={startDate}
                           onChange={(e) => setStartDate(e.target.value)}
                           className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-primary-500"
                        />
                        <span className="text-secondary-600 text-[10px] font-black">TO</span>
                        <input 
                           type="date" 
                           value={endDate}
                           onChange={(e) => setEndDate(e.target.value)}
                           className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-primary-500"
                        />
                     </div>
                 </div>

                 <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleDownload(activeReport, 'xlsx')}
                      disabled={!!downloading}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-emerald-600/20 active:scale-95"
                    >
                       <Download size={14} /> XLSX
                    </button>
                    <button 
                      onClick={() => handleDownload(activeReport, 'pdf')}
                      disabled={!!downloading}
                      className="flex items-center gap-2 px-6 py-3 bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-rose-600/20 active:scale-95"
                    >
                       <Download size={14} /> PDF
                    </button>
                 </div>
              </div>

              {/* Data Display */}
              <div className="flex-1 overflow-auto custom-scrollbar">
                 {reportLoading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 py-32">
                       <Loader2 size={48} className="text-primary-500 animate-spin" />
                       <p className="text-secondary-500 font-black uppercase tracking-[0.3em] text-[10px]">Processing Financial Datasets...</p>
                    </div>
                 ) : (reportData?.rows && reportData?.headers) ? (
                    <div className="p-0">
                       {/* Section Summary (Optional Chart) */}
                       {activeReport === 'cashflow' && (
                          <div className="p-8 pb-4">
                             <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                   <AreaChart data={(reportData?.rows || []).map((r: any[]) => ({ name: r[0], amount: Number(r[1]) }))}>
                                      <defs>
                                         <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                         </linearGradient>
                                      </defs>
                                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '1rem' }} />
                                      <Area type="monotone" dataKey="amount" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAmt)" />
                                   </AreaChart>
                                </ResponsiveContainer>
                             </div>
                          </div>
                       )}

                       <table className="w-full text-left">
                          <thead className="bg-white/5 text-secondary-500 font-black uppercase tracking-widest text-[9px] sticky top-0 z-10 backdrop-blur-md">
                             <tr>
                                <th className="px-8 py-5 w-12">#</th>
                                {(reportData?.headers || []).map((h: string) => (
                                   <th key={h} className="px-8 py-5">{h}</th>
                                ))}
                                <th className="px-8 py-5 text-right">Actions</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 font-medium">
                             {filteredRows?.map((row: any[], i: number) => {
                                return (
                                   <tr key={i} className="hover:bg-white/[0.03] transition-colors group">
                                      <td className="px-8 py-4 text-[10px] text-secondary-600 font-bold">{i + 1}</td>
                                      {row.map((cell, j) => (
                                         <td key={j} className={cn("px-8 py-4 text-sm", j === 0 ? "font-black text-white" : "text-secondary-300")}>
                                            {cell}
                                         </td>
                                      ))}
                                      <td className="px-8 py-4 text-right">
                                         <button 
                                           onClick={() => {
                                              setSelectedBuyerId(reportData?.rowMeta?.[i]?.id);
                                              if (reportData?.rowMeta?.[i]?.type === 'buyer') setIsPanelOpen(true);
                                           }}
                                           className={cn(
                                              "p-2 bg-white/5 group-hover:bg-primary-600/20 rounded-lg text-secondary-500 group-hover:text-primary-400 transition-all",
                                              !reportData?.rowMeta?.[i]?.id && "opacity-0 pointer-events-none"
                                           )}
                                         >
                                            <ExternalLink size={16} />
                                         </button>
                                      </td>
                                   </tr>
                                );
                             })}
                             {filteredRows?.length === 0 && (
                                <tr>
                                   <td colSpan={reportData.headers.length + 2} className="py-24 text-center">
                                      <div className="flex flex-col items-center gap-3">
                                         <Search size={40} className="text-secondary-700 mb-2" />
                                         <p className="text-secondary-500 text-sm font-bold">No records matched your search criteria.</p>
                                         <button onClick={() => setSearchTerm('')} className="text-primary-500 text-xs font-black uppercase tracking-widest mt-2 hover:underline">Clear Search Filter</button>
                                      </div>
                                   </td>
                                </tr>
                             )}
                          </tbody>
                       </table>
                    </div>
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-4 py-32 text-secondary-700">
                       <BarChart3 size={64} />
                       <p className="font-bold">Select a report from the sidebar to begin analysis.</p>
                    </div>
                 )}
              </div>
              
              {/* Report Footer / Notice */}
              {reportData?.notice && (
                 <div className="px-8 py-4 bg-rose-600/10 border-t border-rose-600/20 flex items-center gap-3 animate-pulse">
                    <div className="w-2 h-2 bg-rose-600 rounded-full"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">{reportData.notice}</p>
                 </div>
              )}
           </div>
        </div>
      </div>

      <CustomReportModal 
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        projectId={selectedProject.id}
      />

      <ReportDetailPanel 
         isOpen={isPanelOpen}
         onClose={() => setIsPanelOpen(false)}
         buyerId={selectedBuyerId}
      />
    </div>
  );
};

export default Reports;
