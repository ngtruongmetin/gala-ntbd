const { z } = require('zod');

function normalizeFullName(value) {
  return value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('vi-VN');
}

function normalizePhone(value) {
  return value.trim().replace(/[\s().-]/g, '');
}

const createOrderSchema = z
  .object({
    fullName: z.string().transform(normalizeFullName),
    phone: z.string().transform(normalizePhone),
    quantity: z.coerce.number().int().positive(),
  })
  .strict()
  .superRefine((data, context) => {
    if (
      data.fullName.length < 2 ||
      data.fullName.length > 120 ||
      !/^[\p{L}][\p{L}\p{M}' -]*[\p{L}\p{M}]$/u.test(data.fullName)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fullName'],
        message: 'Họ và tên không hợp lệ.',
      });
    }

    if (!/^(?:\+84|0)\d{9}$/.test(data.phone)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'Số điện thoại Việt Nam không hợp lệ.',
      });
    }
  });

const orderReferenceSchema = z.string().regex(/^GALA-[A-F0-9]{16}$/);

module.exports = { createOrderSchema, orderReferenceSchema, normalizeFullName, normalizePhone };
