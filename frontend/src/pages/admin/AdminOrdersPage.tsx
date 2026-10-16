import { ArrowRight, CalendarDays, Search, Ticket } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { listAdminOrders } from '../../features/admin/api';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function AdminOrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || 1);
  const status = params.get('status') || '';
  const search = params.get('search') || '';
  const ordersQuery = useQuery({
    queryKey: ['admin', 'orders', page, status, search],
    queryFn: () =>
      listAdminOrders({ page, status: status || undefined, search: search || undefined }),
    refetchInterval: 10_000,
  });
  const result = ordersQuery.data;

  return (
    <section>
      <h1 className="text-2xl font-black sm:text-3xl">Đơn hàng</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Đối soát thanh toán, hủy đơn và xử lý hoàn tiền.
      </p>
      <form
        className="mt-6 grid gap-3 md:grid-cols-[1fr_220px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setParams({
            ...(String(form.get('search') || '') ? { search: String(form.get('search')) } : {}),
            ...(String(form.get('status') || '') ? { status: String(form.get('status')) } : {}),
          });
        }}
      >
        <label className="relative">
          <Search className="absolute left-3 top-3 text-zinc-400" size={18} strokeWidth={1.8} />
          <input
            name="search"
            defaultValue={search}
            placeholder="Mã đơn, tên, email, điện thoại"
            className="h-11 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-3 outline-none focus:border-coral-600 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <select
          name="status"
          defaultValue={status}
          className="h-11 rounded-md border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Mọi trạng thái</option>
          <option value="pending_payment">Chờ thanh toán</option>
          <option value="payment_review">Cần đối soát</option>
          <option value="paid">Đã xác nhận</option>
          <option value="refund_pending">Chờ hoàn tiền</option>
          <option value="refunded">Đã hoàn tiền</option>
          <option value="expired">Hết hạn</option>
          <option value="cancelled">Đã hủy</option>
        </select>
        <button className="h-11 w-full rounded-md bg-coral-600 px-5 font-bold text-white transition active:translate-y-px">
          Lọc
        </button>
      </form>

      <div className="mt-6 grid gap-3 md:hidden">
        {result?.data.map((order) => (
          <Link
            key={order.reference}
            to={`/admin/don-hang/${order.reference}`}
            className="rounded-md border border-zinc-200 bg-white p-4 transition active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-all font-black text-coral-600 dark:text-coral-400">
                  {order.reference}
                </p>
                <p className="mt-2 break-words font-semibold">{order.buyerName}</p>
                <p className="mt-1 break-all text-sm text-zinc-500">{order.buyerEmail}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
              <span className="flex items-center gap-2 text-zinc-500">
                <Ticket size={16} /> {order.quantity} vé
              </span>
              <strong className="text-right tabular-nums">
                {currency.format(order.totalAmountVnd)}
              </strong>
              <span className="col-span-2 flex items-center gap-2 text-zinc-500">
                <CalendarDays size={16} />
                {new Intl.DateTimeFormat('vi-VN', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(order.createdAt))}
              </span>
            </div>
            <span className="mt-4 flex min-h-11 items-center justify-end gap-2 text-sm font-bold text-coral-600 dark:text-coral-400">
              Mở đơn <ArrowRight size={17} />
            </span>
          </Link>
        ))}
        {!ordersQuery.isPending && result?.data.length === 0 ? (
          <p className="rounded-md border border-zinc-200 bg-white p-6 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            Không có đơn phù hợp.
          </p>
        ) : null}
      </div>
      <div className="mt-6 hidden overflow-x-auto rounded-md border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <tr>
              <th className="px-4 py-3">Mã đơn</th>
              <th className="px-4 py-3">Người mua</th>
              <th className="px-4 py-3">Số vé</th>
              <th className="px-4 py-3">Tổng tiền</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Tạo lúc</th>
            </tr>
          </thead>
          <tbody>
            {result?.data.map((order) => (
              <tr key={order.reference} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-4">
                  <Link
                    className="font-black text-coral-600 dark:text-coral-400"
                    to={`/admin/don-hang/${order.reference}`}
                  >
                    {order.reference}
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <strong className="block">{order.buyerName}</strong>
                  <span className="text-zinc-500">{order.buyerEmail}</span>
                </td>
                <td className="px-4 py-4 tabular-nums">{order.quantity}</td>
                <td className="px-4 py-4 font-bold tabular-nums">
                  {currency.format(order.totalAmountVnd)}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-4 text-zinc-500">
                  {new Intl.DateTimeFormat('vi-VN', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(order.createdAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!ordersQuery.isPending && result?.data.length === 0 ? (
          <p className="p-6 text-center text-zinc-500">Không có đơn phù hợp.</p>
        ) : null}
      </div>
      {result && result.pagination.totalPages > 1 ? (
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:flex sm:justify-end">
          <button
            disabled={page <= 1}
            onClick={() =>
              setParams((current) => {
                current.set('page', String(page - 1));
                return current;
              })
            }
            className="min-h-11 rounded-md border border-zinc-300 px-3 py-2 disabled:opacity-40 dark:border-zinc-700"
          >
            Trước
          </button>
          <span className="text-center text-sm tabular-nums">
            {page}/{result.pagination.totalPages}
          </span>
          <button
            disabled={page >= result.pagination.totalPages}
            onClick={() =>
              setParams((current) => {
                current.set('page', String(page + 1));
                return current;
              })
            }
            className="min-h-11 rounded-md border border-zinc-300 px-3 py-2 disabled:opacity-40 dark:border-zinc-700"
          >
            Sau
          </button>
        </div>
      ) : null}
    </section>
  );
}
