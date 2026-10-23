import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LockKeyhole, LogIn, Ticket } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../features/auth/use-auth';
import { useEventSettings } from '../features/event/use-event-settings';
import { createOrder } from '../features/orders/api';
import { getApiErrorMessage } from '../lib/api-error';
import { getGoogleLoginUrl } from '../lib/api-client';
import type { CreateOrderInput } from '../types/order';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const formSchema = z.object({
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ và tên hợp lệ.').max(120),
  phone: z.string().regex(/^(?:\+84|0)[\d\s().-]{9,14}$/, 'Số điện thoại không hợp lệ.'),
  quantity: z.number().int().positive(),
});

type OrderFormValues = z.infer<typeof formSchema>;

export function OrderPage() {
  const authQuery = useAuth();
  const eventQuery = useEventSettings();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const auth = authQuery.data;
  const event = eventQuery.data;
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<OrderFormValues>({ defaultValues: { fullName: '', phone: '', quantity: 1 } });
  const quantity = watch('quantity');

  const orderMutation = useMutation({
    mutationFn: (input: CreateOrderInput) => createOrder(input, auth?.csrfToken ?? ''),
    onSuccess: (order) => {
      queryClient.setQueryData(['orders', order.reference], order);
      queryClient.invalidateQueries({ queryKey: ['event-settings'] });
      navigate(`/don-hang/${order.reference}`);
    },
  });

  const onSubmit = handleSubmit((values) => {
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'fullName' || field === 'phone' || field === 'quantity') {
          setError(field, { message: issue.message });
        }
      }
      return;
    }
    orderMutation.mutate({
      ...parsed.data,
      fullName: parsed.data.fullName.toLocaleUpperCase('vi-VN'),
    });
  });

  if (authQuery.isPending || eventQuery.isPending) {
    return <div className="mx-auto min-h-[60dvh] max-w-5xl animate-pulse px-4 py-16" />;
  }

  if (!auth?.authenticated) {
    return (
      <section className="mx-auto min-h-[calc(100dvh-5rem)] max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600"
        >
          <ArrowLeft aria-hidden="true" size={17} strokeWidth={1.8} /> Trang sự kiện
        </Link>
        <div className="mt-12 max-w-xl border-l-4 border-brand-magenta-600 pl-6">
          <h1 className="text-3xl font-black sm:text-4xl">Đăng nhập để đặt vé</h1>
          <p className="mt-4 leading-relaxed text-zinc-600">
            Email xác minh từ Google sẽ được dùng cho đơn hàng của bạn.
          </p>
          {auth?.googleAuthAvailable ? (
            <a
              href={getGoogleLoginUrl('/dat-ve')}
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-md bg-brand-navy-600 px-5 font-bold text-white hover:bg-brand-navy-500"
            >
              <LogIn aria-hidden="true" size={18} strokeWidth={1.8} /> Đăng nhập Google
            </a>
          ) : (
            <p className="mt-7 font-semibold text-brand-magenta-600">
              Đăng nhập hiện chưa sẵn sàng.
            </p>
          )}
        </div>
      </section>
    );
  }

  if (!event || !event.canOrder) {
    return (
      <section className="mx-auto min-h-[60dvh] max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-black">Chưa thể đặt vé</h1>
        <p className="mt-4 text-zinc-600">
          Cửa bán vé hiện không mở. Trạng thái trên trang sự kiện là thông tin mới nhất.
        </p>
        <Link to="/" className="mt-7 inline-flex font-bold text-brand-magenta-600">
          Về trang sự kiện
        </Link>
      </section>
    );
  }

  const estimatedTotal = Number.isFinite(quantity) ? event.ticketPriceVnd * quantity : 0;

  return (
    <section className="bg-zinc-50 py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600"
        >
          <ArrowLeft aria-hidden="true" size={17} strokeWidth={1.8} /> Trang sự kiện
        </Link>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:gap-10">
          <div>
            <h1 className="text-3xl font-black sm:text-4xl">Thông tin đặt vé</h1>
            <form onSubmit={onSubmit} className="mt-8 grid gap-6" noValidate>
              <label className="grid gap-2 font-semibold">
                Họ và tên
                <input
                  {...register('fullName')}
                  onInput={(inputEvent) => {
                    inputEvent.currentTarget.value =
                      inputEvent.currentTarget.value.toLocaleUpperCase('vi-VN');
                  }}
                  autoComplete="name"
                  className="h-12 rounded-md border border-zinc-300 bg-white px-4 font-normal outline-none focus:border-brand-cyan-600 focus:ring-2 focus:ring-brand-cyan-600/20"
                />
                {errors.fullName ? (
                  <span className="text-sm text-red-600">
                    {errors.fullName.message}
                  </span>
                ) : null}
              </label>
              <label className="grid gap-2 font-semibold">
                Số điện thoại
                <input
                  {...register('phone')}
                  inputMode="tel"
                  autoComplete="tel"
                  className="h-12 rounded-md border border-zinc-300 bg-white px-4 font-normal outline-none focus:border-brand-cyan-600 focus:ring-2 focus:ring-brand-cyan-600/20"
                />
                {errors.phone ? (
                  <span className="text-sm text-red-600">
                    {errors.phone.message}
                  </span>
                ) : null}
              </label>
              <label className="grid gap-2 font-semibold">
                Email
                <input
                  value={auth.user?.email ?? ''}
                  readOnly
                  aria-readonly="true"
                  className="h-12 rounded-md border border-zinc-300 bg-zinc-100 px-4 font-normal text-zinc-600"
                />
              </label>
              <label className="grid gap-2 font-semibold">
                Số lượng vé
                <input
                  type="number"
                  min={event.minTicketsPerOrder}
                  max={event.maxTicketsPerOrder}
                  {...register('quantity', { valueAsNumber: true })}
                  className="h-12 rounded-md border border-zinc-300 bg-white px-4 font-normal outline-none focus:border-brand-cyan-600 focus:ring-2 focus:ring-brand-cyan-600/20"
                />
                <span className="text-sm font-normal text-zinc-500">
                  Từ {event.minTicketsPerOrder} đến {event.maxTicketsPerOrder} vé mỗi đơn.
                </span>
              </label>
              {orderMutation.isError ? (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 p-4 text-sm font-semibold text-red-700"
                >
                  {getApiErrorMessage(orderMutation.error, 'Không thể tạo đơn. Vui lòng thử lại.')}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={orderMutation.isPending}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand-magenta-600 px-5 text-center font-bold text-white hover:bg-brand-magenta-500 active:translate-y-px disabled:cursor-wait disabled:opacity-60"
              >
                <LockKeyhole aria-hidden="true" size={18} strokeWidth={1.8} />
                {orderMutation.isPending ? 'Đang phát hành vé...' : 'Xác nhận và nhận vé'}
              </button>
            </form>
          </div>
          <aside className="order-first h-fit rounded-md border border-zinc-200 bg-white p-5 lg:order-none lg:sticky lg:top-6 lg:p-6">
            <div className="flex items-center gap-3 text-brand-magenta-600">
              <Ticket aria-hidden="true" size={20} strokeWidth={1.8} />
              <h2 className="font-bold">Tóm tắt đơn</h2>
            </div>
            <dl className="mt-6 grid gap-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Đơn giá</dt>
                <dd className="font-bold">{currency.format(event.ticketPriceVnd)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Số lượng</dt>
                <dd className="font-bold">{Number.isFinite(quantity) ? quantity : 0}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-zinc-200 pt-4">
                <dt className="font-bold">Tạm tính</dt>
                <dd className="text-lg font-black">{currency.format(estimatedTotal)}</dd>
              </div>
            </dl>
            <p className="mt-6 text-sm leading-relaxed text-zinc-500">
              Hệ thống đang phát hành vé ngay sau khi đặt, chưa yêu cầu thanh toán. Giá trị đơn vẫn
              được lưu để phục vụ giai đoạn thanh toán sau này.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
