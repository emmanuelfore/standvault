import { useEffect, useState } from 'react';
import { 
  Users, 
  DollarSign, 
  Clock, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Building2,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { cn } from '../lib/utils';
import api from '../lib/api';
import { useProject } from '../contexts/ProjectContext';
import { CardSkeleton, TableSkeleton } from '../components/Skeleton';

interface DashboardData {
  totalBuyers: number;
  totalCollected: number;
  totalOutstanding: number;
  pendingPoP: number;
  recentActivity: any[];
  monthlyCollections: Array<{ name: string; amount: number }>;
  agedDebtDistribution: Array<{ name: string; value: number }>;
  collectionProgress: number;
  monthlyTarget: number;
}

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color }: any) => (
  <div className="glass p-6 rounded-2xl flex flex-col gap-4 animate-in">
    <div className="flex items-center justify-between">
      <div className={cn("p-2 rounded-lg bg-opacity-20", color)}>
        <Icon size={24} className={cn("opacity-100", color.replace('bg-', 'text-'))} />
      </div>
      <button className="text-secondary-500 hover:text-white transition-colors">
        <MoreVertical size={18} />
      </button>
    </div>
    <div>
      <p className="text-secondary-400 text-sm font-medium">{title}</p>
      <h3 className="text-2xl font-bold mt-1">{value}</h3>
    </div>
    <div className="flex items-center gap-2 mt-2">
      <div className={cn("flex items-center text-xs font-bold px-2 py-1 rounded-full", trend === 'up' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
        {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {trendValue}
      </div>
      <span className="text-xs text-secondary-500">vs last month</span>
    </div>
  </div>
);

const Dashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { selectedProject, projects, selectProject } = useProject();

  useEffect(() => {
    if (!selectedProject) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/projects/${selectedProject.id}/dashboard`);
        setData(response.data);
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedProject]);

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
        <div className="w-20 h-20 bg-primary-600/20 rounded-3xl flex items-center justify-center text-primary-500">
          <Building2 size={40} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">No Project Selected</h2>
          <p className="text-secondary-400 mt-2">Please select a project to view the dashboard.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-2xl">
          {projects.map(p => (
            <button 
              key={p.id}
              onClick={() => selectProject(p.id)}
              className="p-6 glass rounded-2xl border border-white/10 hover:border-primary-500/50 hover:bg-white/5 transition-all text-left"
            >
              <h3 className="font-bold text-lg">{p.name}</h3>
              <p className="text-xs text-secondary-500 mt-1 uppercase tracking-wider font-bold">Select Project</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const isLoading = loading || !data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-secondary-400">
            Project Overview
          </h1>
          <p className="text-secondary-400 mt-1">Welcome back. Here's what's happening with your project today.</p>
        </div>
        <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-primary-600 rounded-xl text-sm font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 active:scale-95">
                Generate Invoice
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <StatCard 
              title="Total Buyers" 
              value={data?.totalBuyers} 
              icon={Users} 
              trend={(data as any)?.totalBuyersTrend?.startsWith('+') ? 'up' : 'down'} 
              trendValue={(data as any)?.totalBuyersTrend} 
              color="bg-blue-500" 
            />
            <StatCard 
              title="Total Collected" 
              value={`$${data?.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
              icon={DollarSign} 
              trend={(data as any)?.totalCollectedTrend?.startsWith('+') ? 'up' : 'down'} 
              trendValue={(data as any)?.totalCollectedTrend} 
              color="bg-green-500" 
            />
            <StatCard 
              title="Outstanding" 
              value={`$${data?.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
              icon={TrendingUp} 
              trend={(data as any)?.totalOutstandingTrend?.startsWith('+') ? 'up' : 'down'} 
              trendValue={(data as any)?.totalOutstandingTrend} 
              color="bg-purple-500" 
            />
            <StatCard 
              title="Pending PoPs" 
              value={data?.pendingPoP} 
              icon={Clock} 
              trend={(data as any)?.pendingPoPTrend?.startsWith('+') ? 'up' : 'down'} 
              trendValue={(data as any)?.pendingPoPTrend} 
              color="bg-orange-500" 
            />
          </>
        )}
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass rounded-[2rem] p-8 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                  <div>
                      <h3 className="text-xl font-bold">Collection History</h3>
                      <p className="text-xs text-secondary-500 mt-1 uppercase tracking-widest">Monthly verification trends</p>
                  </div>
                  <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs focus:ring-0">
                      <option>Last 6 Months</option>
                  </select>
              </div>
              <div className="h-64 w-full">
                  {isLoading ? <TableSkeleton rows={1} cols={1} /> : (
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data?.monthlyCollections}>
                              <defs>
                                  <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                              <XAxis 
                                dataKey="name" 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                              />
                              <YAxis 
                                stroke="#94a3b8" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                tickFormatter={(v) => `$${v}`}
                              />
                              <Tooltip 
                                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                contentStyle={{ 
                                    backgroundColor: '#0f172a', 
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    fontSize: '12px'
                                }}
                              />
                              <Bar 
                                dataKey="amount" 
                                fill="url(#colorAmt)" 
                                radius={[6, 6, 0, 0]} 
                                barSize={40}
                              />
                          </BarChart>
                      </ResponsiveContainer>
                  )}
              </div>
          </div>

          <div className="glass rounded-[2rem] p-8 flex flex-col gap-6">
            <h3 className="text-xl font-bold">Aged Debt</h3>
            <div className="h-48 w-full relative">
                {isLoading ? <div className="animate-pulse bg-white/5 rounded-full w-32 h-32 mx-auto" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data?.agedDebtDistribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data?.agedDebtDistribution.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={[
                                        '#22c55e', // Current
                                        '#3b82f6', // 30 Days
                                        '#f59e0b', // 60 Days
                                        '#ef4444'  // 90+ Days
                                    ][index % 4]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: '#0f172a', 
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    borderRadius: '12px' 
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                )}
                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-secondary-400 text-[10px] uppercase font-bold tracking-tighter">Overdue</span>
                    <span className="text-lg font-bold">
                        {data?.agedDebtDistribution?.reduce((acc, curr) => acc + (curr.name !== 'Current' ? curr.value : 0), 0)}
                    </span>
                </div>
            </div>
            <div className="flex flex-col gap-3">
                {data?.agedDebtDistribution.map((debt, index) => (
                    <div key={debt.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#22c55e','#3b82f6','#f59e0b','#ef4444'][index] }} />
                             <span className="text-secondary-400">{debt.name}</span>
                        </div>
                        <span className="font-bold">{debt.value} accounts</span>
                    </div>
                ))}
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass rounded-[2rem] p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold">Recent Activity</h3>
            <button className="text-primary-500 text-sm font-bold hover:underline">View all</button>
          </div>
          <div className="flex flex-col gap-4">
            {isLoading ? (
              <TableSkeleton rows={3} cols={1} />
            ) : data?.recentActivity.map((activity, i) => (
              <div key={`${activity.id}-${i}`} className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 glass-hover group">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                    activity.type === 'payment' ? "bg-green-500/10 text-green-500" :
                    activity.type === 'pop' ? "bg-blue-500/10 text-blue-500" :
                    activity.type === 'milestone' ? "bg-purple-500/10 text-purple-500" :
                    "bg-orange-500/10 text-orange-500"
                  )}>
                    {activity.type === 'payment' ? <DollarSign size={24} /> :
                     activity.type === 'pop' ? <Clock size={24} /> :
                     activity.type === 'milestone' ? <TrendingUp size={24} /> :
                     <Users size={24} />}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{activity.buyer}</p>
                    <p className="text-sm text-secondary-500">
                      {activity.type === 'payment' ? 'Recorded a verified payment' :
                       activity.type === 'pop' ? 'Submitted a new Proof of Payment' :
                       activity.type === 'milestone' ? `Reached milestone: ${activity.label}` :
                       'Applied additional project charge'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-white">{activity.amount ? `$${activity.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}</p>
                  <p className="text-xs text-secondary-500 mt-1 uppercase tracking-widest">{new Date(activity.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
            <div className="glass rounded-[2rem] p-8">
                <h3 className="text-xl font-bold mb-8">Collection Progress</h3>
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-baseline">
                            <span className="text-secondary-400 text-sm font-medium">Monthly Target</span>
                            <span className="text-2xl font-black">${(data as any)?.monthlyTarget?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="h-4 w-full bg-secondary-900 rounded-full overflow-hidden p-1 border border-white/5">
                            <div 
                                className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all duration-1000"
                                style={{ width: `${(data as any)?.collectionProgress}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold">
                            <span className="text-primary-500">{(data as any)?.collectionProgress}% Reached</span>
                            <span className="text-secondary-600">Remaining: $</span>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/10 flex flex-col gap-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-secondary-500">Quick Actions</h4>
                        <button className="w-full py-4 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/30 active:scale-95 flex items-center justify-center gap-2">
                            <PieChartIcon size={18} /> Deep Analytics
                        </button>
                        <button className="w-full py-4 px-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all border border-white/10 active:scale-95">
                            Review PoP Queue
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="glass rounded-[2rem] p-8 bg-gradient-to-br from-primary-600/20 to-transparent border-primary-500/20">
                <Building2 size={32} className="text-primary-500 mb-4" />
                <h4 className="text-lg font-bold">System Health</h4>
                <p className="text-secondary-400 text-sm mt-2">All background workers are active. Prisma client generated and database synced.</p>
                <div className="mt-6 flex items-center gap-2 text-green-500 font-bold text-xs uppercase tracking-widest">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Operational
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
