const { z } = require('zod');

const pay2sTransactionSchema = z
  .object({
    id: z.union([z.string(), z.number().int()]).transform(String),
    gateway: z.string().min(1),
    transactionDate: z.string().min(1),
    transactionNumber: z.string().min(1),
    accountNumber: z.string().min(1),
    content: z.string(),
    transferType: z.enum(['IN', 'OUT']),
    transferAmount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    checksum: z.string().min(1),
    paymentCode: z.string().optional(),
  })
  .passthrough();

const pay2sWebhookSchema = z
  .object({ transactions: z.array(pay2sTransactionSchema).min(1).max(100) })
  .passthrough();

module.exports = { pay2sWebhookSchema };
