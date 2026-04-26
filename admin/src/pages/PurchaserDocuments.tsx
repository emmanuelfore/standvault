import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Download, FileText, Search, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const PurchaserDocuments = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!user?.buyerId) return;

      try {
        const response = await api.get(`/buyers/${user.buyerId}/documents`);
        setDocuments(response.data);
      } catch (err) {
        console.error('Failed to fetch documents', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [user?.buyerId]);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Document Vault</h1>
          <p className="text-secondary-400 mt-2">Access your agreements, uploaded proofs, and account documents.</p>
        </div>
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
          </div>

          <div className="glass p-6 rounded-3xl border-l-4 border-l-primary-500">
            <div className="flex items-center gap-3 text-primary-400 mb-3">
              <ShieldCheck size={24} />
              <h4 className="font-bold">Protected Records</h4>
            </div>
            <p className="text-xs text-secondary-400 leading-relaxed">
              Purchaser documents are shown according to your account and verified uploads only.
            </p>
          </div>
        </div>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in">
          {loading ? (
            Array(3)
              .fill(0)
              .map((_, index) => <div key={index} className="h-48 glass rounded-3xl animate-pulse"></div>)
          ) : documents.length === 0 ? (
            <div className="glass rounded-3xl p-10 text-center text-secondary-500 md:col-span-2">
              No documents are currently available on your account.
            </div>
          ) : (
            documents.map((document) => (
              <div key={document.id} className="glass p-8 rounded-[2rem] flex flex-col justify-between group glass-hover">
                <div className="flex items-start justify-between">
                  <div className="p-4 rounded-2xl bg-secondary-900 border border-white/10 text-secondary-400 group-hover:bg-primary-600 group-hover:text-white transition-all">
                    <FileText size={32} />
                  </div>
                  <div
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5',
                      document.verified
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    )}
                  >
                    {document.verified ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                    {document.verified ? 'VERIFIED' : 'PENDING'}
                  </div>
                </div>

                <div className="mt-8">
                  <h4 className="text-lg font-bold group-hover:text-primary-400 transition-colors truncate">{document.title}</h4>
                  <p className="text-xs text-secondary-500 font-bold uppercase tracking-widest mt-1">
                    {document.document_type} • {new Date(document.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-3 mt-8">
                  {document.versions?.[0]?.file_url ? (
                    <a
                      href={document.versions[0].file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-white/10"
                    >
                      <Download size={16} /> Download
                    </a>
                  ) : (
                    <div className="flex-1 flex items-center justify-center py-3 bg-white/5 rounded-xl text-xs font-bold border border-white/10 text-secondary-500">
                      File unavailable
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaserDocuments;
