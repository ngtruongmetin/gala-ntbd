import { ChevronLeft, ChevronRight, Download, FileDown, LoaderCircle, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { getTicketEventLabel } from '../lib/event-labels';
import { downloadTicketPdf, downloadTicketPng } from '../lib/ticket-artifact';
import type { Ticket } from '../types/order';

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
});

function TicketSlide({ ticket }: { ticket: Ticket }) {
  const [qrImage, setQrImage] = useState('');
  useEffect(() => {
    if (!ticket.qrPayload) return setQrImage('');
    void QRCode.toDataURL(ticket.qrPayload, { width: 720, margin: 4, errorCorrectionLevel: 'L' })
      .then(setQrImage)
      .catch(() => setQrImage(''));
  }, [ticket.qrPayload]);

  return (
    <article className="h-full min-w-full snap-center overflow-y-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(4.5rem+env(safe-area-inset-top))] sm:px-8 sm:pb-28 sm:pt-20">
      <div className="mx-auto max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-500">Vé {ticket.sequenceNumber}</p>
            <h2 className="mt-1 text-2xl font-black">{ticket.code}</h2>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
        <div className="mx-auto mt-5 w-full max-w-[min(100%,52dvh)] bg-white p-3 shadow-[0_20px_60px_rgba(24,24,27,0.14)] sm:mt-6">
          {qrImage ? (
            <img src={qrImage} alt={`QR của vé ${ticket.code}`} className="aspect-square w-full" />
          ) : (
            <div className="grid aspect-square place-items-center px-8 text-center font-semibold text-zinc-500">
              QR không khả dụng với trạng thái hiện tại.
            </div>
          )}
        </div>
        <div className="mt-5 text-center">
          <p className="font-bold">Đơn {ticket.orderReference}</p>
          <p className="mt-1 text-sm text-zinc-500">{ticket.buyerName}</p>
        </div>
        {ticket.qrPayload ? (
          <div className="mt-6 grid gap-3 min-[360px]:grid-cols-2">
            <ExportButton
              label="Tải ảnh PNG"
              icon="image"
              action={() => downloadTicketPng(ticket)}
            />
            <ExportButton label="Tải PDF" icon="pdf" action={() => downloadTicketPdf(ticket)} />
          </div>
        ) : null}
        {ticket.events?.length ? (
          <section className="mt-9 border-t border-zinc-200 pt-6">
            <h3 className="font-black">Lịch sử vé</h3>
            <ol className="mt-4 space-y-4">
              {ticket.events.map((event, index) => (
                <li key={`${event.action}-${index}`} className="border-l-2 border-zinc-200 pl-4">
                  <p className="font-semibold">{getTicketEventLabel(event.action)}</p>
                  <time className="mt-1 block text-sm tabular-nums text-zinc-500">
                    {dateTime.format(new Date(event.created_at))}
                  </time>
                  {event.reason ? (
                    <p className="mt-1 text-sm text-zinc-600">{event.reason}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </article>
  );
}

function ExportButton({
  label,
  icon,
  action,
}: {
  label: string;
  icon: 'image' | 'pdf';
  action: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const Icon = icon === 'image' ? Download : FileDown;
  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        setError(false);
        void action()
          .catch(() => setError(true))
          .finally(() => setLoading(false));
      }}
      className="inline-flex min-h-12 items-center justify-center gap-2 border border-zinc-300 bg-white px-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-100 active:translate-y-px disabled:opacity-60"
    >
      {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Icon size={18} />}
      <span>{error ? 'Thử lại' : label}</span>
    </button>
  );
}

export function TicketQrViewer({
  tickets,
  initialIndex = 0,
  onClose,
}: {
  tickets: Ticket[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const indexRef = useRef(initialIndex);
  const closeRef = useRef(onClose);
  const [index, setIndex] = useState(initialIndex);
  const goTo = useCallback(
    (next: number, behavior: ScrollBehavior = 'smooth') => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const target = Math.max(0, Math.min(tickets.length - 1, next));
      viewport.scrollTo({ left: target * viewport.clientWidth, behavior });
    },
    [tickets.length],
  );

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => goTo(initialIndex, 'auto'));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'ArrowLeft') goTo(indexRef.current - 1);
      if (event.key === 'ArrowRight') goTo(indexRef.current + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [goTo, initialIndex]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mã QR vé"
      className="fixed inset-0 z-50 h-[100dvh] bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50"
    >
      <header className="safe-top absolute inset-x-0 top-0 z-10 flex min-h-16 items-center justify-between border-b border-zinc-200 bg-zinc-100/95 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <button
          type="button"
          onClick={onClose}
          title="Đóng"
          className="grid size-11 place-items-center"
        >
          <X size={22} />
          <span className="sr-only">Đóng</span>
        </button>
        <span className="text-sm font-bold tabular-nums">
          Vé {index + 1} / {tickets.length}
        </span>
        <span className="size-11" />
      </header>
      <div
        ref={viewportRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const next = Math.round(element.scrollLeft / element.clientWidth);
          indexRef.current = next;
          setIndex(next);
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStartRef.current;
          const touch = event.changedTouches[0];
          touchStartRef.current = null;
          if (!start || !touch) return;
          const deltaX = touch.clientX - start.x;
          const deltaY = touch.clientY - start.y;
          if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
            goTo(indexRef.current + (deltaX < 0 ? 1 : -1));
          }
        }}
        className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth"
      >
        {tickets.map((ticket) => (
          <TicketSlide key={ticket.code} ticket={ticket} />
        ))}
      </div>
      {tickets.length > 1 ? (
        <nav
          aria-label="Chuyển vé"
          className="pointer-events-none absolute inset-x-0 bottom-5 z-10 hidden justify-center gap-3 sm:flex"
        >
          <button
            type="button"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
            className="pointer-events-auto grid size-11 place-items-center bg-zinc-900 text-white shadow-lg disabled:opacity-30"
            title="Vé trước"
          >
            <ChevronLeft size={22} />
            <span className="sr-only">Vé trước</span>
          </button>
          <button
            type="button"
            disabled={index === tickets.length - 1}
            onClick={() => goTo(index + 1)}
            className="pointer-events-auto grid size-11 place-items-center bg-zinc-900 text-white shadow-lg disabled:opacity-30"
            title="Vé tiếp theo"
          >
            <ChevronRight size={22} />
            <span className="sr-only">Vé tiếp theo</span>
          </button>
        </nav>
      ) : null}
    </div>
  );
}
