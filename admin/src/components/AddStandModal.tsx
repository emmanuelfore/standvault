import React, { useState } from 'react';
import { X, MapPin, Maximize2, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../lib/api';

interface AddStandModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: () => void;
}

const AddStandModal: React.FC<AddStandModalProps> = ({ isOpen, onClose, projectId, onSuccess }) => {
  const [standNumber, setStandNumber] = useState('');
  const [sizeSqm, setSizeSqm] = useState('');
  const [pricePerSqm, setPricePerSqm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post(`/projects/${projectId}/stands`, {
        stand_number: standNumber,
        size_sqm: Number(sizeSqm),
        price_per_sqm: Number(pricePerSqm)
      });
      
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
        setStandNumber('');
        setSizeSqm('');
        setPricePerSqm('');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add stand');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-950/80 backdrop-blur-sm animate-in fade-in" onClick={onClose}></div>
      
      <div className="glass w-full max-w-lg rounded-[2.5rem] border-white/10 shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
        {success ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center border-4 border-green-500/20">
              <CheckCircle2 size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Stand Added!</h2>
              <p className="text-secondary-400 mt-2">The stand has been correctly registered in the project.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div>
                <h2 className="text-xl font-bold">Add New Stand</h2>
                <p className="text-xs text-secondary-400 mt-1">Register a new property stand</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors text-secondary-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Stand Number</label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                  <input 
                    type="text" 
                    value={standNumber}
                    onChange={(e) => setStandNumber(e.target.value)}
                    placeholder="e.g. B-102"
                    className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-bold text-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Size (sqm)</label>
                  <div className="relative group">
                    <Maximize2 className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                    <input 
                      type="number" 
                      value={sizeSqm}
                      onChange={(e) => setSizeSqm(e.target.value)}
                      placeholder="200"
                      className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Price per sqm</label>
                  <div className="relative group">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                    <input 
                      type="number" 
                      value={pricePerSqm}
                      onChange={(e) => setPricePerSqm(e.target.value)}
                      placeholder="50"
                      className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all text-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-primary-600/5 border border-primary-500/10 flex justify-between items-center">
                 <span className="text-xs text-secondary-400 font-bold uppercase tracking-wider">Total Base Price:</span>
                 <span className="text-lg font-black text-primary-400">
                   ${((Number(sizeSqm) || 0) * (Number(pricePerSqm) || 0)).toLocaleString()}
                 </span>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-primary-600/30 flex items-center justify-center gap-3"
              >
                {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Confirm & Add Stand'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default AddStandModal;
