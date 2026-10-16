import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { cancelAccountOrder } from '../features/account/api';
import { useAccountOrders } from '../features/account/use-account';
import { useAuth } from '../features/auth/use-auth';
import { getGoogleLoginUrl } from '../lib/api-client';
import { getApiErrorMessage } from '../lib/api-error';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const shortDate = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeZone: 'Asia/Ho_Chi_Minh',
});

export function AccountPage() {
  const authQuery = useAuth();
  const authenticated = Boolean(authQuery.data?.authenticated);
  const ordersQuery = useAccountOrders(authenticated);
  const queryClient = useQueryClient();
  const cancelMutation = useMutation({
    mutationFn: ({ reference }: { reference: string }) =>
      cancelAccountOrder(reference, 'Người mua hủy đơn', authQuery.data?.csrfToken ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account'] });
      queryClient.invalidateQueries({ queryKey: ['event-settings'] });
    },
  });

  if (authQuery.isPending) return <div className="min-h-[60dvh] animate-pulse" />;
  if (!authenticated)
    return (
      <section className="mx-auto min-h-[60dvh] max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-black">Vé của tôi</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-300">
          Đăng nhập đúng tài khoản Google đã dùng đặt vé.
        </p>
        <a
          href={getGoogleLoginUrl('/tai-khoan')}
          className="mt-7 inline-flex h-12 items-center rounded-md bg-coral-600 px-5 font-bold text-white"
        >
          Đăng nhập Google
        </a>
      </section>
    );

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-black sm:text-4xl">Vé của tôi</h1>
      <p className="mt-2 max-w-xl text-zinc-500 dark:text-zinc-400">
        Mỗi đơn gồm toàn bộ vé bạn đã đặt. Mở đơn để xem và quét QR.
      </p>
      <div className="mt-9 max-w-4xl">
        <section aria-labelledby="account-orders-heading">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <ClipboardList className="text-coral-600" size={21} />{' '}
            <span id="account-orders-heading">Đơn hàng</span>
          </h2>
          <div className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {ordersQuery.data?.length ? (
              ordersQuery.data.map((order) => (
                <article key={order.reference} className="py-5 sm:py-6">
                  <Link
                    to={`/tai-khoan/don-hang/${order.reference}`}
                    className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral-500"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black">{order.reference}</p>
                        <p className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                          <CalendarDays size={16} /> {shortDate.format(new Date(order.createdAt))}
                        </p>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-sm text-zinc-500">{order.quantity} vé</p>
                        <strong className="mt-1 block text-xl tabular-nums">
                          {currency.format(order.totalAmountVnd)}
                        </strong>
                      </div>
                      <span className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-coral-600 transition group-hover:translate-x-1">
                        Mở đơn <ArrowRight size={17} />
                      </span>
                    </div>
                  </Link>
                  {order.status === 'pending_payment' ? (
                    <button
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate({ reference: order.reference })}
                      className="mt-4 text-sm font-bold text-coral-600"
                    >
                      Hủy đơn chưa thanh toán
                    </button>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="p-5 text-zinc-500">Bạn chưa có đơn hàng.</p>
            )}
          </div>
          {cancelMutation.isError ? (
            <p className="mt-3 text-sm font-bold text-coral-600">
              {getApiErrorMessage(cancelMutation.error, 'Không thể hủy đơn.')}
            </p>
          ) : null}
        </section>
      </div>
    </section>
  );
}
