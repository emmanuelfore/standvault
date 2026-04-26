import React, { useState, useEffect } from 'react';
import { X, User, Phone, CreditCard, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import api from '../lib/api';

interface EditBuyerModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyer: any;
  onSuccess: () => void;
}

const EditBuyerModal: React.FC<EditBuyerModalProps> = ({ isOpen, onClose, buyer, onSuccess }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [allocationDate, setAllocationDate] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (buyer) {
      setFirstName(buyer.first_name || '');
      setLastName(buyer.last_name || '');
      setPhoneNumber(buyer.phone_number || '');
      setIdNumber(buyer.id_number || '');
      setEmail(buyer.user?.email || '');
      if (buyer.allocation_date) {
        setAllocationDate(new Date(buyer.allocation_date).toISOString().split('T')[0]);
      } else if (buyer.created_at) {
        setAllocationDate(new Date(buyer.created_at).toISOString().split('T')[0]);
      }
    }
  }, [buyer, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.patch(`/buyers/${buyer.id}/details`, {
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        id_number: idNumber,
        allocation_date: allocationDate
      });
      await api.patch(`/buyers/${buyer.id}/account`, {
        email
      });
      
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update purchaser account');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-950/80 backdrop-blur-sm animate-in fade-in" onClick={onClose}></div>
      
      <div className="glass w-full max-w-xl rounded-[2.5rem] border-white/10 shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
        {success ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center border-4 border-green-500/20">
              <CheckCircle2 size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Profile Updated!</h2>
              <p className="text-secondary-400 mt-2">The purchaser profile and account details have been refreshed.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div>
                <h2 className="text-xl font-bold">Edit Purchaser Account</h2>
                <p className="text-xs text-secondary-400 mt-1">Update personal and login details for {buyer?.first_name}</p>
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
                <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Login Email</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-medium"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">First Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                    <input 
                      type="text" 
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-bold"
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Last Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                    <input 
                      type="text" 
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-bold"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Phone Number</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                    <input 
                      type="tel" 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-medium"
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">National ID / Passport</label>
                  <div className="relative group">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                    <input 
                      type="text" 
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-medium"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Allocation / Agreement Date</label>
                <div className="relative group">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-600 group-focus-within:text-primary-400 transition-colors" size={20} />
                  <input 
                    type="date" 
                    value={allocationDate}
                    onChange={(e) => setAllocationDate(e.target.value)}
                    className="w-full bg-secondary-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-600/20 outline-none transition-all font-medium text-white"
                    required
                  />
                </div>
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
                className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-primary-600/30 flex items-center justify-center gap-3 mt-4"
              >
                {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (
                  <>
                    <CheckCircle2 size={24} />
                    Save Changes
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default EditBuyerModal;
