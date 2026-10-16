const { env } = require('../config/env');

function notFoundHandler(request, response) {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Không tìm thấy ${request.method} ${request.originalUrl}.`,
    },
  });
}

function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  request.log.error({ err: error }, 'Request failed');

  response.status(error.statusCode ?? 500).json({
    error: {
      code: error.code ?? 'INTERNAL_ERROR',
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.',
      ...(error.details ? { details: error.details } : {}),
      ...(env.isProduction ? {} : { debugMessage: error.message }),
    },
  });
}

module.exports = { notFoundHandler, errorHandler };
