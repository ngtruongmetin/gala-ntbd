const { z } = require('zod');

const createStaffGrantSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .transform((email) => email.toLowerCase()),
    role: z.enum(['admin', 'check_in']),
  })
  .strict();

const deleteStaffGrantSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

module.exports = { createStaffGrantSchema, deleteStaffGrantSchema };
