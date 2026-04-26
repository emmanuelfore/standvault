import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock, HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import TablePagination from '../components/TablePagination';
import { usePagination } from '../hooks/usePagination';

const toAmount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const PurchaserPaymentPlan = () => {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    const fetchSchedule = async () => {
      if (!user?.buyerId) return;
      try {
        setLoadError('');
        const response = await api.get(`/buyers/${user.buyerId}/schedule`);
        setSchedule(response.data);
      } catch (err) {
        console.error('Failed to fetch payment plan', err);
        setSchedule(null);
        setLoadError('Unable to load your payment plan right now. Please try again shortly.');
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [user?.buyerId]);

  const filteredPeriods = useMemo(() => {
    const periods = schedule?.periods || [];
    return periods.filter((period: any) => {
      const status = String(period.status || 'UNPAID');
      return statusFilter === 'ALL' || status === statusFilter;
    });
  }, [schedule?.periods, statusFilter]);

  const {
    currentPage,
    pageSize,
    paginatedItems: paginatedPeriods,
    rangeEnd,
    rangeStart,
    totalItems,
    totalPages,
    setCurrentPage,
    setPageSize,
  } = usePagination(filteredPeriods, 10);

  useEffect(() => {
    setCurrentPage(1);
  }, [setCurrentPage, statusFilter]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Payment Plan</h1>
          <p className="text-secondary-400 mt-2">Track your scheduled instalments and upcoming due dates.</p>
        </div>
      </div>

      {!loading && loadError ? (
        <div className="glass rounded-[2rem] p-10 text-center flex flex-col items-center gap-4">
          <Calendar size={36} className="text-secondary-500" />
          <div>
            <h3 className="text-xl font-bold">Payment Plan Unavailable</h3>
            <p className="text-secondary-400 mt-2">{loadError}</p>
          </div>
        </div>
      ) : !loading && !schedule ? (
        <div className="glass rounded-[2rem] p-10 text-center flex flex-col items-center gap-4">
          <Calendar size={36} className="text-secondary-500" />
          <div>
            <h3 className="text-xl font-bold">No Payment Plan Available</h3>
            <p className="text-secondary-400 mt-2">Your payment plan has not been generated yet. Please contact administration.</p>
          </div>
        </div>
      ) : (
        <div className="glass rounded-[2rem] overflow-hidden animate-in">
          <div className="p-6 border-b border-white/10 bg-white/5 flex justify-end">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-secondary-950 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-600/50 outline-none transition-all text-sm font-bold"
            >
              <option value="ALL">All instalments</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partially Paid</option>
              <option value="UNPAID">Unpaid</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-secondary-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/10">
                  <th className="px-8 py-5">#</th>
                  <th className="px-8 py-5">Due Date</th>
                  <th className="px-8 py-5">Principal</th>
                  <th className="px-8 py-5">Interest</th>
                  <th className="px-8 py-5">Total Due</th>
                  <th className="px-8 py-5">Paid Amount</th>
                  <th className="px-8 py-5">Remaining</th>
                  <th className="px-8 py-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  Array(6)
                    .fill(0)
                    .map((_, index) => (
                      <tr key={index} className="animate-pulse">
                        <td colSpan={8} className="px-8 py-6">
                          <div className="h-4 bg-white/5 rounded w-full"></div>
                        </td>
                      </tr>
                    ))
                ) : (
                  paginatedPeriods.map((period: any) => {
                    const status = String(period.status || 'UNPAID');
                    const paidAmount = toAmount(period.paid_amount);
                    const totalExpected = toAmount(period.total_expected);
                    const principalExpected = toAmount(period.principal_expected);
                    const interestExpected = toAmount(period.interest_expected);
                    const remaining = Math.max(0, totalExpected - paidAmount);
                    return (
                      <tr key={period.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-8 py-6 text-sm font-bold text-secondary-500">{String(period.period_number).padStart(2, '0')}</td>
                        <td className="px-8 py-6 font-bold tracking-tight">{new Date(period.due_date).toLocaleDateString()}</td>
                        <td className="px-8 py-6 font-black">${principalExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-8 py-6 font-bold text-secondary-400">${interestExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-8 py-6 text-sm font-medium text-secondary-300">${totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-8 py-6 text-sm font-bold text-green-400">${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-8 py-6 text-sm font-bold text-secondary-300">${remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-8 py-6 text-right">
                          <span
                            className={cn(
                              'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-1.5',
                              status === 'PAID'
                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                : status === 'PARTIAL'
                                  ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'
                                  : 'bg-white/5 text-secondary-500 border-white/10'
                            )}
                          >
                            {status === 'PAID' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && schedule && (
            <TablePagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalItems}
              totalPages={totalPages}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
      )}

      <div className="p-8 rounded-[2rem] bg-primary-600/5 border border-primary-500/10 flex items-start gap-4">
        <div className="p-3 bg-primary-600/20 rounded-2xl text-primary-400 shrink-0">
          <HelpCircle size={24} />
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="font-bold text-lg">About your payment plan</h4>
          <p className="text-secondary-400 text-sm leading-relaxed">
            This plan reflects the active schedule on your purchaser account. Additional verified charges or penalties may affect future totals.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PurchaserPaymentPlan;
