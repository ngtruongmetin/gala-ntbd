import { ArrowLeft, CircleCheck, Clock3, Copy, ReceiptText, RefreshCw, Ticket } from 'lucide-react';
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

function copyToClipboard(value: string) {
  return navigator.clipboard.writeText(value);
}

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

function PaymentPanel({ reference }: { reference: string }) {
  const payment = usePaymentInstructions(reference, true);
  const countdown = useCountdown(payment.data?.expiresAt);
  const [qrImage, setQrImage] = useState('');

  useEffect(() => {
    if (!payment.data?.qrCode) return;
    QRCode.toDataURL(payment.data.qrCode, { width: 320, margin: 2, errorCorrectionLevel: 'M' })
      .then(setQrImage)
      .catch(() => setQrImage(''));
  }, [payment.data?.qrCode]);

  if (payment.isPending)
    return <div className="mt-10 h-80 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />;
  if (payment.isError || !payment.data) {
    return (
      <div className="mt-10 border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
        <p className="font-bold">Chưa tạo được mã QR thanh toán.</p>
        <button
          type="button"
          onClick={() => payment.refetch()}
          className="mt-4 inline-flex items-center gap-2 font-bold text-coral-600"
        >
          <RefreshCw size={17} /> Thử lại
        </button>
      </div>
    );
  }

  const data = payment.data;
  return (
    <div className="mt-10 grid gap-8 border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8 lg:grid-cols-[320px_1fr]">
      <div className="mx-auto w-full max-w-80">
        {qrImage ? (
          <img
            src={qrImage}
            alt="Mã QR chuyển khoản thanh toán vé"
            className="aspect-square w-full"
          />
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-coral-600 dark:text-coral-400">
          <Clock3 size={19} />
          <span className="font-bold">Còn {countdown} để thanh toán</span>
        </div>
        <dl className="mt-6 grid gap-5">
          <div>
            <dt className="text-sm text-zinc-500">Ngân hàng</dt>
            <dd className="mt-1 font-bold">{data.bankCode}</dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Chủ tài khoản</dt>
            <dd className="mt-1 font-bold">{data.accountName}</dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Số tài khoản</dt>
            <dd className="mt-1 flex items-center justify-between gap-3 font-bold">
              <span className="break-all">{data.accountNumber}</span>
              <button
                type="button"
                title="Sao chép số tài khoản"
                onClick={() => copyToClipboard(data.accountNumber)}
              >
                <Copy size={18} />
                <span className="sr-only">Sao chép số tài khoản</span>
              </button>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Số tiền</dt>
            <dd className="mt-1 text-2xl font-black">{currency.format(data.amountVnd)}</dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Nội dung chuyển khoản</dt>
            <dd className="mt-1 flex items-center justify-between gap-3 font-black text-coral-600">
              <span className="break-all">{data.transferContent}</span>
              <button
                type="button"
                title="Sao chép nội dung"
                onClick={() => copyToClipboard(data.transferContent)}
              >
                <Copy size={18} />
                <span className="sr-only">Sao chép nội dung</span>
              </button>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export function OrderConfirmationPage() {
  const { reference = '' } = useParams();
  const authQuery = useAuth();
  const orderQuery = useOrder(reference, Boolean(authQuery.data?.authenticated));
  const order = orderQuery.data;

  if (authQuery.isPending || (authQuery.data?.authenticated && orderQuery.isPending))
    return <div className="min-h-[60dvh] animate-pulse" />;
  if (!authQuery.data?.authenticated || orderQuery.isError || !order) {
    return (
      <section className="mx-auto min-h-[60dvh] max-w-4xl px-4 py-16">
        <h1 className="text-3xl font-black">Không thể mở đơn hàng</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-300">
          Hãy đăng nhập đúng tài khoản đã tạo đơn.
        </p>
        <Link to="/" className="mt-7 inline-flex font-bold text-coral-600">
          Về trang sự kiện
        </Link>
      </section>
    );
  }

  const paid = ['paid', 'refund_pending', 'refunded'].includes(order.status);
  const review = order.status === 'payment_review';
  const closed = ['expired', 'cancelled'].includes(order.status);
  return (
    <section className="bg-zinc-50 py-12 dark:bg-zinc-950 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300"
        >
          <ArrowLeft size={17} /> Trang sự kiện
        </Link>
        <div className="mt-8 border-l-4 border-coral-600 pl-6">
          <p className="flex items-center gap-2 text-sm font-bold text-coral-600">
            <ReceiptText size={18} /> MÃ ĐƠN {order.reference}
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            {paid
              ? 'Vé đã được phát hành'
              : review
                ? 'Đang đối soát thanh toán'
                : closed
                  ? 'Đơn hàng đã hết hiệu lực'
                  : 'Thanh toán để nhận vé'}
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-zinc-600 dark:text-zinc-300">
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
          <div className="mt-10 border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
            <CircleCheck className="text-emerald-600" size={26} />
            <Link
              to="/tai-khoan"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-coral-600 px-5 text-sm font-bold text-white"
            >
              <Ticket size={18} /> Mở vé và QR
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
