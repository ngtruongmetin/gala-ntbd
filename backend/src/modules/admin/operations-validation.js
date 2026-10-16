const { z } = require('zod');

const orderStatuses = [
  'pending_payment',
  'payment_review',
  'paid',
  'refund_pending',
  'refunded',
  'expired',
  'cancelled',
];

const listOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(orderStatuses).optional(),
  search: z.string().trim().max(120).optional(),
});

const listTicketsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['valid', 'checked_in', 'void', 'refunded']).optional(),
  search: z.string().trim().max(120).optional(),
});

module.exports = { listOrdersSchema, listTicketsSchema };
