import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
  Bell,
  Building2,
  Calendar,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  FileText,
  History,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Map,
  Megaphone,
  Search,
  Settings,
  Upload,
  User,
  Users,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';

interface SidebarItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const SidebarLink = ({ item, active }: { item: SidebarItem; active: boolean }) => (
  <Link
    to={item.href}
    className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
      active
        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
        : 'text-secondary-400 hover:bg-white/5 hover:text-white'
    )}
  >
    <item.icon size={20} className={cn(active ? 'text-white' : 'text-secondary-400 group-hover:text-white')} />
    <span className="font-medium">{item.label}</span>
  </Link>
);

export const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { selectedProject, projects, selectProject } = useProject();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.role === 'BUYER') {
      const fetchUnread = async () => {
        try {
          const res = await api.get('/notifications/mine');
          const unread = res.data.filter((n: any) => !n.is_read).length;
          setUnreadCount(unread);
        } catch (err) {
          console.error('Failed to fetch unread count', err);
        }
      };
      fetchUnread();
      const interval = setInterval(fetchUnread, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [user]);

  const isBuyer = user?.role === 'BUYER';

  const adminMenuItems: SidebarItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
    { icon: Users, label: 'Purchases & Allocations', href: '/buyers' },
    { icon: KeyRound, label: 'Buyer Accounts', href: '/buyer-accounts' },
    { icon: CreditCard, label: 'Payments', href: '/payments' },
    { icon: Building2, label: 'Projects', href: '/projects' },
    { icon: Zap, label: 'Apply Fees', href: '/additional-fees' },
    { icon: Map, label: 'Stands', href: '/stands' },
    { icon: ClipboardCheck, label: 'Proof of Payment', href: '/pop-queue' },
    { icon: Megaphone, label: 'Announcements', href: '/announcements' },
    { icon: Upload, label: 'Migration', href: '/migration' }
  ];

  const buyerMenuItems: SidebarItem[] = [
    { icon: Home, label: 'Dashboard', href: '/' },
    { icon: History, label: 'Payments', href: '/account/payments' },
    { icon: Calendar, label: 'Payment Plan', href: '/account/payment-plan' },
    { icon: Zap, label: 'Additional Fees', href: '/account/fees' },
    { icon: FileText, label: 'Document Vault', href: '/account/documents' },
    { icon: Bell, label: 'Updates', href: '/account/updates' },
    { icon: Upload, label: 'Proof of Payment', href: '/account/proof-of-payment' }
  ];

  const menuItems = isBuyer ? buyerMenuItems : adminMenuItems;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (email: string) => email.substring(0, 2).toUpperCase();

  const headerTitle = isBuyer ? 'Purchaser Account' : 'Project Operations';
  const headerSubtitle = isBuyer
    ? 'View your statement, payment plan, and account documents'
    : 'Manage collections, allocations, and project controls';

  return (
    <div className="flex min-h-screen bg-secondary-950 text-secondary-50">
      <aside className="w-64 border-r border-white/10 p-6 flex flex-col gap-8 glass sticky top-0 h-screen shrink-0 print:hidden">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/30">
            <Building2 className="text-white" size={24} />
          </div>
          <div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-secondary-400 bg-clip-text text-transparent">
              StandVault
            </span>
            <p className="text-[10px] uppercase tracking-[0.24em] text-secondary-500 mt-1">
              {isBuyer ? 'Purchaser View' : 'Admin View'}
            </p>
          </div>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {menuItems.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href))}
            />
          ))}
        </nav>

        <div className="pt-6 border-t border-white/10 flex flex-col gap-2">
          {!isBuyer && (
            <SidebarLink
              item={{ icon: Settings, label: 'Settings', href: '/settings' }}
              active={location.pathname === '/settings'}
            />
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-secondary-400 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200 group w-full text-left"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-white/10 px-8 flex items-center justify-between sticky top-0 bg-secondary-950/80 backdrop-blur-md z-40 print:hidden">
          <div className="flex items-center gap-8 flex-1">
            {!isBuyer ? (
              <div className="relative group">
                <button className="flex items-center gap-3 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all min-w-[220px] justify-between group-hover:border-primary-500/50">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-primary-500" />
                    <span className="font-bold text-sm truncate max-w-[150px]">
                      {selectedProject?.name || 'Select Project'}
                    </span>
                  </div>
                  <ChevronDown size={16} className="text-secondary-500" />
                </button>

                <div className="absolute top-full left-0 mt-2 w-72 glass border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2 transform origin-top scale-95 group-hover:scale-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary-500 mb-2 px-3 pt-2">Switch Project</p>
                  <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-1">
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => selectProject(project.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left',
                          selectedProject?.id === project.id
                            ? 'bg-primary-600 text-white'
                            : 'hover:bg-white/5 text-secondary-400 hover:text-white'
                        )}
                      >
                        <Building2 size={16} />
                        <span className="font-medium text-sm">{project.name}</span>
                      </button>
                    ))}
                    {projects.length === 0 && (
                      <p className="p-4 text-xs text-secondary-500 italic">No projects available</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-secondary-500">{headerTitle}</p>
                <p className="text-sm font-bold mt-1">{headerSubtitle}</p>
              </div>
            )}

            {!isBuyer && (
              <div className="relative w-96 hidden lg:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-500" size={18} />
                <input
                  type="text"
                  placeholder="Search anything..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-600/50 transition-all font-medium"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate(isBuyer ? '/account/updates' : '/announcements')}
              className="relative p-2 text-secondary-400 hover:text-white transition-colors"
            >
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 bg-primary-500 rounded-full border-2 border-secondary-950 flex items-center justify-center text-[8px] font-black text-white px-0.5">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold">{user?.email || 'Guest'}</p>
                <p className="text-xs text-secondary-500">
                  {isBuyer ? 'Purchaser' : user?.role?.replace('_', ' ') || 'User'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold shadow-lg shadow-primary-600/20">
                {user ? getInitials(user.email) : <User size={16} />}
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 animate-in print:p-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
