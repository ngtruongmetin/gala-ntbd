import type { TicketStatus } from './order';

export type CheckInResult =
  'success' | 'already_checked_in' | 'invalid' | 'revoked' | 'refunded' | 'unpaid' | 'undone';

export interface CheckInResponseData {
  result: CheckInResult;
  ticket: {
    code: string;
    buyerName: string;
    orderReference: string;
    status: TicketStatus;
    checkedInAt: string | null;
    eventName: string;
  } | null;
}
