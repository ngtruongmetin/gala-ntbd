export type OrderStatus =
  | 'pending_payment'
  | 'payment_review'
  | 'paid'
  | 'refund_pending'
  | 'refunded'
  | 'expired'
  | 'cancelled';

export interface Order {
  reference: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  quantity: number;
  unitPriceVnd: number;
  totalAmountVnd: number;
  status: OrderStatus;
  reservationExpiresAt: string;
  createdAt: string;
  updatedAt: string;
  reservationState?: 'active' | 'review_hold' | 'consumed' | 'released';
  ticketCount?: number;
  events?: Array<{
    action: string;
    from_status: string | null;
    to_status: string | null;
    reason: string | null;
    created_at: string;
  }>;
  transactions?: PaymentTransaction[];
  tickets?: Ticket[];
}

export interface PaymentTransaction {
  id: string;
  provider: string;
  reference: string;
  direction: 'credit' | 'debit';
  amountVnd: number;
  matchStatus: 'matched' | 'unmatched' | 'amount_mismatch' | 'late' | 'ignored';
  occurredAt: string;
  notes: string | null;
  createdAt: string;
}

export type TicketStatus = 'valid' | 'checked_in' | 'void' | 'refunded';

export interface Ticket {
  code: string;
  orderReference: string;
  sequenceNumber: number;
  status: TicketStatus;
  buyerName: string;
  buyerEmail: string;
  eventName: string;
  eventStartsAt: string;
  venue: string;
  issuedAt: string;
  checkedInAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  refundedAt: string | null;
  qrPayload: string | null;
  events?: Array<{
    action: string;
    from_status: string | null;
    to_status: string | null;
    reason: string | null;
    created_at: string;
  }>;
}

export interface OrderResponse {
  data: Order;
}

export interface CreateOrderInput {
  fullName: string;
  phone: string;
  quantity: number;
}

export interface PaymentInstructions {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amountVnd: number;
  transferContent: string;
  expiresAt: string;
  qrCode: string;
}
