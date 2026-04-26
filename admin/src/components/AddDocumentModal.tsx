import { useState } from 'react';
import { X, Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import api from '../lib/api';

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: boolean | any;
  buyerId: string;
  buyerName: string;
  onSuccess: () => void;
}

const DOCUMENT_TYPES = [
  { id: 'identification', label: 'Identification (ID/Passport)' },
  { id: 'agreement_of_sale', label: 'Agreement of Sale' },
  { id: 'proof_of_residence', label: 'Proof of Residence' },
  { id: 'transfer_deed', label: 'Transfer Deed' },
  { id: 'correspondence', label: 'Correspondence' },
  { id: 'other', label: 'Other Document' },
];

const AddDocumentModal = ({ isOpen, onClose, buyerId, buyerName, onSuccess }: AddDocumentModalProps) => {
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('identification');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setError('');
    setUploadProgress(10);

    try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${buyerId}/${Math.random()}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      setUploadProgress(30);
      const { error: uploadError } = await supabase.storage
        .from('vault')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setUploadProgress(70);
      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('vault')
        .getPublicUrl(filePath);

      // 3. Register in Database
      await api.post(`/buyers/${buyerId}/documents`, {
        title,
        document_type: docType,
        file_url: publicUrl
      });

      setUploadProgress(100);
      onSuccess();
      onClose();
      // Reset
      setTitle('');
      setFile(null);
    } catch (err: any) {
      console.error('Upload failed', err);
      setError(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-secondary-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-secondary-900 border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-400">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Upload Document</h3>
              <p className="text-xs text-secondary-500 mt-0.5">Adding to {buyerName}'s vault</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-6">
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Document Title</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Signed Agreement of Sale"
              className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 px-6 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-bold placeholder:text-secondary-700"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Document Type</label>
            <select 
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 px-6 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-bold"
            >
              {DOCUMENT_TYPES.map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">File</label>
            <label className="relative group cursor-pointer">
              <input 
                type="file" 
                className="hidden" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              <div className="w-full aspect-video rounded-3xl border-2 border-dashed border-white/10 group-hover:border-primary-500/50 group-hover:bg-primary-500/5 transition-all flex flex-col items-center justify-center gap-3">
                {file ? (
                  <>
                    <div className="p-4 rounded-2xl bg-primary-500/10 text-primary-400">
                      <CheckCircle2 size={32} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-white truncate max-w-[240px] px-4">{file.name}</p>
                      <p className="text-xs text-secondary-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-2xl bg-white/5 text-secondary-500 group-hover:text-primary-400 group-hover:bg-primary-500/10 transition-all">
                      <Upload size={32} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Select or drop file</p>
                      <p className="text-xs text-secondary-500">PDF, JPG, Doc (Max 10MB)</p>
                    </div>
                  </>
                )}
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={isUploading}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-white rounded-2xl py-4 font-black text-lg transition-all shadow-xl shadow-primary-600/20 active:scale-95 flex items-center justify-center gap-3 mt-4"
          >
            {isUploading ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                <span>Uploading {uploadProgress}%</span>
              </>
            ) : (
              <>
                <Upload size={24} />
                <span>Upload Document</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddDocumentModal;
