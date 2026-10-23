import {
  ArrowLeft,
  Check,
  CircleCheck,
  Clock3,
  Copy,
  CreditCard,
  Landmark,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/use-auth';
import { useOrder, usePaymentInstructions } from '../features/orders/use-order';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

function useCountdown(expiresAt?: string) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const seconds = Math.ceil(remaining / 1_000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function CopyButton({
  value,
  label,
  onCopied,
}: {
  value: string;
  label: string;
  onCopied: () => void;
}) {
  const [isCopied, setIsCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      onCopied();
      window.setTimeout(() => setIsCopied(false), 1_800);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <button
      type="button"
      title={`Sao chép ${label}`}
      aria-label={`Sao chép ${label}`}
      onClick={() => void copy()}
      className={`grid size-10 shrink-0 place-items-center rounded-md border transition active:scale-95 ${
        isCopied
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-zinc-200 bg-white text-zinc-500 hover:border-brand-magenta-300 hover:text-brand-magenta-600'
      }`}
    >
      {isCopied ? <Check size={18} strokeWidth={2.4} /> : <Copy size={17} strokeWidth={1.9} />}
    </button>
  );
}

function PaymentPanel({ reference }: { reference: string }) {
  const payment = usePaymentInstructions(reference, true);
  const countdown = useCountdown(payment.data?.expiresAt);
  const [qrImage, setQrImage] = useState('');
  const [copiedLabel, setCopiedLabel] = useState('');

  useEffect(() => {
    if (!payment.data?.qrCode) return;
    QRCode.toDataURL(payment.data.qrCode, { width: 640, margin: 2, errorCorrectionLevel: 'M' })
      .then(setQrImage)
      .catch(() => setQrImage(''));
  }, [payment.data?.qrCode]);

  if (payment.isPending) {
    return (
      <div className="mt-10 grid animate-pulse overflow-hidden border border-zinc-200 bg-white lg:grid-cols-[minmax(20rem,0.9fr)_1.1fr]">
        <div className="min-h-[25rem] bg-zinc-200" />
        <div className="space-y-5 p-6 sm:p-9">
          <div className="h-8 w-3/5 bg-zinc-200" />
          <div className="h-20 bg-zinc-100" />
          <div className="h-16 bg-zinc-100" />
          <div className="h-16 bg-zinc-100" />
        </div>
      </div>
    );
  }

  if (payment.isError || !payment.data) {
    return (
      <div className="mt-10 border border-red-200 bg-red-50 p-6">
        <p className="font-bold">Chưa tạo được mã QR thanh toán.</p>
        <button
          type="button"
          onClick={() => payment.refetch()}
          className="mt-4 inline-flex items-center gap-2 font-bold text-brand-magenta-600"
        >
          <RefreshCw size={17} /> Thử lại
        </button>
      </div>
    );
  }

  const data = payment.data;
  return (
    <div className="mt-10 overflow-hidden border border-zinc-200 bg-white shadow-[0_30px_75px_-52px_rgba(24,24,27,0.65)]">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-brand-magenta-600 text-white">
            <CreditCard size={18} strokeWidth={1.9} />
          </span>
          <div>
            <p className="font-bold text-zinc-950">Quét mã QR để thanh toán</p>
            <p className="mt-0.5 text-sm text-zinc-500">
              Đơn được giữ cho bạn trong thời gian còn lại
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-l-2 border-brand-magenta-500 pl-3 text-zinc-950">
          <Clock3 className="text-brand-magenta-600" size={19} strokeWidth={2} />
          <div>
            <p className="text-xs font-semibold text-zinc-500">
              Thời gian giữ vé
            </p>
            <p className="font-mono text-xl font-black leading-none tabular-nums">{countdown}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(21rem,0.88fr)_1.12fr]">
        <section className="flex min-h-[27rem] flex-col items-center justify-center bg-zinc-950 px-6 py-9 text-white sm:px-10">
          <p className="text-sm font-semibold text-zinc-300">Mã thanh toán</p>
          {qrImage ? (
            <div className="mt-5 w-full max-w-[20rem] bg-white p-3 shadow-[0_18px_40px_rgba(0,0,0,0.28)] sm:p-4">
              <img
                src={qrImage}
                alt="Mã QR chuyển khoản thanh toán vé"
                className="aspect-square w-full"
              />
            </div>
          ) : (
            <div className="mt-5 aspect-square w-full max-w-[20rem] animate-pulse bg-zinc-800" />
          )}
          <p className="mt-5 max-w-[26rem] text-center text-sm leading-relaxed text-zinc-300">
            Mở ứng dụng ngân hàng và quét mã để điền chính xác thông tin giao dịch.
          </p>
        </section>

        <section className="min-w-0 px-5 py-7 sm:px-8 sm:py-9">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-500">
                Số tiền cần chuyển
              </p>
              <p className="mt-1 text-3xl font-black tabular-nums text-zinc-950 sm:text-4xl">
                {currency.format(data.amountVnd)}
              </p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700">
              <ShieldCheck size={21} strokeWidth={1.9} />
              <span className="sr-only">Đối soát tự động</span>
            </span>
          </div>

          <dl className="mt-8 border-t border-zinc-200">
            <div className="grid gap-1 border-b border-zinc-200 py-4 sm:grid-cols-[9.5rem_1fr] sm:items-center">
              <dt className="text-sm text-zinc-500">Ngân hàng</dt>
              <dd className="flex items-center gap-2 font-bold">
                <Landmark size={17} className="text-brand-magenta-600" />
                {data.bankCode}
              </dd>
            </div>
            <div className="grid gap-1 border-b border-zinc-200 py-4 sm:grid-cols-[9.5rem_1fr] sm:items-center">
              <dt className="text-sm text-zinc-500">Chủ tài khoản</dt>
              <dd className="font-bold">{data.accountName}</dd>
            </div>
            <div className="grid gap-2 border-b border-zinc-200 py-4 sm:grid-cols-[9.5rem_1fr] sm:items-center">
              <dt className="text-sm text-zinc-500">Số tài khoản</dt>
              <dd className="flex min-w-0 items-center justify-between gap-3 font-mono text-lg font-black tabular-nums">
                <span className="break-all">{data.accountNumber}</span>
                <CopyButton
                  value={data.accountNumber}
                  label="số tài khoản"
                  onCopied={() => setCopiedLabel('Số tài khoản')}
                />
              </dd>
            </div>
            <div className="grid gap-2 border-b border-zinc-200 py-4 sm:grid-cols-[9.5rem_1fr] sm:items-center">
              <dt className="text-sm text-zinc-500">Nội dung chuyển khoản</dt>
              <dd className="flex min-w-0 items-center justify-between gap-3 font-mono text-base font-black text-brand-magenta-600">
                <span className="break-all">{data.transferContent}</span>
                <CopyButton
                  value={data.transferContent}
                  label="nội dung chuyển khoản"
                  onCopied={() => setCopiedLabel('Nội dung chuyển khoản')}
                />
              </dd>
            </div>
          </dl>

          <p
            className="mt-5 min-h-5 text-sm font-semibold text-emerald-700"
            aria-live="polite"
          >
            {copiedLabel ? `Đã sao chép ${copiedLabel.toLocaleLowerCase('vi-VN')}.` : ''}
          </p>
        </section>
      </div>
    </div>
  );
}

export function OrderConfirmationPage() {
  const { reference = '' } = useParams();
  const authQuery = useAuth();
  const orderQuery = useOrder(reference, Boolean(authQuery.data?.authenticated));
  const order = orderQuery.data;

  if (authQuery.isPending || (authQuery.data?.authenticated && orderQuery.isPending)) {
    return <div className="min-h-[60dvh] animate-pulse" />;
  }

  if (!authQuery.data?.authenticated || orderQuery.isError || !order) {
    return (
      <section className="mx-auto min-h-[60dvh] max-w-4xl px-4 py-16">
        <h1 className="text-3xl font-black">Không thể mở đơn hàng</h1>
        <p className="mt-4 text-zinc-600">
          Hãy đăng nhập đúng tài khoản đã tạo đơn.
        </p>
        <Link to="/" className="mt-7 inline-flex font-bold text-brand-magenta-600">
          Về trang sự kiện
        </Link>
      </section>
    );
  }

  const paid = ['paid', 'refund_pending', 'refunded'].includes(order.status);
  const review = order.status === 'payment_review';
  const closed = ['expired', 'cancelled'].includes(order.status);

  return (
    <section className="bg-zinc-100/70 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600"
        >
          <ArrowLeft size={17} /> Trang sự kiện
        </Link>
        <div className="mt-8 border-l-4 border-brand-magenta-600 pl-5 sm:pl-6">
          <p className="flex items-center gap-2 text-sm font-bold text-brand-magenta-600">
            <ReceiptText size={18} /> MÃ ĐƠN {order.reference}
          </p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-zinc-950 sm:text-4xl">
            {paid
              ? 'Vé đã được phát hành'
              : review
                ? 'Đang đối soát thanh toán'
                : closed
                  ? 'Đơn hàng đã hết hiệu lực'
                  : 'Thanh toán để nhận vé'}
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-zinc-600">
            {paid
              ? 'Thanh toán đã được xác nhận. Vé và mã QR soát vé đã có trong tài khoản của bạn.'
              : review
                ? 'Hệ thống đã nhận giao dịch và ban tổ chức đang kiểm tra. Bạn không cần chuyển khoản lại.'
                : closed
                  ? 'Đơn này đã hết hạn hoặc bị hủy và không còn giữ vé.'
                  : 'Quét QR bằng ứng dụng ngân hàng. Vé sẽ tự động xuất hiện sau khi giao dịch được xác nhận.'}
          </p>
        </div>
        {order.status === 'pending_payment' ? <PaymentPanel reference={reference} /> : null}
        {paid ? (
          <div className="mt-10 border border-emerald-200 bg-emerald-50 p-6">
            <CircleCheck className="text-emerald-600" size={26} />
            <Link
              to="/tai-khoan"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-brand-magenta-600 px-5 text-sm font-bold text-white"
            >
              <Ticket size={18} /> Mở vé và QR
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
