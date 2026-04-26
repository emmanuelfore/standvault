import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Filter, 
  Download, 
  ChevronRight, 
  ChevronLeft, 
  BarChart3,
  Check,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';

interface CustomReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

const CustomReportModal: React.FC<CustomReportModalProps> = ({ isOpen, onClose, projectId }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [config, setConfig] = useState({
    startDate: '',
    endDate: '',
    includePayments: true,
    includeCharges: true,
    includeArrears: false,
    format: 'xlsx'
  });
  const [previewData, setPreviewData] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setPreviewData(null);
    }
  }, [isOpen]);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      // Mocking preview for now based on actual data structure
      const res = await api.get(`/projects/${projectId}/dashboard`);
      setPreviewData({
        total_items: res.data.recentActivity.length,
        columns: ['Buyer', 'Type', 'Amount', 'Date'],
        sample_rows: res.data.recentActivity.map((a: any) => [
          a.buyer,
          a.type.toUpperCase(),
          `$${a.amount.toLocaleString()}`,
          new Date(a.date).toLocaleDateString()
        ]),
        stats: res.data
      });
      setStep(3);
    } catch (err) {
      console.error('Preview failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const response = await api.get(`/projects/${projectId}/reports/custom`, {
        params: config,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `custom-report-${new Date().getTime()}.${config.format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      onClose();
    } catch (err) {
      console.error('Download failed', err);
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-950/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl glass rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-8 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <BarChart3 className="text-primary-500" />
              Custom Report Wizard
            </h2>
            <p className="text-secondary-400 text-sm mt-1">Step {step} of 3: {
              step === 1 ? 'Configure Scope' : step === 2 ? 'Select Modules' : 'Review & Generate'
            }</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-secondary-400">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-10 flex-1 overflow-y-auto max-h-[60vh]">
          {step === 1 && (
            <div className="flex flex-col gap-8 animate-in">
              <div className="grid grid-cols-2 gap-6">
                 <div className="flex flex-col gap-2">
                    <label className="text-xs font-black uppercase text-secondary-500 tracking-widest ml-1">Period Start</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600" size={18} />
                      <input 
                        type="date" 
                        value={config.startDate}
                        onChange={(e) => setConfig({...config, startDate: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary-600/50" 
                      />
                    </div>
                 </div>
                 <div className="flex flex-col gap-2">
                    <label className="text-xs font-black uppercase text-secondary-500 tracking-widest ml-1">Period End</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600" size={18} />
                      <input 
                        type="date" 
                        value={config.endDate}
                        onChange={(e) => setConfig({...config, endDate: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary-600/50" 
                      />
                    </div>
                 </div>
              </div>

              <div className="bg-primary-600/5 border border-primary-600/10 p-6 rounded-3xl flex items-start gap-4">
                 <Filter className="text-primary-500 mt-1" size={20} />
                 <div>
                    <p className="font-bold text-sm">Automated reconciliation check</p>
                    <p className="text-xs text-secondary-400 mt-1">Data from closed reconciliation periods will be marked as "Finalized" in the report footer.</p>
                 </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-6 animate-in">
              <p className="font-bold text-secondary-200">What data should be included?</p>
              <div className="grid grid-cols-1 gap-4">
                 {[
                   { id: 'includePayments', label: 'Payment Transactions', sub: 'Include all verified and pending buyer payments.' },
                   { id: 'includeCharges', label: 'Additional Charges', sub: 'Batch and individual charges applied to buyer ledgers.' },
                   { id: 'includeArrears', label: 'Arrears & Aging', sub: 'Calculated default amounts and payment aging markers.' },
                 ].map((mod) => (
                   <button 
                    key={mod.id}
                    onClick={() => setConfig({...config, [mod.id]: !config[mod.id as keyof typeof config]})}
                    className={cn(
                      "p-6 rounded-[2rem] border transition-all text-left flex items-center justify-between group",
                      config[mod.id as keyof typeof config] 
                        ? "bg-primary-600/10 border-primary-510" 
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    )}
                   >
                     <div>
                       <p className="font-black text-lg">{mod.label}</p>
                       <p className="text-sm text-secondary-500 mt-1">{mod.sub}</p>
                     </div>
                     <div className={cn(
                       "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                       config[mod.id as keyof typeof config] ? "bg-primary-600 text-white" : "bg-white/5 border border-white/10"
                     )}>
                       {config[mod.id as keyof typeof config] && <Check size={18} />}
                     </div>
                   </button>
                 ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-8 animate-in mt-[-1rem]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xl">Report Preview</h3>
                  <p className="text-sm text-secondary-500">Based on your filters, this report contains {previewData?.total_items} data points.</p>
                </div>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                   <button 
                    onClick={() => setConfig({...config, format: 'xlsx'})}
                    className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", config.format === 'xlsx' ? "bg-green-600 text-white shadow-lg" : "text-secondary-500")}
                   >XLSX</button>
                   <button 
                    onClick={() => setConfig({...config, format: 'pdf'})}
                    className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", config.format === 'pdf' ? "bg-red-600 text-white shadow-lg" : "text-secondary-500")}
                   >PDF</button>
                </div>
              </div>

              <div className="glass rounded-3xl overflow-hidden border border-white/10">
                <table className="w-full text-left text-xs">
                   <thead className="bg-white/5 text-secondary-500 font-black uppercase tracking-widest border-b border-white/10">
                      <tr>
                        {previewData?.columns.map((c: string) => <th key={c} className="px-6 py-4">{c}</th>)}
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                      {previewData?.sample_rows.map((r: any, i: number) => (
                        <tr key={i}>
                          {r.map((cell: any, j: number) => <td key={j} className="px-6 py-4 font-bold">{cell}</td>)}
                        </tr>
                      ))}
                   </tbody>
                </table>
              </div>
              <p className="text-[10px] text-center text-secondary-500 italic uppercase tracking-widest">Showing first {previewData?.sample_rows.length} rows as preview</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-8 bg-white/5 border-t border-white/10 flex items-center justify-between">
          <button 
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-2 px-6 py-3 text-secondary-400 hover:text-white font-bold transition-all"
          >
            {step === 1 ? 'Cancel' : <><ChevronLeft size={20} /> Back</>}
          </button>
          
          <button 
            disabled={loading || generating}
            onClick={() => {
              if (step === 1) setStep(2);
              else if (step === 2) fetchPreview();
              else handleDownload();
            }}
            className="flex items-center gap-3 px-10 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black shadow-xl shadow-primary-600/30 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading || generating ? (
              <><Loader2 size={20} className="animate-spin" /> Processing...</>
            ) : (
              <>
                {step === 3 ? 'Download Master Report' : 'Continue'}
                {step < 3 && <ChevronRight size={20} />}
                {step === 3 && <Download size={20} />}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomReportModal;
