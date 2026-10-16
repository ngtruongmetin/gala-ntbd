import QRCode from 'qrcode';
import type { Ticket } from '../types/order';

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = next;
    }
  }
  context.fillText(line, x, currentY);
  return currentY;
}

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

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#e11d48';
  context.fillRect(0, 0, canvas.width, 32);
  context.fillStyle = '#18181b';
  context.font = '700 30px Arial, sans-serif';
  context.fillText('GALA SẮC MÀU TUỔI TRẺ', 100, 112);
  context.font = '700 60px Arial, sans-serif';
  const titleBottom = wrapText(context, ticket.eventName, 100, 220, 1040, 72);

  const eventTime = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(ticket.eventStartsAt));
  context.fillStyle = '#52525b';
  context.font = '28px Arial, sans-serif';
  const venueBottom = wrapText(context, ticket.venue, 100, titleBottom + 76, 1040, 40);
  context.fillText(eventTime, 100, venueBottom + 52);

  const qrData = await QRCode.toDataURL(ticket.qrPayload, {
    width: 720,
    margin: 4,
    errorCorrectionLevel: 'L',
  });
  const qrImage = await loadImage(qrData);
  const qrSize = 680;
  const qrX = (canvas.width - qrSize) / 2;
  const qrY = venueBottom + 110;
  context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  context.textAlign = 'center';
  context.fillStyle = '#18181b';
  context.font = '700 42px Arial, sans-serif';
  context.fillText(ticket.code, canvas.width / 2, qrY + qrSize + 68);
  context.fillStyle = '#52525b';
  context.font = '28px Arial, sans-serif';
  context.fillText(
    `Vé ${ticket.sequenceNumber} · Đơn ${ticket.orderReference}`,
    canvas.width / 2,
    qrY + qrSize + 116,
  );

  context.textAlign = 'left';
  context.fillStyle = '#71717a';
  context.font = '700 22px Arial, sans-serif';
  context.fillText('NGƯỜI MUA', 100, qrY + qrSize + 216);
  context.fillStyle = '#18181b';
  context.font = '700 34px Arial, sans-serif';
  context.fillText(ticket.buyerName, 100, qrY + qrSize + 262);
  context.fillStyle = '#71717a';
  context.font = '25px Arial, sans-serif';
  context.fillText('Đưa mã này cho nhân viên khi vào cổng.', 100, 1650);
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
