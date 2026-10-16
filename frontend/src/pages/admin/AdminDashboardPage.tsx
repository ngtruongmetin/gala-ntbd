import { AlertTriangle, BadgeCheck, CircleDollarSign, TicketCheck } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { useAdminDashboard } from '../../features/admin/use-admin-dashboard';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function AdminDashboardPage() {
  const dashboardQuery = useAdminDashboard(true);
  const dashboard = dashboardQuery.data;
  if (dashboardQuery.isPending) return <div className="min-h-[60dvh] animate-pulse" />;
  if (!dashboard) return <p role="alert">Không tải được dữ liệu trang tổng quan.</p>;

  const metrics = [
    ['Doanh thu ròng', currency.format(dashboard.summary.netRevenueVnd), CircleDollarSign],
    ['Vé đã bán', dashboard.summary.soldTickets.toLocaleString('vi-VN'), BadgeCheck],
    ['Đã soát vé', dashboard.summary.checkedInTickets.toLocaleString('vi-VN'), TicketCheck],
    [
      'Cần xử lý',
      (dashboard.summary.reviewOrders + dashboard.summary.refundPendingOrders).toLocaleString(
        'vi-VN',
      ),
      AlertTriangle,
    ],
  ] as const;
  const trend = dashboard.trend.map((point) => ({
    ...point,
    label: new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(
      new Date(point.day),
    ),
  }));
  const hasTrendData = trend.some((point) => point.orders > 0 || point.revenueVnd !== 0);

  return (
    <section>
      <h1 className="text-2xl font-black sm:text-3xl">Tổng quan vận hành</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Doanh thu, số vé còn lại và tình trạng soát vé của sự kiện.
      </p>

      <div className="mt-7 grid overflow-hidden rounded-md border border-zinc-200 min-[360px]:grid-cols-2 xl:grid-cols-4 dark:border-zinc-800">
        {metrics.map(([label, value, Icon]) => (
          <div
            key={label}
            className="min-w-0 border-b border-zinc-200 bg-white p-4 min-[360px]:border-r sm:p-5 xl:border-b-0 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <Icon className="text-coral-600 dark:text-coral-400" size={20} strokeWidth={1.8} />
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
            <p className="mt-1 break-words text-xl font-black tabular-nums sm:text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.4fr_0.6fr]">
        <section className="min-w-0">
          <h2 className="text-lg font-black">Doanh thu 14 ngày</h2>
          <div className="mt-4 h-64 rounded-md border border-zinc-200 bg-white p-2 sm:h-72 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900">
            {hasTrendData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.25} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                  <Tooltip formatter={(value) => currency.format(Number(value))} />
                  <Area
                    type="monotone"
                    dataKey="revenueVnd"
                    stroke="#e11d48"
                    fill="#e11d48"
                    fillOpacity={0.16}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-center text-sm text-zinc-500">
                Doanh thu sẽ xuất hiện sau khi có giao dịch được xác nhận.
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-black">Cần đối soát</h2>
            <Link
              to="/admin/don-hang?status=payment_review"
              className="text-sm font-bold text-coral-600 dark:text-coral-400"
            >
              Xem tất cả
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {dashboard.reviewOrders.length === 0 ? (
              <p className="p-5 text-sm text-zinc-500">Không có đơn cần xử lý.</p>
            ) : (
              dashboard.reviewOrders.map((order) => (
                <Link
                  key={order.reference}
                  to={`/admin/don-hang/${order.reference}`}
                  className="block border-b border-zinc-200 p-4 last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong>{order.reference}</strong>
                    <StatusBadge status="payment_review" />
                  </div>
                  <p className="mt-2 truncate text-sm text-zinc-500">{order.buyerName}</p>
                  <p className="mt-1 font-bold">{currency.format(order.totalAmountVnd)}</p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-black">Đối soát doanh thu</h2>
          <dl className="mt-4 grid gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 min-[420px]:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-800">
            {[
              ['Tiền vào', currency.format(dashboard.summary.grossRevenueVnd)],
              ['Đã hoàn', currency.format(dashboard.summary.refundedRevenueVnd)],
              ['Doanh thu ròng', currency.format(dashboard.summary.netRevenueVnd)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white p-4 dark:bg-zinc-900">
                <dt className="text-sm text-zinc-500">{label}</dt>
                <dd className="mt-2 font-black tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h2 className="text-lg font-black">Lượt soát vé gần đây</h2>
          <div className="mt-4 overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {dashboard.recentCheckIns.length === 0 ? (
              <p className="p-5 text-sm text-zinc-500">Chưa có lượt quét vé.</p>
            ) : (
              dashboard.recentCheckIns.map((attempt, index) => (
                <div
                  key={`${attempt.occurredAt}-${index}`}
                  className="flex items-center justify-between gap-3 border-b border-zinc-200 p-4 last:border-b-0 dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <strong className="block truncate">
                      {attempt.ticketCode ?? 'Mã không xác định'}
                    </strong>
                    <span className="text-xs text-zinc-500">{attempt.operatorEmail}</span>
                  </div>
                  <StatusBadge status={attempt.result} />
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
