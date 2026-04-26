import { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Upload, 
  Plus, 
  Eye,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search
} from 'lucide-react';
import { cn } from '../lib/utils';

const Documents = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock Documents
    setTimeout(() => {
      setDocuments([
        { id: '1', name: 'Purchase Agreement.pdf', type: 'CONTRACT', date: '2026-01-10', status: 'VERIFIED', size: '2.4 MB' },
        { id: '2', name: 'National ID.jpg', type: 'IDENTIFICATION', date: '2026-01-10', status: 'VERIFIED', size: '1.1 MB' },
        { id: '3', name: 'Property Deed Draft.pdf', type: 'OTHER', date: '2026-02-15', status: 'PENDING', size: '0.5 MB' },
      ]);
      setLoading(false);
    }, 600);
  }, []);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Document Vault</h1>
          <p className="text-secondary-400 mt-2">Manage your property contracts, identity documents, and verified proofs of payment.</p>
        </div>
        <button className="flex items-center gap-2 px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-3xl font-black tracking-tight transition-all shadow-xl shadow-primary-600/20 active:scale-95 group">
          <Upload size={22} className="group-hover:-translate-y-1 transition-transform" />
          <span>Upload Document</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
         <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="glass p-6 rounded-3xl flex flex-col gap-4">
               <h3 className="font-bold text-sm uppercase tracking-widest text-secondary-500">Search & Filter</h3>
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-500" size={16} />
                 <input 
                   type="text" 
                   placeholder="Find a document..." 
                   className="w-full bg-secondary-950 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary-600/50 outline-none"
                 />
               </div>
               <div className="flex flex-col gap-2 mt-2">
                  <button className="flex items-center justify-between p-3 rounded-xl bg-primary-600/10 text-primary-400 border border-primary-500/20 text-xs font-bold">
                     All Documents <span>{documents.length}</span>
                  </button>
                  <button className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-secondary-400 text-xs font-bold transition-colors">
                     Contracts <span>1</span>
                  </button>
                  <button className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-secondary-400 text-xs font-bold transition-colors">
                     Receipts <span>0</span>
                  </button>
               </div>
            </div>

            <div className="glass p-6 rounded-3xl border-l-4 border-l-primary-500">
               <div className="flex items-center gap-3 text-primary-400 mb-3">
                 <ShieldCheck size={24} />
                 <h4 className="font-bold">Encrypted Storage</h4>
               </div>
               <p className="text-xs text-secondary-400 leading-relaxed">
                 All documents are stored with end-to-end encryption. Only authorized project administrators can view your uploaded files.
               </p>
            </div>
         </div>

         <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in">
            {loading ? (
               Array(3).fill(0).map((_, i) => (
                 <div key={i} className="h-48 glass rounded-3xl animate-pulse"></div>
               ))
            ) : documents.map((doc) => (
              <div key={doc.id} className="glass p-8 rounded-[2rem] flex flex-col justify-between group glass-hover">
                 <div className="flex items-start justify-between">
                    <div className="p-4 rounded-2xl bg-secondary-900 border border-white/10 text-secondary-400 group-hover:bg-primary-600 group-hover:text-white transition-all">
                      <FileText size={32} />
                    </div>
                    <div className={cn(
                      "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5",
                      doc.status === 'VERIFIED' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                    )}>
                      {doc.status === 'VERIFIED' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      {doc.status}
                    </div>
                 </div>
                 
                 <div className="mt-8">
                    <h4 className="text-lg font-bold group-hover:text-primary-400 transition-colors truncate">{doc.name}</h4>
                    <p className="text-xs text-secondary-500 font-bold uppercase tracking-widest mt-1">{doc.type} • {doc.size}</p>
                 </div>

                 <div className="flex gap-3 mt-8">
                    <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-white/10 group-hover:border-primary-500/30">
                       <Eye size={16} /> View
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-white/10 group-hover:border-primary-500/30">
                       <Download size={16} /> Download
                    </button>
                 </div>
              </div>
            ))}

            <button className="p-12 rounded-[2rem] border-2 border-dashed border-white/10 hover:border-primary-500/50 hover:bg-primary-500/5 transition-all group flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-secondary-600 group-hover:text-primary-400 group-hover:bg-primary-500/10 transition-all">
                <Plus size={32} />
              </div>
              <div className="text-center">
                <span className="text-lg font-black block text-secondary-400 group-hover:text-primary-400">Additional File</span>
                <span className="text-xs text-secondary-500 mt-1 block">Drag and drop or click to upload</span>
              </div>
            </button>
         </div>
      </div>
    </div>
  );
};

export default Documents;
