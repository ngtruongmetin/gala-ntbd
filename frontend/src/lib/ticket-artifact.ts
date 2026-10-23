import QRCode from 'qrcode';
import type { Ticket } from '../types/order';

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', reject, { once: true });
    image.src = source;
  });
}

export function ticketFilename(ticket: Ticket) {
  return `${ticket.orderReference}-ve-${ticket.sequenceNumber}-${ticket.code}`;
}

export async function createTicketCanvas(ticket: Ticket) {
  if (!ticket.qrPayload) throw new Error('Ticket QR is unavailable');

  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');

  const [backgroundImage, qrImage] = await Promise.all([
    loadImage('/images/mauve.png'),
    QRCode.toDataURL(ticket.qrPayload, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: 'Q',
    }).then(loadImage),
  ]);

  context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

  const qrSize = 420;
  const qrCardSize = qrSize + 48;
  const qrX = (canvas.width - qrSize) / 2;
  const qrY = 786;
  const qrCardX = (canvas.width - qrCardSize) / 2;
  const qrCardY = qrY - 24;

  context.fillStyle = '#ffffff';
  context.beginPath();
  context.roundRect(qrCardX, qrCardY, qrCardSize, qrCardSize, 10);
  context.fill();
  context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  context.textAlign = 'center';
  context.fillStyle = '#ffffff';
  context.font = '700 40px Arial, sans-serif';
  context.fillText(ticket.code, canvas.width / 2, 1284);
  context.font = '26px Arial, sans-serif';
  context.fillText(
    `V\u00e9 ${ticket.sequenceNumber} \u00b7 \u0110\u01a1n ${ticket.orderReference}`,
    canvas.width / 2,
    1328,
  );
  context.font = '700 28px Arial, sans-serif';
  context.fillText(
    `NG\u01af\u1edcI MUA: ${ticket.buyerName.toLocaleUpperCase('vi-VN')}`,
    canvas.width / 2,
    1378,
  );
  context.font = '24px Arial, sans-serif';
  context.fillText(
    'Vui l\u00f2ng xu\u1ea5t tr\u00ecnh m\u00e3 QR n\u00e0y t\u1ea1i c\u1ed5ng \u0111\u1ec3 v\u00e0o \u0111\u00eam Gala.',
    canvas.width / 2,
    1424,
  );

  return canvas;
}

function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

export async function downloadTicketPng(ticket: Ticket) {
  const canvas = await createTicketCanvas(ticket);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG export failed');
  const url = URL.createObjectURL(blob);
  downloadUrl(url, `${ticketFilename(ticket)}.png`);
  URL.revokeObjectURL(url);
}

export async function downloadTicketPdf(ticket: Ticket) {
  const canvas = await createTicketCanvas(ticket);
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [1240, 1754] });
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 1240, 1754, undefined, 'FAST');
  pdf.save(`${ticketFilename(ticket)}.pdf`);
}
