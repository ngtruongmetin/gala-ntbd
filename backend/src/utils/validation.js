const { ZodError } = require('zod');
const { AppError } = require('./app-error');

function parseInput(schema, input, message = 'Dữ liệu không hợp lệ.') {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(422, 'VALIDATION_ERROR', message, error.flatten());
    }
    throw error;
  }
}

module.exports = { parseInput };
