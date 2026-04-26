import { useState } from 'react';
import { 
  Upload, 
  FileText, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

const PopUpload = () => {
  const { user } = useAuth() as any;
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user?.buyerId) return;
    
    setLoading(true);
    
    try {
      // 1. Upload file
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const fileUrl = uploadRes.data.url;

      // 2. Submit PoP record
      await api.post(`/buyers/${user.buyerId}/pop`, {
        amount: Number(amount),
        payment_date: new Date(date).toISOString(),
        file_url: fileUrl
      });

      setSuccess(true);
    } catch (err: any) {
      console.error('Failed to submit PoP', err);
      alert(err.response?.data?.error || 'Failed to submit Proof of Payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-6 animate-in">
         <div className="w-24 h-24 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center border-4 border-green-500/20">
            <CheckCircle2 size={48} />
         </div>
         <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight">Proof Submitted!</h2>
            <p className="text-secondary-400 mt-2 max-w-sm mx-auto">
               Your Proof of Payment has been queued for verification. You will be notified once an administrator approves the transaction.
            </p>
         </div>
         <Link to="/" className="mt-4 px-8 py-3 bg-secondary-900 border border-white/10 rounded-2xl font-bold hover:bg-white/5 transition-all">
            Back to Dashboard
         </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
      <div className="flex flex-col gap-8">
        <Link to="/" className="flex items-center gap-2 text-secondary-400 hover:text-white transition-colors w-fit">
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </Link>
        <div>
          <h1 className="text-4xl font-black tracking-tight">Submit Proof of Payment</h1>
          <p className="text-secondary-400 mt-2 text-lg italic">Help us verify your payment faster by providing clear documentation.</p>
        </div>

        <div className="glass p-8 rounded-[2rem] border-primary-500/10 bg-primary-600/5">
           <h3 className="font-bold flex items-center gap-2 text-primary-400 mb-4">
              <AlertCircle size={20} />
              Verification Tips
           </h3>
           <ul className="flex flex-col gap-3 text-sm text-secondary-400">
              <li className="flex items-start gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1.5 shrink-0"></div>
                 Ensure the bank reference number is clearly visible.
              </li>
              <li className="flex items-start gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1.5 shrink-0"></div>
                 File formats accepted: PDF, JPG, PNG (Max 5MB).
              </li>
              <li className="flex items-start gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1.5 shrink-0"></div>
                 Processing usually takes 24-48 hours during business days.
              </li>
           </ul>
        </div>
      </div>

      <div className="glass p-8 md:p-10 rounded-[2.5rem] border-white/10 shadow-2xl animate-in">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
           <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Paid Amount ($)</label>
              <div className="relative">
                 <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600" size={20} />
                 <input 
                   type="number" 
                   value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                   placeholder="0.00"
                   className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-bold text-xl"
                   required
                 />
              </div>
           </div>

           <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Payment Date</label>
              <div className="relative">
                 <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600" size={20} />
                 <input 
                   type="date" 
                   value={date}
                   onChange={(e) => setDate(e.target.value)}
                   className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all"
                   required
                 />
              </div>
           </div>

           <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Proof Document</label>
              <div 
                 className={cn(
                   "relative border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center gap-4 transition-all",
                   file ? "border-primary-500/50 bg-primary-500/5" : "border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10"
                 )}
              >
                 <input 
                   type="file" 
                   className="absolute inset-0 opacity-0 cursor-pointer"
                   onChange={(e) => setFile(e.target.files?.[0] || null)}
                 />
                 {file ? (
                   <div className="flex flex-col items-center gap-2">
                      <div className="p-3 bg-primary-600 rounded-2xl text-white shadow-lg">
                        <FileText size={32} />
                      </div>
                      <div className="text-center">
                        <p className="font-bold truncate max-w-[200px]">{file.name}</p>
                        <p className="text-[10px] text-secondary-500 uppercase font-black uppercase tracking-widest mt-1">Ready to upload</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        className="mt-2 text-xs text-red-500 font-bold hover:underline flex items-center gap-1"
                      >
                        <X size={12} /> Remove
                      </button>
                   </div>
                 ) : (
                   <>
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-secondary-400 group-hover:text-primary-400">
                        <Upload size={32} />
                      </div>
                      <div className="text-center">
                        <p className="font-bold italic">Select payment receipt</p>
                        <p className="text-xs text-secondary-500 mt-1">Tap here to choose a file</p>
                      </div>
                   </>
                 )}
              </div>
           </div>

           <button 
             type="submit"
             disabled={loading || !file}
             className="w-full flex items-center justify-center gap-3 py-5 bg-primary-600 hover:bg-primary-700 disabled:bg-white/5 disabled:text-secondary-600 disabled:border-white/10 border-transparent text-white rounded-3xl font-black text-xl transition-all shadow-2xl shadow-primary-600/30 active:scale-[0.98] mt-4"
           >
             {loading ? (
               <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
             ) : (
               "Upload & Notify Admin"
             )}
           </button>
        </form>
      </div>
    </div>
  );
};

export default PopUpload;
