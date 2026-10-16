const express = require('express');
const controller = require('./controller');

const webhooksRouter = express.Router();
webhooksRouter.post('/pay2s', controller.pay2s);

module.exports = { webhooksRouter };
