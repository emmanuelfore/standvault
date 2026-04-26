import { useState } from 'react';
import { 
  User, 
  Shield, 
  Bell, 
  Check,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

const Settings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);

  const tabs = [
    { id: 'profile', label: 'Profile Settings', icon: User },
    { id: 'security', label: 'Security & Auth', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 1000);
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-secondary-400 mt-1">Manage your account preferences and system configurations.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Tabs */}
        <div className="w-full lg:w-72 flex flex-col gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-4 px-5 py-4 rounded-2xl transition-all text-left",
                activeTab === tab.id 
                  ? "bg-primary-600 text-white shadow-xl shadow-primary-600/20" 
                  : "text-secondary-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <tab.icon size={20} />
              <span className="font-bold">{tab.label}</span>
              {activeTab === tab.id && <ChevronRight size={18} className="ml-auto" />}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 glass p-8 md:p-10 rounded-[2.5rem] border border-white/10">
          {activeTab === 'profile' && (
            <div className="flex flex-col gap-10 animate-in">
              <div>
                <h2 className="text-2xl font-bold">Profile Settings</h2>
                <p className="text-secondary-500 text-sm mt-1">Update your personal information and profile picture.</p>
              </div>

              <div className="flex items-center gap-8">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-3xl font-black shadow-2xl shadow-primary-600/30">
                  {user?.email[0].toUpperCase()}
                </div>
                <div className="flex flex-col gap-3">
                  <input type="file" id="avatar-input" className="hidden" accept="image/*" />
                  <label 
                    htmlFor="avatar-input"
                    className="px-5 py-2.5 bg-white text-black rounded-xl font-bold hover:bg-secondary-200 transition-all text-sm cursor-pointer block text-center"
                  >
                    Change Avatar
                  </label>
                  <button className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all text-sm">
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    type="text" 
                    defaultValue="Admin User"
                    className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-600/50 outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Email Address</label>
                  <input 
                    type="email" 
                    defaultValue={user?.email}
                    disabled
                    className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 opacity-60 cursor-not-allowed"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Role</label>
                  <input 
                    type="text" 
                    defaultValue={user?.role}
                    disabled
                    className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 opacity-60 cursor-not-allowed"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Role</label>
                  <input 
                    type="text" 
                    defaultValue={user?.role?.replace('_', ' ')}
                    disabled
                    className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 opacity-60 cursor-not-allowed capitalize"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 flex justify-end">
                <button 
                  onClick={handleSave}
                  className={cn(
                    "px-8 py-3 rounded-xl font-black transition-all flex items-center gap-2",
                    saving ? "bg-green-600 text-white" : "bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-600/20"
                  )}
                >
                  {saving ? <><Check size={20} /> Saved</> : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="flex flex-col gap-10 animate-in">
              <div>
                <h2 className="text-2xl font-bold">Security & Authentication</h2>
                <p className="text-secondary-500 text-sm mt-1">Manage your password and account security settings.</p>
              </div>

              <div className="grid grid-cols-1 gap-8">
                 <div className="p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-6">
                    <h3 className="font-bold">Change Password</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="flex flex-col gap-2">
                         <label className="text-[10px] font-black uppercase text-secondary-500">Current Password</label>
                         <input type="password" placeholder="••••••••" className="bg-secondary-950 border border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary-600/50" />
                       </div>
                       <div className="hidden md:block"></div>
                       <div className="flex flex-col gap-2">
                         <label className="text-[10px] font-black uppercase text-secondary-500">New Password</label>
                         <input type="password" placeholder="••••••••" className="bg-secondary-950 border border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary-600/50" />
                       </div>
                       <div className="flex flex-col gap-2">
                         <label className="text-[10px] font-black uppercase text-secondary-500">Confirm New Password</label>
                         <input type="password" placeholder="••••••••" className="bg-secondary-950 border border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary-600/50" />
                       </div>
                    </div>
                    <button className="w-fit px-6 py-2.5 bg-secondary-800 hover:bg-secondary-700 text-white rounded-xl font-bold text-sm transition-all active:scale-95">Update Password</button>
                 </div>

                 <div className="p-6 rounded-2xl bg-orange-500/5 border border-orange-500/10 flex flex-col gap-4">
                    <h3 className="font-bold text-orange-400">Two-Factor Authentication</h3>
                    <p className="text-xs text-secondary-500">Add an additional layer of security to your account by enabling 2FA.</p>
                    <button className="w-fit px-6 py-2.5 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-xl font-bold text-sm border border-orange-500/20 transition-all">Enable 2FA</button>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="flex flex-col gap-10 animate-in">
              <div>
                <h2 className="text-2xl font-bold">Notification Preferences</h2>
                <p className="text-secondary-500 text-sm mt-1">Control how you receive alerts and system updates.</p>
              </div>

              <div className="flex flex-col gap-4 divide-y divide-white/10">
                 {[
                    { id: 'email_alerts', label: 'Email Alerts', sub: 'Receive daily summaries of project activity via email.', default: true },
                    { id: 'push_notifs', label: 'Push Notifications', sub: 'Receive instant desktop alerts for payments and PoPs.', default: true },
                    { id: 'weekly_reports', label: 'Weekly Reports', sub: 'Formal collection reports delivered every Monday morning.', default: false },
                    { id: 'arrears_warnings', label: 'Arrears Warnings', sub: 'Automated alerts when a purchaser falls into arrears.', default: true }
                 ].map((item) => (
                   <div key={item.id} className="flex items-center justify-between py-6 first:pt-0">
                      <div>
                         <p className="font-bold">{item.label}</p>
                         <p className="text-xs text-secondary-500 mt-1 max-w-sm">{item.sub}</p>
                      </div>
                      <button className={cn(
                        "w-12 h-6 rounded-full p-1 transition-all duration-300",
                        item.default ? "bg-primary-600" : "bg-white/10"
                      )}>
                        <div className={cn(
                          "w-4 h-4 bg-white rounded-full transition-all duration-300",
                          item.default ? "translate-x-6" : "translate-x-0"
                        )} />
                      </button>
                   </div>
                 ))}
              </div>

              <div className="pt-6 border-t border-white/10 flex justify-end">
                <button 
                  onClick={handleSave}
                  className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-black shadow-lg shadow-primary-600/20"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
