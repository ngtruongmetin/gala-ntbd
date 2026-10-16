const service = require('./service');
const repository = require('./repository');

async function getPublicSettings(request, response) {
  const settings = await service.getPublicEventSettings();

  if (!settings) {
    response.status(404).json({
      error: {
        code: 'EVENT_NOT_CONFIGURED',
        message: 'Sự kiện chưa được cấu hình.',
      },
    });
    return;
  }

  response.json({ data: settings });
}

async function getPartnerLogo(request, response) {
  const logo = await repository.getPartnerLogo(request.params.id);
  if (!logo) {
    response
      .status(404)
      .json({ error: { code: 'LOGO_NOT_FOUND', message: 'Không tìm thấy logo.' } });
    return;
  }
  response.set('Content-Type', logo.logo_mime);
  response.set('Cache-Control', 'public, max-age=86400');
  response.send(logo.logo_data);
}

module.exports = { getPublicSettings, getPartnerLogo };
