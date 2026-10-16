const { z } = require('zod');

const scanSchema = z
  .object({
    requestId: z.string().uuid(),
    qrToken: z.string().min(20).max(2048),
    source: z.enum(['camera', 'usb']),
  })
  .strict();

const scanPreviewSchema = scanSchema.omit({ requestId: true });

const manualCheckInSchema = z
  .object({
    requestId: z.string().uuid(),
    ticketCode: z.string().trim().toUpperCase().min(3).max(64),
  })
  .strict();

const manualPreviewSchema = manualCheckInSchema.omit({ requestId: true });

const undoSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

module.exports = {
  scanSchema,
  scanPreviewSchema,
  manualCheckInSchema,
  manualPreviewSchema,
  undoSchema,
};
