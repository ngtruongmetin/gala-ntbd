const express = require('express');
const { getPublicSettings, getPartnerLogo } = require('./controller');

const eventSettingsRouter = express.Router();

eventSettingsRouter.get('/', getPublicSettings);
eventSettingsRouter.get('/partners/:id/logo', getPartnerLogo);

module.exports = { eventSettingsRouter };
