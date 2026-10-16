const { ZodError } = require('zod');
const { createOrderSchema, orderReferenceSchema } = require('./validation');
const service = require('./service');
const { AppError } = require('../../utils/app-error');

async function create(request, response) {
  let input;
  try {
    input = createOrderSchema.parse(request.body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(
        422,
        'VALIDATION_ERROR',
        'Thông tin đặt vé không hợp lệ.',
        error.flatten(),
      );
    }
    throw error;
  }

  const order = await service.createOrder({ user: request.session.user, input });
  response.status(201).json({ data: order });
}

async function getByReference(request, response) {
  const reference = orderReferenceSchema.safeParse(request.params.reference);
  if (!reference.success) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
  }
  const order = await service.getOrder(reference.data, request.session.user);
  response.json({ data: order });
}

async function getPaymentInstructions(request, response) {
  const reference = orderReferenceSchema.safeParse(request.params.reference);
  if (!reference.success) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Khong tim thay don hang.');
  }
  const data = await service.getPaymentInstructions(reference.data, request.session.user);
  response.json({ data });
}

module.exports = { create, getByReference, getPaymentInstructions };
