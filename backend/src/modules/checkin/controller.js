const service = require('./service');
const {
  scanSchema,
  scanPreviewSchema,
  manualCheckInSchema,
  manualPreviewSchema,
  undoSchema,
} = require('./validation');
const { parseInput } = require('../../utils/validation');

async function scan(request, response) {
  response.json({
    data: await service.scanTicket(parseInput(scanSchema, request.body), request.session.user),
  });
}

async function previewScan(request, response) {
  response.json({
    data: await service.previewQr(parseInput(scanPreviewSchema, request.body)),
  });
}

async function previewManual(request, response) {
  response.json({
    data: await service.previewManual(parseInput(manualPreviewSchema, request.body)),
  });
}

async function manual(request, response) {
  response.json({
    data: await service.manualCheckIn(
      parseInput(manualCheckInSchema, request.body),
      request.session.user,
    ),
  });
}

async function undo(request, response) {
  const input = parseInput(undoSchema, request.body);
  response.json({
    data: await service.undoCheckIn(request.params.ticketCode, input.reason, request.session.user),
  });
}

module.exports = { previewScan, previewManual, scan, manual, undo };
