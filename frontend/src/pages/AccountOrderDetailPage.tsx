import { ArrowLeft, CalendarDays, QrCode, Ticket as TicketIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { TicketQrViewer } from '../components/TicketQrViewer';
import { useAccountOrder } from '../features/account/use-account';
import { getOrderEventLabel } from '../lib/event-labels';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
});

export function AccountOrderDetailPage() {
  const { reference = '' } = useParams();
  const orderQuery = useAccountOrder(reference);
  const order = orderQuery.data;
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  if (orderQuery.isPending) return <div className="min-h-[60dvh] animate-pulse" />;
  if (!order) return <p className="p-10">Không tìm thấy đơn hàng.</p>;
  const tickets = order.tickets ?? [];

  return (
    <section className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      <Link
        to="/tai-khoan"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-zinc-600 dark:text-zinc-300"
      >
        <ArrowLeft size={17} /> Vé của tôi
      </Link>
      <header className="mt-5 border-b border-zinc-200 pb-7 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">Mã đơn</p>
            <h1 className="mt-1 break-all text-2xl font-black sm:text-3xl">{order.reference}</h1>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-zinc-500">Số vé</p>
            <p className="mt-1 font-bold">{order.quantity}</p>
          </div>
          <div>
            <p className="text-zinc-500">Tổng tiền</p>
            <p className="mt-1 font-bold tabular-nums">{currency.format(order.totalAmountVnd)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-zinc-500">Người mua</p>
            <p className="mt-1 truncate font-bold">{order.buyerName}</p>
          </div>
        </div>
      </header>

      <section className="mt-8" aria-labelledby="order-tickets-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="order-tickets-heading" className="flex items-center gap-2 text-xl font-black">
            <TicketIcon className="text-coral-600" size={21} /> Vé trong đơn
          </h2>
          {tickets.length > 1 ? (
            <span className="text-xs text-zinc-500 sm:text-sm">Vuốt để chuyển vé</span>
          ) : null}
        </div>
        {tickets.length ? (
          <div className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {tickets.map((ticket, index) => (
              <button
                key={ticket.code}
                type="button"
                onClick={() => setViewerIndex(index)}
                className="flex min-h-20 w-full items-center justify-between gap-4 py-4 text-left transition hover:text-coral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-coral-500"
              >
                <div className="min-w-0">
                  <p className="font-black">Vé {ticket.sequenceNumber}</p>
                  <p className="mt-1 truncate text-sm text-zinc-500">{ticket.code}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={ticket.status} />
                  <QrCode size={21} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 border-y border-zinc-200 py-8 text-center text-zinc-500 dark:border-zinc-800">
            Vé sẽ xuất hiện tại đây sau khi thanh toán được xác nhận.
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="order-history-heading">
        <h2 id="order-history-heading" className="flex items-center gap-2 text-lg font-black">
          <CalendarDays size={19} /> Lịch sử đơn hàng
        </h2>
        <ol className="mt-4 space-y-4">
          {order.events?.map((event, index) => (
            <li
              key={`${event.action}-${index}`}
              className="border-l-2 border-zinc-200 pl-4 dark:border-zinc-700"
            >
              <p className="font-semibold">{getOrderEventLabel(event.action)}</p>
              <time className="mt-1 block text-sm tabular-nums text-zinc-500">
                {dateTime.format(new Date(event.created_at))}
              </time>
              {event.reason ? (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{event.reason}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
      {viewerIndex !== null ? (
        <TicketQrViewer
          tickets={tickets}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </section>
  );
}
