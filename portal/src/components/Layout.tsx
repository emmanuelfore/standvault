import React from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { 
  Home, 
  History, 
  Calendar, 
  FileText, 
  Bell, 
  LogOut,
  User,
  Zap,
  HelpCircle,
  Menu,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { icon: Home, label: 'Dashboard', href: '/' },
    { icon: History, label: 'Payments', href: '/payments' },
    { icon: Calendar, label: 'Payment Plan', href: '/schedule' },
    { icon: Zap, label: 'Charges', href: '/charges' },
    { icon: FileText, label: 'Document Vault', href: '/documents' },
    { icon: Bell, label: 'Updates', href: '/announcements' },
  ];

  return (
    <div className="min-h-screen bg-secondary-950 flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-72 flex-col bg-secondary-950/50 border-r border-white/10 p-8 glass sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/30">
            <Home className="text-white" size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight">Purchaser Portal</span>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group",
                location.pathname === item.href 
                  ? "bg-primary-600 text-white shadow-xl shadow-primary-600/20" 
                  : "text-secondary-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon size={20} className={cn(location.pathname === item.href ? "text-white" : "text-secondary-500 group-hover:text-white")} />
              <span className="font-bold tracking-wide text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="pt-8 border-t border-white/10 flex flex-col gap-4 text-secondary-500">
           <button className="flex items-center gap-4 px-5 py-2 hover:text-white transition-colors text-sm font-bold">
             <HelpCircle size={20} /> Support
           </button>
           <button 
            onClick={handleLogout}
            className="flex items-center gap-4 px-5 py-2 hover:text-red-400 transition-colors text-sm font-bold"
           >
             <LogOut size={20} /> Logout
           </button>
        </div>
      </aside>

      {/* Mobile Nav */}
      <div className="md:hidden flex items-center justify-between p-6 bg-secondary-900 border-b border-white/10 z-50">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Home className="text-white" size={18} />
            </div>
            <span className="font-bold">Portal</span>
         </div>
         <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
           {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
         </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[73px] bg-secondary-950 z-40 p-8 flex flex-col gap-4">
           {menuItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-2xl",
                  location.pathname === item.href ? "bg-primary-600 text-white" : "text-secondary-400"
                )}
              >
                <item.icon size={20} />
                <span className="font-bold">{item.label}</span>
              </Link>
           ))}
        </div>
      )}

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-24 px-12 items-center flex justify-between hidden md:flex">
           <div>
             <h2 className="text-secondary-400 text-xs font-black uppercase tracking-[0.2em]">Project Account</h2>
             <p className="text-lg font-bold">Property Portfolio</p>
           </div>
           <div className="flex items-center gap-6">
              <button className="relative p-2.5 bg-white/5 rounded-xl border border-white/10 text-secondary-300 hover:text-white transition-all">
                <Bell size={20} />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-secondary-950"></span>
              </button>
              <div className="flex items-center gap-3 pl-6 border-l border-white/10">
                 <div className="text-right">
                    <p className="text-sm font-black">{user?.email || 'Guest'}</p>
                    <p className="text-[10px] text-primary-500 font-bold uppercase tracking-widest">Purchaser</p>
                 </div>
                 <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-secondary-800 to-secondary-700 border border-white/10 flex items-center justify-center">
                    <User size={24} className="text-secondary-300" />
                 </div>
              </div>
           </div>
        </header>

        <div className="p-6 md:p-12 overflow-y-auto w-full animate-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
