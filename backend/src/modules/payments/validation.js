const { z } = require('zod');

const manualTransactionSchema = z
  .object({
    transactionReference: z.string().trim().min(3).max(160),
    amountVnd: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    occurredAt: z.string().datetime({ offset: true }),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

const paymentReviewSchema = z
  .object({
    transactionId: z.string().uuid(),
    decision: z.enum(['accept', 'ignore']),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

module.exports = { manualTransactionSchema, paymentReviewSchema, reasonSchema };
