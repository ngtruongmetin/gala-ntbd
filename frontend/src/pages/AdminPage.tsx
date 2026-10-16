import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Handshake,
  LockKeyhole,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import {
  createEventPartner,
  deleteEventPartner,
  updateEventPartner,
  updateEventSettings,
} from '../features/admin/api';
import { adminDashboardQueryKey, useAdminDashboard } from '../features/admin/use-admin-dashboard';
import { useAuth } from '../features/auth/use-auth';
import { getApiErrorMessage } from '../lib/api-error';
import { getGoogleLoginUrl } from '../lib/api-client';
import type { AdminDashboard, UpdateEventSettingsInput } from '../types/admin';
import type { EventSettings } from '../types/event';
import type { EventPartner } from '../types/event';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const adminFormSchema = z
  .object({
    eventName: z.string().trim().min(3, 'Tên sự kiện quá ngắn.'),
    eventSubtitle: z.string().trim().min(3, 'Mục đích sự kiện quá ngắn.'),
    venue: z.string().trim().min(3, 'Địa điểm không hợp lệ.'),
    eventStartsAt: z.string().min(1, 'Chọn thời gian tổ chức.'),
    ticketPriceVnd: z.number().int().positive('Giá vé phải lớn hơn 0.'),
    totalCapacity: z.number().int().positive('Tổng số vé phải lớn hơn 0.'),
    minTicketsPerOrder: z.number().int().positive(),
    maxTicketsPerOrder: z.number().int().positive(),
    salesStartAt: z.string().min(1, 'Chọn thời gian bắt đầu bán.'),
    salesEndAt: z.string().min(1, 'Chọn thời gian kết thúc bán.'),
    reservationMinutes: z.number().int().min(1).max(1440),
    salesOpen: z.boolean(),
  })
  .superRefine((data, context) => {
    if (data.maxTicketsPerOrder < data.minTicketsPerOrder) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxTicketsPerOrder'],
        message: 'Giới hạn tối đa phải lớn hơn hoặc bằng tối thiểu.',
      });
    }
    if (data.maxTicketsPerOrder > data.totalCapacity) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxTicketsPerOrder'],
        message: 'Không được vượt tổng số vé.',
      });
    }
    if (data.salesEndAt <= data.salesStartAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['salesEndAt'],
        message: 'Phải sau thời gian bắt đầu bán.',
      });
    }
  });

type AdminFormValues = z.infer<typeof adminFormSchema>;

function toVietnamLocalInput(isoValue: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(new Date(isoValue))
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function toIsoFromVietnam(value: string) {
  return new Date(`${value}:00+07:00`).toISOString();
}

function getDefaults(settings: EventSettings): AdminFormValues {
  return {
    eventName: settings.eventName,
    eventSubtitle: settings.eventSubtitle ?? '',
    venue: settings.venue ?? '',
    eventStartsAt: toVietnamLocalInput(settings.eventStartsAt ?? settings.salesEndAt),
    ticketPriceVnd: settings.ticketPriceVnd,
    totalCapacity: settings.totalCapacity,
    minTicketsPerOrder: settings.minTicketsPerOrder,
    maxTicketsPerOrder: settings.maxTicketsPerOrder,
    salesStartAt: toVietnamLocalInput(settings.salesStartAt),
    salesEndAt: toVietnamLocalInput(settings.salesEndAt),
    reservationMinutes: settings.reservationMinutes,
    salesOpen: settings.salesStatus === 'open',
  };
}

function EventSettingsForm({
  dashboard,
  csrfToken,
}: {
  dashboard: AdminDashboard;
  csrfToken: string;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<AdminFormValues>({ defaultValues: getDefaults(dashboard.settings) });
  const salesOpen = watch('salesOpen');

  const mutation = useMutation({
    mutationFn: (input: UpdateEventSettingsInput) => updateEventSettings(input, csrfToken),
    onSuccess: (settings) => {
      queryClient.setQueryData<AdminDashboard>(adminDashboardQueryKey, {
        ...dashboard,
        settings,
      });
      queryClient.invalidateQueries({ queryKey: ['event-settings'] });
    },
  });

  const onSubmit = handleSubmit((values) => {
    const parsed = adminFormSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof AdminFormValues;
        setError(field, { message: issue.message });
      }
      return;
    }

    mutation.mutate({
      eventName: parsed.data.eventName,
      eventSubtitle: parsed.data.eventSubtitle,
      venue: parsed.data.venue,
      eventStartsAt: toIsoFromVietnam(parsed.data.eventStartsAt),
      ticketPriceVnd: parsed.data.ticketPriceVnd,
      totalCapacity: parsed.data.totalCapacity,
      minTicketsPerOrder: parsed.data.minTicketsPerOrder,
      maxTicketsPerOrder: parsed.data.maxTicketsPerOrder,
      salesStartAt: toIsoFromVietnam(parsed.data.salesStartAt),
      salesEndAt: toIsoFromVietnam(parsed.data.salesEndAt),
      reservationMinutes: parsed.data.reservationMinutes,
      salesStatus: parsed.data.salesOpen ? 'open' : 'paused',
    });
  });

  const fieldClass =
    'h-11 min-w-0 w-full rounded-md border border-zinc-300 bg-white px-3 font-normal outline-none focus:border-coral-600 focus:ring-2 focus:ring-coral-600/20 dark:border-zinc-700 dark:bg-zinc-950';

  return (
    <form onSubmit={onSubmit} className="mt-10 min-w-0" noValidate>
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <div>
          <h2 className="text-xl font-black">Cấu hình mở bán</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Mọi thay đổi được hệ thống áp dụng cho luồng đặt vé.
          </p>
        </div>
        <label className="inline-flex w-fit cursor-pointer items-center gap-3 font-bold">
          <input type="checkbox" className="peer sr-only" {...register('salesOpen')} />
          <span className="relative h-7 w-12 rounded-full bg-zinc-300 transition after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:bg-coral-600 peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-coral-500 dark:bg-zinc-700" />
          {salesOpen ? 'Đang mở bán' : 'Đang tạm dừng'}
        </label>
      </div>

      <div className="grid gap-8 py-8 lg:grid-cols-2">
        <fieldset className="grid min-w-0 content-start gap-5">
          <legend className="mb-5 text-base font-black">Thông tin sự kiện</legend>
          <label className="grid gap-2 text-sm font-semibold">
            Tên sự kiện
            <input className={fieldClass} {...register('eventName')} />
            {errors.eventName ? (
              <span className="text-coral-600">{errors.eventName.message}</span>
            ) : null}
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Mục đích
            <input className={fieldClass} {...register('eventSubtitle')} />
            {errors.eventSubtitle ? (
              <span className="text-coral-600">{errors.eventSubtitle.message}</span>
            ) : null}
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Địa điểm
            <input className={fieldClass} {...register('venue')} />
            {errors.venue ? <span className="text-coral-600">{errors.venue.message}</span> : null}
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Thời gian tổ chức
            <input type="datetime-local" className={fieldClass} {...register('eventStartsAt')} />
            {errors.eventStartsAt ? (
              <span className="text-coral-600">{errors.eventStartsAt.message}</span>
            ) : null}
          </label>
        </fieldset>

        <fieldset className="grid min-w-0 content-start gap-5">
          <legend className="mb-5 text-base font-black">Vé và thời gian bán</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Giá vé (VND)
              <input
                type="number"
                className={fieldClass}
                {...register('ticketPriceVnd', { valueAsNumber: true })}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Tổng số vé
              <input
                type="number"
                className={fieldClass}
                {...register('totalCapacity', { valueAsNumber: true })}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Tối thiểu mỗi đơn
              <input
                type="number"
                className={fieldClass}
                {...register('minTicketsPerOrder', { valueAsNumber: true })}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Tối đa mỗi đơn
              <input
                type="number"
                className={fieldClass}
                {...register('maxTicketsPerOrder', { valueAsNumber: true })}
              />
              {errors.maxTicketsPerOrder ? (
                <span className="text-coral-600">{errors.maxTicketsPerOrder.message}</span>
              ) : null}
            </label>
          </div>
          <label className="grid gap-2 text-sm font-semibold">
            Bắt đầu bán
            <input type="datetime-local" className={fieldClass} {...register('salesStartAt')} />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Kết thúc bán
            <input type="datetime-local" className={fieldClass} {...register('salesEndAt')} />
            {errors.salesEndAt ? (
              <span className="text-coral-600">{errors.salesEndAt.message}</span>
            ) : null}
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Giữ chỗ chờ thanh toán (phút)
            <input
              type="number"
              className={fieldClass}
              {...register('reservationMinutes', { valueAsNumber: true })}
            />
          </label>
        </fieldset>
      </div>

      {mutation.isError ? (
        <p
          role="alert"
          className="mb-5 rounded-md bg-coral-500/10 p-4 text-sm font-semibold text-coral-700 dark:text-coral-400"
        >
          {getApiErrorMessage(mutation.error, 'Không thể lưu cấu hình.')}
        </p>
      ) : null}
      {mutation.isSuccess ? (
        <p className="mb-5 text-sm font-bold text-emerald-700 dark:text-emerald-400">
          Đã lưu cấu hình sự kiện.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-coral-600 px-5 text-center font-bold text-white transition hover:bg-coral-500 active:translate-y-px disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        <Save aria-hidden="true" size={18} strokeWidth={1.8} />
        {mutation.isPending ? 'Đang lưu...' : 'Lưu cấu hình'}
      </button>
    </form>
  );
}

function PartnerManager({ partners, csrfToken }: { partners: EventPartner[]; csrfToken: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EventPartner | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (task: () => Promise<unknown>) => task(),
    onSuccess: () => {
      setEditing(null);
      setPreviewUrl(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['event-settings'] });
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      name: String(form.get('name') || '').trim(),
      websiteUrl: String(form.get('websiteUrl') || '').trim() || null,
      sortOrder: Number(form.get('sortOrder') || 0),
      active: form.get('active') === 'on',
      logo:
        form.get('logo') instanceof File && (form.get('logo') as File).size
          ? (form.get('logo') as File)
          : undefined,
    };
    mutation.mutate(() =>
      editing
        ? updateEventPartner(editing.id, input, csrfToken)
        : createEventPartner(input, csrfToken),
    );
    if (!editing) event.currentTarget.reset();
  };

  return (
    <section className="mt-12 border-t border-zinc-200 pt-9 dark:border-zinc-800">
      <div className="flex items-start gap-3">
        <Handshake className="mt-1 shrink-0 text-coral-600" size={24} />
        <div>
          <h2 className="text-xl font-black">Đơn vị đồng hành</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Quản lý nhà tài trợ và đối tác hiển thị trên trang chủ. Trường và Đoàn trường là nhận
            diện cố định, không nằm trong danh sách này.
          </p>
        </div>
      </div>
      <form
        onSubmit={submit}
        className="mt-6 grid min-w-0 gap-3 rounded-md bg-white p-4 md:grid-cols-2 dark:bg-zinc-900"
      >
        <label className="grid min-w-0 gap-2 text-sm font-bold">
          Tên đơn vị
          <input
            required
            name="name"
            defaultValue={editing?.name ?? ''}
            key={`name-${editing?.id ?? 'new'}`}
            className="h-11 rounded-md border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
          />
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-bold">
          Logo
          <input
            required={!editing}
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            key={`logo-${editing?.id ?? 'new'}`}
            onChange={(inputEvent) => {
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              const file = inputEvent.currentTarget.files?.[0];
              setPreviewUrl(file ? URL.createObjectURL(file) : null);
            }}
            className="min-h-11 w-full min-w-0 max-w-full rounded-md border border-zinc-300 bg-transparent text-sm file:mr-3 file:min-h-11 file:border-0 file:bg-zinc-100 file:px-3 file:font-bold dark:border-zinc-700 dark:file:bg-zinc-800"
          />
          <span className="font-normal text-zinc-500">
            PNG, JPEG hoặc WebP, tối đa 2 MB.
            {editing ? ' Để trống nếu giữ logo hiện tại.' : ''}
          </span>
        </label>
        {previewUrl || editing ? (
          <img
            src={previewUrl ?? editing?.logoUrl}
            alt="Xem trước logo"
            className="h-20 w-auto max-w-48 object-contain md:col-span-2"
          />
        ) : null}
        <label className="grid gap-2 text-sm font-bold">
          Trang web (không bắt buộc)
          <input
            type="url"
            name="websiteUrl"
            placeholder="https://..."
            defaultValue={editing?.websiteUrl ?? ''}
            key={`url-${editing?.id ?? 'new'}`}
            className="h-11 rounded-md border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
          />
        </label>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <label className="grid gap-2 text-sm font-bold">
            Thứ tự
            <input
              type="number"
              min="0"
              name="sortOrder"
              defaultValue={editing?.sortOrder ?? 0}
              key={`sort-${editing?.id ?? 'new'}`}
              className="h-11 rounded-md border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
            />
          </label>
          <label className="flex items-end gap-2 pb-3 text-sm font-bold">
            <input
              type="checkbox"
              name="active"
              defaultChecked={editing?.active ?? true}
              key={`active-${editing?.id ?? 'new'}`}
              className="size-5 accent-coral-600"
            />{' '}
            Hiển thị
          </label>
        </div>
        <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row">
          <button
            disabled={mutation.isPending}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-coral-600 px-4 font-bold text-white disabled:opacity-60"
          >
            {editing ? <Save size={17} /> : <Plus size={17} />}{' '}
            {editing ? 'Lưu thay đổi' : 'Thêm đơn vị'}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setPreviewUrl(null);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 font-bold dark:border-zinc-700"
            >
              <X size={17} /> Hủy sửa
            </button>
          ) : null}
        </div>
      </form>
      {mutation.isError ? (
        <p role="alert" className="mt-3 text-sm font-bold text-coral-600">
          {getApiErrorMessage(mutation.error, 'Không thể cập nhật đơn vị đồng hành.')}
        </p>
      ) : null}
      <div className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {partners.length ? (
          partners.map((partner) => (
            <div key={partner.id} className="flex flex-wrap items-center gap-4 py-4">
              <img src={partner.logoUrl} alt="" className="size-14 shrink-0 object-contain" />
              <div className="min-w-0 flex-1">
                <strong className="block break-words">{partner.name}</strong>
                <p className="mt-1 text-xs text-zinc-500">
                  Thứ tự {partner.sortOrder} · {partner.active ? 'Đang hiển thị' : 'Đang ẩn'}
                </p>
              </div>
              <button
                type="button"
                title="Sửa"
                onClick={() => {
                  setEditing(partner);
                  setPreviewUrl(null);
                }}
                className="grid size-11 place-items-center rounded-md border border-zinc-300 dark:border-zinc-700"
              >
                <Pencil size={17} />
                <span className="sr-only">Sửa {partner.name}</span>
              </button>
              <button
                type="button"
                title="Xóa"
                onClick={() => mutation.mutate(() => deleteEventPartner(partner.id, csrfToken))}
                className="grid size-11 place-items-center rounded-md border border-coral-500 text-coral-600"
              >
                <Trash2 size={17} />
                <span className="sr-only">Xóa {partner.name}</span>
              </button>
            </div>
          ))
        ) : (
          <p className="py-6 text-sm text-zinc-500">Chưa có đơn vị đồng hành.</p>
        )}
      </div>
    </section>
  );
}

export function AdminPage() {
  const authQuery = useAuth();
  const isAdmin =
    authQuery.data?.user?.roles.some((role) => role === 'admin' || role === 'super_admin') ?? false;
  const dashboardQuery = useAdminDashboard(isAdmin);
  const dashboard = dashboardQuery.data;

  if (authQuery.isPending || (isAdmin && dashboardQuery.isPending)) {
    return <div className="mx-auto min-h-[70dvh] max-w-7xl animate-pulse px-4 py-12" />;
  }
  if (!authQuery.data?.authenticated) {
    return (
      <section className="mx-auto min-h-[60dvh] max-w-5xl px-4 py-16">
        <LockKeyhole className="text-coral-600" size={28} strokeWidth={1.8} />
        <h1 className="mt-5 text-3xl font-black">Đăng nhập quản trị</h1>
        <a
          href={getGoogleLoginUrl('/admin')}
          className="mt-7 inline-flex h-12 items-center rounded-md bg-coral-600 px-5 font-bold text-white"
        >
          Đăng nhập Google
        </a>
      </section>
    );
  }
  if (!isAdmin) {
    return (
      <section className="mx-auto min-h-[60dvh] max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-black">Không có quyền truy cập</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-300">
          Tài khoản Google này chưa có quyền quản trị.
        </p>
      </section>
    );
  }
  if (!dashboard || dashboardQuery.isError) {
    return (
      <section className="mx-auto min-h-[60dvh] max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-black">Không tải được trang quản trị</h1>
      </section>
    );
  }

  const metrics = [
    ['Vé còn lại', dashboard.settings.remainingQuantity.toLocaleString('vi-VN')],
    ['Đang giữ', dashboard.summary.reservedTickets.toLocaleString('vi-VN')],
    ['Đã bán', dashboard.summary.soldTickets.toLocaleString('vi-VN')],
    ['Doanh thu ròng', currency.format(dashboard.summary.netRevenueVnd)],
  ];

  return (
    <section className="bg-zinc-50 py-10 dark:bg-zinc-950 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300"
        >
          <ArrowLeft aria-hidden="true" size={17} strokeWidth={1.8} /> Trang bán vé
        </Link>
        <div className="mt-7 flex items-start gap-4">
          <ShieldCheck className="mt-1 shrink-0 text-coral-600" size={30} strokeWidth={1.8} />
          <div>
            <h1 className="text-3xl font-black sm:text-4xl">Quản trị Gala</h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-300">
              Cấu hình bán vé và theo dõi tồn kho.
            </p>
          </div>
        </div>
        <div className="mt-9 grid overflow-hidden rounded-md border border-zinc-200 min-[360px]:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800">
          {metrics.map(([label, value]) => (
            <div
              key={label}
              className="min-w-0 border-b border-zinc-200 bg-white p-4 last:border-b-0 min-[360px]:[&:nth-child(odd)]:border-r sm:p-5 lg:border-b-0 lg:border-r lg:last:border-r-0 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
              <p className="mt-2 break-words text-lg font-black tabular-nums sm:text-xl">{value}</p>
            </div>
          ))}
        </div>
        <EventSettingsForm dashboard={dashboard} csrfToken={authQuery.data.csrfToken} />
        <PartnerManager partners={dashboard.partners} csrfToken={authQuery.data.csrfToken} />
      </div>
    </section>
  );
}
