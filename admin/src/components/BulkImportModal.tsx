import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import api from '../lib/api';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: () => void;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, projectId, onSuccess }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const result = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, i) => {
            if (header === 'size_sqm' || header === 'price_per_sqm') {
              obj[header] = Number(values[i]);
            } else {
              obj[header] = values[i];
            }
          });
          return obj;
        });

        setData(result);
      } catch (err) {
        setError('Failed to parse CSV file. Ensure it has correct headers.');
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (data.length === 0) return;
    setLoading(true);
    setError('');

    try {
      await api.post(`/projects/${projectId}/stands/bulk`, data);
      
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
        setData([]);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to import stands');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-950/80 backdrop-blur-sm animate-in fade-in" onClick={onClose}></div>
      
      <div className="glass w-full max-w-2xl rounded-[2.5rem] border-white/10 shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
        {success ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center border-4 border-green-500/20">
              <CheckCircle2 size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Import Successful!</h2>
              <p className="text-secondary-400 mt-2">{data.length} stands have been added to the project.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5 shrink-0">
              <div>
                <h2 className="text-xl font-bold">Bulk Import Stands</h2>
                <p className="text-xs text-secondary-400 mt-1">Upload a CSV file with stand data</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors text-secondary-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto">
              {data.length === 0 ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 hover:border-primary-500/50 hover:bg-white/5 transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-secondary-500 group-hover:text-primary-400 transition-colors">
                    <Upload size={32} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-lg">Click to upload CSV</p>
                    <p className="text-secondary-500 text-sm mt-1">Required headers: stand_number, size_sqm, price_per_sqm</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".csv" 
                    onChange={handleFileUpload} 
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-secondary-400 uppercase tracking-widest text-xs">Preview ({data.length} stands)</h3>
                    <button onClick={() => setData([])} className="text-red-500 text-xs font-bold flex items-center gap-2 hover:underline">
                      <Trash2 size={14} /> Clear
                    </button>
                  </div>
                  <div className="rounded-2xl border border-white/10 overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white/5 text-secondary-500 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="px-4 py-2">Number</th>
                          <th className="px-4 py-2">Size</th>
                          <th className="px-4 py-2">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-t border-white/5">
                            <td className="px-4 py-2 font-medium">{row.stand_number}</td>
                            <td className="px-4 py-2 text-secondary-400">{row.size_sqm} m²</td>
                            <td className="px-4 py-2 text-secondary-400">${row.price_per_sqm}/m²</td>
                          </tr>
                        ))}
                        {data.length > 5 && (
                          <tr className="border-t border-white/5">
                            <td colSpan={3} className="px-4 py-2 text-center text-secondary-600 italic">
                              + {data.length - 5} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 mt-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </div>

            <div className="p-8 border-t border-white/5 bg-white/5 shrink-0">
               <button 
                onClick={handleSubmit}
                disabled={loading || data.length === 0}
                className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-primary-600/30 flex items-center justify-center gap-3"
              >
                {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Confirm & Start Import'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BulkImportModal;
