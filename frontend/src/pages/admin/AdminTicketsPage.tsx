import { ArrowRight, Hash, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { listAdminTickets } from '../../features/admin/api';

export function AdminTicketsPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || 1);
  const status = params.get('status') || '';
  const search = params.get('search') || '';
  const ticketsQuery = useQuery({
    queryKey: ['admin', 'tickets', page, status, search],
    queryFn: () =>
      listAdminTickets({ page, status: status || undefined, search: search || undefined }),
  });
  const result = ticketsQuery.data;

  return (
    <section>
      <h1 className="text-2xl font-black sm:text-3xl">Vé đã phát hành</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Tra cứu, thu hồi, kích hoạt lại và cấp lại QR.
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
          <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
          <input
            name="search"
            defaultValue={search}
            placeholder="Mã vé, mã đơn, người mua"
            className="h-11 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <select
          name="status"
          defaultValue={status}
          className="h-11 rounded-md border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Mọi trạng thái</option>
          <option value="valid">Còn hiệu lực</option>
          <option value="checked_in">Đã soát vé</option>
          <option value="void">Đã thu hồi</option>
          <option value="refunded">Đã hoàn tiền</option>
        </select>
        <button className="h-11 w-full rounded-md bg-coral-600 px-5 font-bold text-white transition active:translate-y-px">
          Lọc
        </button>
      </form>
      <div className="mt-6 grid gap-3 md:hidden">
        {result?.data.map((ticket) => (
          <Link
            key={ticket.code}
            to={`/admin/ve/${ticket.code}`}
            className="rounded-md border border-zinc-200 bg-white p-4 transition active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-all font-black text-coral-600 dark:text-coral-400">
                  {ticket.code}
                </p>
                <p className="mt-2 break-words font-semibold">{ticket.buyerName}</p>
                <p className="mt-1 break-all text-sm text-zinc-500">{ticket.buyerEmail}</p>
              </div>
              <StatusBadge status={ticket.status} />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
              <span className="flex items-center gap-2 text-zinc-500">
                <Hash size={16} /> Vé {ticket.sequenceNumber}
              </span>
              <span className="break-all font-semibold">{ticket.orderReference}</span>
            </div>
            <span className="mt-3 flex min-h-11 items-center justify-end gap-2 text-sm font-bold text-coral-600 dark:text-coral-400">
              Mở vé <ArrowRight size={17} />
            </span>
          </Link>
        ))}
        {!ticketsQuery.isPending && result?.data.length === 0 ? (
          <p className="rounded-md border border-zinc-200 bg-white p-6 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            Chưa có vé phù hợp.
          </p>
        ) : null}
      </div>
      <div className="mt-6 hidden overflow-x-auto rounded-md border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            <tr>
              <th className="px-4 py-3">Mã vé</th>
              <th className="px-4 py-3">Mã đơn</th>
              <th className="px-4 py-3">Người mua</th>
              <th className="px-4 py-3">Thứ tự</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {result?.data.map((ticket) => (
              <tr key={ticket.code} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-4">
                  <Link
                    to={`/admin/ve/${ticket.code}`}
                    className="font-black text-coral-600 dark:text-coral-400"
                  >
                    {ticket.code}
                  </Link>
                </td>
                <td className="px-4 py-4">{ticket.orderReference}</td>
                <td className="px-4 py-4">
                  <strong>{ticket.buyerName}</strong>
                  <span className="block text-zinc-500">{ticket.buyerEmail}</span>
                </td>
                <td className="px-4 py-4">#{ticket.sequenceNumber}</td>
                <td className="px-4 py-4">
                  <StatusBadge status={ticket.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!ticketsQuery.isPending && result?.data.length === 0 ? (
          <p className="p-6 text-center text-zinc-500">Chưa có vé phù hợp.</p>
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
            className="min-h-11 rounded-md border px-3 py-2 disabled:opacity-40"
          >
            Trước
          </button>
          <span className="py-2 text-center text-sm tabular-nums">
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
            className="min-h-11 rounded-md border px-3 py-2 disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      ) : null}
    </section>
  );
}
