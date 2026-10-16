const orderEventLabels: Record<string, string> = {
  created: 'Đã tạo đơn hàng',
  issued_without_payment: 'Đơn hàng đã được xác nhận',
  payment_confirmed: 'Đã xác nhận thanh toán',
  payment_review_required: 'Giao dịch đang được kiểm tra',
  cancelled_by_buyer: 'Bạn đã hủy đơn hàng',
  cancelled_by_admin: 'Ban tổ chức đã hủy đơn hàng',
  reservation_expired: 'Đơn hàng đã hết thời gian giữ vé',
  refund_requested: 'Đã tiếp nhận yêu cầu hoàn tiền',
  refund_confirmed: 'Đã hoàn tiền',
};

const ticketEventLabels: Record<string, string> = {
  issued: 'Vé đã được phát hành',
  checked_in: 'Đã soát vé bằng mã QR',
  checked_in_manual: 'Đã soát vé bằng mã vé',
  checkin_undone: 'Đã hoàn tác soát vé',
  qr_reissued: 'Mã QR đã được cấp lại',
  voided: 'Vé đã được thu hồi',
  reactivated: 'Vé đã được kích hoạt lại',
  refund_requested: 'Vé đang chờ hoàn tiền',
  refunded: 'Vé đã được hoàn tiền',
};

export function getOrderEventLabel(action: string) {
  return orderEventLabels[action] ?? 'Cập nhật đơn hàng';
}

export function getTicketEventLabel(action: string) {
  return ticketEventLabels[action] ?? 'Cập nhật vé';
}
