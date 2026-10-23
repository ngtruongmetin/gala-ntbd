import type { OrderStatus, TicketStatus } from '../types/order';

const labels: Record<OrderStatus | TicketStatus | string, string> = {
  pending_payment: 'Chờ thanh toán',
  payment_review: 'Cần đối soát',
  paid: 'Đã xác nhận',
  refund_pending: 'Chờ hoàn tiền',
  refunded: 'Đã hoàn tiền',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
  valid: 'Còn hiệu lực',
  checked_in: 'Đã soát vé',
  void: 'Đã thu hồi',
  matched: 'Đã khớp',
  amount_mismatch: 'Sai số tiền',
  late: 'Đến muộn',
  ignored: 'Đã bỏ qua',
  success: 'Thành công',
  already_checked_in: 'Đã sử dụng',
  invalid: 'Không hợp lệ',
  revoked: 'Đã thu hồi',
  unpaid: 'Chưa thanh toán',
};

export function StatusBadge({ status }: { status: string }) {
  const alert = [
    'payment_review',
    'refund_pending',
    'void',
    'invalid',
    'revoked',
    'amount_mismatch',
  ];
  const positive = ['paid', 'valid', 'success', 'matched'];
  const className = alert.includes(status)
    ? 'border-red-500/30 bg-red-500/10 text-red-700'
    : positive.includes(status)
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
      : 'border-zinc-300 bg-zinc-100 text-zinc-700';
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${className}`}>
      {labels[status] ?? status}
    </span>
  );
}
