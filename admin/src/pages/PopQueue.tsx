import { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Calendar, 
  User, 
  FileText,
  DollarSign,
  Download,
  Loader2,
  Search
} from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';
import { useProject } from '../contexts/ProjectContext';
import { useNavigate } from 'react-router-dom';

interface PoPSubmission {
  id: string;
  buyer_id: string;
  buyer_name: string;
  stand_number: string;
  amount: number;
  date_submitted: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  file_url: string;
  rejection_count: number;
}

const PopQueue = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<PoPSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<PoPSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewingFile, setViewingFile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { selectedProject } = useProject();
  const previewSubmission = viewingFile ? selectedSubmission : null;

  const fetchQueue = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const response = await api.get(`/projects/${selectedProject.id}/pop/queue`);
      const mapped = response.data.map((s: any) => ({
        id: s.id,
        buyer_id: s.buyer.id,
        buyer_name: `${s.buyer.first_name} ${s.buyer.last_name}`,
        stand_number: s.buyer.stand.stand_number,
        amount: Number(s.amount),
        date_submitted: new Date(s.created_at).toLocaleString(),
        status: s.status,
        file_url: s.file_url,
        rejection_count: s.rejection_count || 0
      }));
      setSubmissions(mapped);
    } catch (err) {
      console.error('Failed to fetch PoP queue', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => 
      s.buyer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.stand_number.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [submissions, searchTerm]);

  useEffect(() => {
    fetchQueue();
  }, [selectedProject]);

  const handleApprove = async (submission: PoPSubmission, openStatement = false) => {
    setIsProcessing(true);
    try {
      await api.post(`/pop/${submission.id}/approve`);
      setSubmissions(prev => prev.filter(s => s.id !== submission.id));
      setSelectedSubmission(null);
      if (openStatement) {
        navigate(`/buyers/${submission.buyer_id}?tab=ledger`);
      }
    } catch (err) {
      console.error('Failed to approve PoP', err);
      alert('Failed to approve PoP');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason) return;
    setIsProcessing(true);
    try {
      await api.post(`/pop/${id}/reject`, { reason: rejectReason });
      setSubmissions(prev => prev.filter(s => s.id !== id));
      setSelectedSubmission(null);
      setRejectReason('');
    } catch (err) {
      console.error('Failed to reject PoP', err);
      alert('Failed to reject PoP');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Proof of Payment Queue</h1>
          <p className="text-secondary-400 mt-1">Review and approve proof of payment submissions from purchasers.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-500" size={16} />
            <input 
              type="text" 
              placeholder="Search by name or stand..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-secondary-950 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs font-medium focus:ring-2 focus:ring-primary-600/50 outline-none w-64"
            />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-primary-600/10 text-primary-400 rounded-xl border border-primary-500/20 font-bold">
            <ClipboardCheck size={20} />
            <span>{submissions.length} Pending Actions</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-24 glass rounded-2xl animate-pulse"></div>
            ))
          ) : submissions.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center flex flex-col items-center gap-4 justify-center">
              <div className="w-16 h-16 rounded-full bg-white/5 text-secondary-600 flex items-center justify-center">
                <ClipboardCheck size={32} />
              </div>
              <h3 className="text-xl font-bold">Queue is empty</h3>
              <p className="text-secondary-500">There are no pending proof of payments to review.</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-secondary-900 text-secondary-500 flex items-center justify-center">
                <Search size={32} />
              </div>
              <h3 className="text-xl font-bold">No matches found</h3>
              <p className="text-secondary-500">Try adjusting your search criteria.</p>
            </div>
          ) : filteredSubmissions.map((sub) => (
            <div 
              key={sub.id} 
              onClick={() => setSelectedSubmission(sub)}
              className={cn(
                "glass p-5 rounded-2xl flex items-center justify-between cursor-pointer border transition-all",
                selectedSubmission?.id === sub.id ? "bg-white/10 border-primary-500/50 shadow-lg shadow-primary-600/10" : "bg-white/5 border-white/5 hover:bg-white/10"
              )}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary-900 border border-white/10 flex items-center justify-center text-secondary-400">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="font-bold">{sub.buyer_name}</h4>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-secondary-500">
                    <span className="flex items-center gap-1"><DollarSign size={10} /> {sub.amount}</span>
                    <span className="flex items-center gap-1 font-bold text-secondary-400 uppercase tracking-tighter">Stand {sub.stand_number}</span>
                    {sub.rejection_count > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[8px] font-black border border-red-500/20">
                            {sub.rejection_count} PAST REJECTIONS
                        </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-secondary-500 uppercase font-black tracking-widest">{sub.date_submitted.split(' ')[0]}</p>
                <p className="text-xs text-secondary-400 mt-0.5">{sub.date_submitted.split(' ')[1]}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Panel */}
        <div className="lg:sticky lg:top-28 h-fit">
          {selectedSubmission ? (
            <div className="glass rounded-3xl overflow-hidden animate-in border-primary-500/20">
              <div className="p-8 border-b border-white/10 bg-white/5">
                <div className="flex items-center justify-between mb-6">
                  <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 text-[10px] font-black tracking-widest uppercase border border-orange-500/20">
                    Awaiting Review
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setViewingFile(true)}
                      className="p-2 text-secondary-400 hover:text-white bg-white/5 rounded-lg border border-white/10"
                    >
                      <Eye size={18} />
                    </button>
                    <button className="p-2 text-secondary-400 hover:text-white bg-white/5 rounded-lg border border-white/10">
                      <Download size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-secondary-500 font-bold uppercase tracking-widest">Purchaser</p>
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-primary-400" />
                      <h3 className="text-xl font-bold">{selectedSubmission.buyer_name}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-secondary-500 font-bold uppercase tracking-widest">Amount Reported</p>
                      <div className="flex items-center gap-2">
                        <DollarSign size={16} className="text-green-400" />
                        <h4 className="text-xl font-bold">${selectedSubmission.amount.toLocaleString()}</h4>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-secondary-500 font-bold uppercase tracking-widest">Date Reported</p>
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-secondary-400" />
                        <h4 className="text-sm font-medium">{selectedSubmission.date_submitted}</h4>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold text-secondary-400 uppercase tracking-widest">Rejection Reason (Required if rejecting)</label>
                  <textarea 
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    className="w-full bg-secondary-950 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-red-500/30 outline-none transition-all resize-none text-sm"
                    rows={3}
                  ></textarea>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleReject(selectedSubmission.id)}
                    disabled={!rejectReason || isProcessing}
                    className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 font-black tracking-widest uppercase text-xs hover:bg-red-500 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-red-500/10 disabled:hover:text-red-400"
                  >
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
                    Reject submission
                  </button>
                  <button 
                    onClick={() => handleApprove(selectedSubmission)}
                    disabled={isProcessing}
                    className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-green-500 text-white font-black tracking-widest uppercase text-xs hover:bg-green-600 shadow-lg shadow-green-500/20 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                    Approve & Verify
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => navigate(`/buyers/${selectedSubmission.buyer_id}`)}
                    className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 text-white border border-white/10 font-bold text-xs hover:bg-white/10 transition-all"
                  >
                    View Profile
                  </button>
                  <button
                    onClick={() => handleApprove(selectedSubmission, true)}
                    disabled={isProcessing}
                    className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary-600 text-white font-bold text-xs hover:bg-primary-700 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 size={14} className="animate-spin" /> : null}
                    Approve & Open Statement
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass rounded-3xl p-12 text-center flex flex-col items-center gap-4 justify-center min-h-[400px]">
              <div className="w-16 h-16 rounded-full bg-white/5 text-secondary-600 flex items-center justify-center">
                <Eye size={32} />
              </div>
              <p className="text-secondary-500 max-w-xs mx-auto">Select a submission from the queue to review and take action.</p>
            </div>
          )}
        </div>
      </div>

      {/* File Viewer Modal Mock */}
      {previewSubmission && (
        <div className="fixed inset-0 bg-secondary-950/80 backdrop-blur-md z-50 flex items-center justify-center p-8">
          <div className="w-full max-w-4xl h-full bg-secondary-900 rounded-3xl border border-white/10 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <h3 className="font-bold flex items-center gap-2"><FileText size={18} /> Proof Of Payment Preview</h3>
              <button 
                onClick={() => setViewingFile(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center relative gap-4">
              {previewSubmission.file_url ? (
                <>
                  <a 
                    href={previewSubmission.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-secondary-400 hover:text-white underline mb-2"
                  >
                    Open Image in New Tab
                  </a>
                  <img 
                    src={previewSubmission.file_url} 
                    alt="Proof of Payment" 
                    className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl bg-black/20"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/png?text=Image+Load+Error';
                    }}
                  />
                </>
              ) : (
                <div className="text-secondary-500 font-bold p-12 bg-white/5 rounded-3xl">
                  No image was attached to this submission.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PopQueue;
