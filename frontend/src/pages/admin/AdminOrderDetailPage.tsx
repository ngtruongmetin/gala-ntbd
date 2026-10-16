import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote, Ban, RotateCcw } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import {
  cancelAdminOrder,
  confirmManualRefund,
  getAdminOrder,
  recordManualPayment,
  requestOrderRefund,
  resolveOrderPayment,
} from '../../features/admin/api';
import { useAuth } from '../../features/auth/use-auth';
import { getApiErrorMessage } from '../../lib/api-error';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

function nowLocalInput() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

export function AdminOrderDetailPage() {
  const { reference = '' } = useParams();
  const auth = useAuth().data;
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const orderQuery = useQuery({
    queryKey: ['admin', 'orders', reference],
    queryFn: () => getAdminOrder(reference),
  });
  const order = orderQuery.data;
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  };
  const action = useMutation({
    mutationFn: async (task: () => Promise<unknown>) => task(),
    onSuccess: () => {
      setMessage('Thao tác đã hoàn tất.');
      refresh();
    },
  });

  if (orderQuery.isPending) return <div className="min-h-[60dvh] animate-pulse" />;
  if (!order) return <p>Không tìm thấy đơn hàng.</p>;
  const csrf = auth?.csrfToken ?? '';

  const submitPayment = (event: FormEvent<HTMLFormElement>, refund = false) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      transactionReference: String(form.get('transactionReference')),
      amountVnd: Number(form.get('amountVnd')),
      occurredAt: new Date(String(form.get('occurredAt'))).toISOString(),
      notes: String(form.get('notes') || ''),
    };
    action.mutate(() =>
      refund
        ? confirmManualRefund(reference, input, csrf)
        : recordManualPayment(reference, input, csrf),
    );
  };

  return (
    <section>
      <Link
        to="/admin/don-hang"
        className="inline-flex items-center gap-2 text-sm font-bold text-zinc-600 dark:text-zinc-300"
      >
        <ArrowLeft size={17} strokeWidth={1.8} /> Danh sách đơn
      </Link>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Mã đơn</p>
          <h1 className="mt-1 break-all text-2xl font-black sm:text-3xl">{order.reference}</h1>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="mt-7 grid gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-800">
        {[
          ['Người mua', order.buyerName],
          ['Email', order.buyerEmail],
          ['Số vé', `${order.quantity}`],
          ['Tổng tiền', currency.format(order.totalAmountVnd)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 bg-white p-5 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 break-words font-black">{value}</p>
          </div>
        ))}
      </div>

      {message ? <p className="mt-5 text-sm font-bold text-emerald-600">{message}</p> : null}
      {action.isError ? (
        <p className="mt-5 rounded-md bg-coral-500/10 p-4 text-sm font-bold text-coral-600">
          {getApiErrorMessage(action.error, 'Thao tác thất bại.')}
        </p>
      ) : null}

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <section>
          <h2 className="text-lg font-black">Thanh toán và hành động</h2>
          {['pending_payment', 'expired', 'cancelled', 'payment_review'].includes(order.status) ? (
            <form
              onSubmit={(event) => submitPayment(event)}
              className="mt-4 grid gap-3 rounded-md border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <label className="grid gap-1 text-sm font-bold">
                Mã giao dịch
                <input
                  required
                  name="transactionReference"
                  className="h-11 min-w-0 rounded-md border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-bold">
                  Số tiền
                  <input
                    required
                    name="amountVnd"
                    type="number"
                    defaultValue={order.totalAmountVnd}
                    inputMode="numeric"
                    className="h-11 min-w-0 rounded-md border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  Thời điểm
                  <input
                    required
                    name="occurredAt"
                    type="datetime-local"
                    defaultValue={nowLocalInput()}
                    className="h-11 min-w-0 rounded-md border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
                  />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-bold">
                Ghi chú
                <input
                  name="notes"
                  className="h-11 min-w-0 rounded-md border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
                />
              </label>
              <button
                disabled={action.isPending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-coral-600 px-4 font-bold text-white"
              >
                <Banknote size={18} strokeWidth={1.8} /> Ghi nhận chuyển khoản
              </button>
            </form>
          ) : null}
          {order.status === 'pending_payment' ? (
            <button
              onClick={() =>
                action.mutate(() => cancelAdminOrder(reference, 'Quản trị viên hủy đơn', csrf))
              }
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-coral-500 px-4 py-2 text-center font-bold text-coral-600 sm:w-auto"
            >
              <Ban size={17} /> Hủy đơn
            </button>
          ) : null}
          {order.status === 'paid' ? (
            <button
              onClick={() =>
                action.mutate(() =>
                  requestOrderRefund(reference, 'Quản trị viên yêu cầu hoàn tiền', csrf),
                )
              }
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-coral-500 px-4 py-2 text-center font-bold text-coral-600 sm:w-auto"
            >
              <RotateCcw size={17} /> Yêu cầu hoàn tiền
            </button>
          ) : null}
          {order.status === 'refund_pending' ? (
            <form
              onSubmit={(event) => submitPayment(event, true)}
              className="mt-4 grid gap-3 rounded-md border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <label className="grid gap-1 text-sm font-bold">
                Mã giao dịch hoàn
                <input
                  required
                  name="transactionReference"
                  className="h-11 min-w-0 rounded-md border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
                />
              </label>
              <input type="hidden" name="amountVnd" value={order.totalAmountVnd} />
              <input type="hidden" name="occurredAt" value={nowLocalInput()} />
              <button className="h-11 rounded-md bg-coral-600 px-4 font-bold text-white">
                Xác nhận đã hoàn {currency.format(order.totalAmountVnd)}
              </button>
            </form>
          ) : null}
        </section>

        <section>
          <h2 className="text-lg font-black">Vé trong đơn</h2>
          <div className="mt-4 overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {order.tickets?.length ? (
              order.tickets.map((ticket) => (
                <Link
                  key={ticket.code}
                  to={`/admin/ve/${ticket.code}`}
                  className="flex min-h-20 items-center justify-between gap-3 border-b border-zinc-200 p-4 last:border-b-0 dark:border-zinc-800"
                >
                  <span className="min-w-0">
                    <strong className="block break-all">{ticket.code}</strong>
                    <small className="mt-1 block text-zinc-500">
                      Vé {ticket.sequenceNumber}/{order.quantity}
                    </small>
                  </span>
                  <StatusBadge status={ticket.status} />
                </Link>
              ))
            ) : (
              <p className="p-5 text-sm text-zinc-500">Chưa phát hành vé.</p>
            )}
          </div>
        </section>
      </div>

      {order.status === 'payment_review' &&
      order.transactions?.some((item) => ['amount_mismatch', 'late'].includes(item.matchStatus)) ? (
        <section className="mt-8">
          <h2 className="text-lg font-black">Giao dịch cần đối soát</h2>
          {order.transactions
            .filter((item) => ['amount_mismatch', 'late'].includes(item.matchStatus))
            .map((item) => (
              <div
                key={item.id}
                className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <StatusBadge status={item.matchStatus} />
                  <p className="mt-2 font-black">{currency.format(item.amountVnd)}</p>
                  <p className="text-sm text-zinc-500">{item.reference}</p>
                </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                  <button
                    onClick={() =>
                      action.mutate(() =>
                        resolveOrderPayment(
                          reference,
                          {
                            transactionId: item.id,
                            decision: 'ignore',
                            reason: 'Giao dịch không thuộc đơn',
                          },
                          csrf,
                        ),
                      )
                    }
                    className="min-h-11 rounded-md border border-zinc-300 px-3 py-2 text-sm font-bold dark:border-zinc-700"
                  >
                    Bỏ qua
                  </button>
                  <button
                    onClick={() =>
                      action.mutate(() =>
                        resolveOrderPayment(
                          reference,
                          {
                            transactionId: item.id,
                            decision: 'accept',
                            reason: 'Quản trị viên xác nhận giao dịch hợp lệ',
                          },
                          csrf,
                        ),
                      )
                    }
                    className="min-h-11 rounded-md bg-coral-600 px-3 py-2 text-sm font-bold text-white"
                  >
                    Chấp nhận
                  </button>
                </div>
              </div>
            ))}
        </section>
      ) : null}
      <section className="mt-10">
        <h2 className="text-lg font-black">Lịch sử đơn hàng</h2>
        <div className="mt-4 border-l border-zinc-300 pl-5 dark:border-zinc-700">
          {order.events?.map((event, index) => (
            <div key={`${event.action}-${index}`} className="pb-5">
              <strong>{event.action}</strong>
              <p className="mt-1 text-sm text-zinc-500">
                {new Intl.DateTimeFormat('vi-VN', {
                  dateStyle: 'medium',
                  timeStyle: 'medium',
                }).format(new Date(event.created_at))}
              </p>
              {event.reason ? <p className="mt-1 text-sm">{event.reason}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
