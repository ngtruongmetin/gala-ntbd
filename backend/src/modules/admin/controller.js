const { ZodError } = require('zod');
const { updateEventSettingsSchema, partnerSchema, partnerIdSchema } = require('./validation');
const service = require('./service');
const { AppError } = require('../../utils/app-error');

async function getDashboard(request, response) {
  const dashboard = await service.getDashboard();
  response.json({ data: dashboard });
}

async function updateEventSettings(request, response) {
  let input;
  try {
    input = updateEventSettingsSchema.parse(request.body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(
        422,
        'VALIDATION_ERROR',
        'Cấu hình sự kiện không hợp lệ.',
        error.flatten(),
      );
    }
    throw error;
  }

  const settings = await service.updateEventSettings(input, request.session.user);
  response.json({ data: settings });
}

function parsePartner(request) {
  try {
    return {
      ...partnerSchema.parse(request.body),
      logoData: request.file?.buffer ?? null,
      logoMime: request.file?.mimetype ?? null,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(
        422,
        'VALIDATION_ERROR',
        'Thông tin đơn vị đồng hành không hợp lệ.',
        error.flatten(),
      );
    }
    throw error;
  }
}

async function createPartner(request, response) {
  const input = parsePartner(request);
  if (!input.logoData && !input.logoUrl) {
    throw new AppError(422, 'LOGO_REQUIRED', 'Vui lòng chọn file logo.');
  }
  const partner = await service.createPartner(input, request.session.user);
  response.status(201).json({ data: partner });
}

async function updatePartner(request, response) {
  const id = partnerIdSchema.parse(request.params.id);
  const partner = await service.updatePartner(id, parsePartner(request), request.session.user);
  response.json({ data: partner });
}

async function deletePartner(request, response) {
  const id = partnerIdSchema.parse(request.params.id);
  response.json({ data: await service.deletePartner(id, request.session.user) });
}

module.exports = { getDashboard, updateEventSettings, createPartner, updatePartner, deletePartner };
