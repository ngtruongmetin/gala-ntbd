const { z } = require('zod');

const updateEventSettingsSchema = z
  .object({
    eventName: z.string().trim().min(3).max(160),
    eventSubtitle: z.string().trim().min(3).max(200),
    venue: z.string().trim().min(3).max(200),
    eventStartsAt: z.string().datetime({ offset: true }),
    ticketPriceVnd: z.number().int().positive().max(1_000_000_000),
    totalCapacity: z.number().int().positive().max(1_000_000),
    minTicketsPerOrder: z.number().int().positive(),
    maxTicketsPerOrder: z.number().int().positive(),
    salesStartAt: z.string().datetime({ offset: true }),
    salesEndAt: z.string().datetime({ offset: true }),
    reservationMinutes: z.number().int().min(1).max(1440),
    salesStatus: z.enum(['open', 'paused']),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.maxTicketsPerOrder < data.minTicketsPerOrder) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxTicketsPerOrder'],
        message: 'Giới hạn tối đa phải lớn hơn hoặc bằng tối thiểu.',
      });
    }
    if (data.maxTicketsPerOrder > data.totalCapacity) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxTicketsPerOrder'],
        message: 'Giới hạn mỗi đơn không được vượt tổng số vé.',
      });
    }
    if (new Date(data.salesEndAt) <= new Date(data.salesStartAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['salesEndAt'],
        message: 'Thời gian kết thúc bán phải sau thời gian bắt đầu.',
      });
    }
  });

const partnerSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    logoUrl: z.string().trim().max(500).optional(),
    websiteUrl: z.union([z.string().trim().url().max(500), z.literal('')]).optional(),
    sortOrder: z.coerce.number().int().min(0).max(10000),
    active: z.preprocess(
      (value) => value === true || value === 'true' || value === 'on',
      z.boolean(),
    ),
  })
  .strict();

const partnerIdSchema = z.string().uuid();

module.exports = { updateEventSettingsSchema, partnerSchema, partnerIdSchema };
