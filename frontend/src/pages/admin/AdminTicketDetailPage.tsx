import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, QrCode, RotateCcw, ShieldX } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import {
  getAdminTicket,
  reactivateAdminTicket,
  reissueAdminTicketQr,
  voidAdminTicket,
} from '../../features/admin/api';
import { useAuth } from '../../features/auth/use-auth';
import { getApiErrorMessage } from '../../lib/api-error';

export function AdminTicketDetailPage() {
  const { code = '' } = useParams();
  const auth = useAuth().data;
  const queryClient = useQueryClient();
  const ticketQuery = useQuery({
    queryKey: ['admin', 'tickets', code],
    queryFn: () => getAdminTicket(code),
  });
  const action = useMutation({
    mutationFn: (task: () => Promise<unknown>) => task(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
  const ticket = ticketQuery.data;
  if (ticketQuery.isPending) return <div className="min-h-[50dvh] animate-pulse" />;
  if (!ticket) return <p>Không tìm thấy vé.</p>;
  const csrf = auth?.csrfToken ?? '';
  return (
    <section>
      <Link
        to="/admin/ve"
        className="inline-flex items-center gap-2 text-sm font-bold text-zinc-600"
      >
        <ArrowLeft size={17} /> Danh sách vé
      </Link>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Mã vé</p>
          <h1 className="mt-1 break-all text-2xl font-black sm:text-3xl">{ticket.code}</h1>
        </div>
        <StatusBadge status={ticket.status} />
      </div>
      <dl className="mt-7 grid gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Đơn hàng', ticket.orderReference],
          ['Người mua', ticket.buyerName],
          ['Thứ tự vé', `#${ticket.sequenceNumber}`],
          [
            'Soát vé',
            ticket.checkedInAt
              ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
                  new Date(ticket.checkedInAt),
                )
              : 'Chưa sử dụng',
          ],
        ].map(([label, value]) => (
          <div key={label} className="bg-white p-5">
            <dt className="text-sm text-zinc-500">{label}</dt>
            <dd className="mt-2 break-words font-black">{value}</dd>
          </div>
        ))}
      </dl>
      {action.isError ? (
        <p className="mt-5 rounded-md bg-brand-magenta-500/10 p-4 font-bold text-brand-magenta-600">
          {getApiErrorMessage(action.error, 'Thao tác thất bại.')}
        </p>
      ) : null}
      <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
        {ticket.status === 'valid' ? (
          <>
            <button
              onClick={() =>
                action.mutate(() =>
                  reissueAdminTicketQr(code, 'Cấp lại mã QR theo yêu cầu quản trị viên', csrf),
                )
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-center font-bold"
            >
              <QrCode size={17} /> Cấp lại QR
            </button>
            <button
              onClick={() =>
                action.mutate(() => voidAdminTicket(code, 'Quản trị viên thu hồi vé', csrf))
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-brand-magenta-500 px-4 py-2 text-center font-bold text-brand-magenta-600"
            >
              <ShieldX size={17} /> Thu hồi vé
            </button>
          </>
        ) : null}
        {ticket.status === 'void' ? (
          <button
            onClick={() =>
              action.mutate(() =>
                reactivateAdminTicket(code, 'Quản trị viên kích hoạt lại vé', csrf),
              )
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand-magenta-600 px-4 py-2 text-center font-bold text-white"
          >
            <RotateCcw size={17} /> Kích hoạt lại và đổi QR
          </button>
        ) : null}
      </div>
      <section className="mt-10">
        <h2 className="text-lg font-black">Lịch sử vé</h2>
        <div className="mt-4 border-l border-zinc-300 pl-5">
          {ticket.events?.map((event, index) => (
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
