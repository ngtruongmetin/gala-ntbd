import {
  CalendarDays,
  ExternalLink,
  HeartHandshake,
  Layers3,
  LogIn,
  MapPinned,
  MapPin,
  MessagesSquare,
  RefreshCw,
  Ticket,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';
import { landingGallery } from '../content/landing-gallery';
import { useAuth } from '../features/auth/use-auth';
import { useEventSettings } from '../features/event/use-event-settings';
import { getGoogleLoginUrl } from '../lib/api-client';
import type { EventPartner, EventSettings } from '../types/event';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
});

function EventSkeleton() {
  return (
    <div className="animate-pulse" aria-label="Đang tải thông tin sự kiện">
      <div className="h-5 w-40 rounded-md bg-white/25" />
      <div className="mt-5 h-28 max-w-2xl rounded-md bg-white/20" />
      <div className="mt-7 h-6 w-72 rounded-md bg-white/20" />
      <div className="mt-9 h-12 w-80 rounded-md bg-white/25" />
    </div>
  );
}

function availabilityLabel(event: EventSettings) {
  if (event.availabilityStatus === 'sold_out') return 'Đã hết vé';
  if (event.availabilityStatus === 'not_started') return 'Chưa mở bán';
  if (event.availabilityStatus === 'ended') return 'Đã kết thúc bán vé';
  return 'Đang tạm dừng';
}

function TicketAction({ event }: { event: EventSettings }) {
  const auth = useAuth().data;
  if (!event.canOrder)
    return (
      <button
        type="button"
        disabled
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-zinc-600 px-5 text-center font-bold text-zinc-100 disabled:cursor-not-allowed sm:w-auto"
      >
        <Ticket size={18} /> {availabilityLabel(event)}
      </button>
    );
  if (auth?.authenticated)
    return (
      <Link
        to="/dat-ve"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-coral-600 px-5 text-center font-bold text-white transition hover:bg-coral-500 active:translate-y-px sm:w-auto"
      >
        <Ticket size={18} /> Đặt vé
      </Link>
    );
  if (auth?.googleAuthAvailable)
    return (
      <a
        href={getGoogleLoginUrl('/dat-ve')}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-coral-600 px-5 text-center font-bold text-white transition hover:bg-coral-500 active:translate-y-px sm:w-auto"
      >
        <LogIn size={18} /> Đăng nhập để đặt vé
      </a>
    );
  return (
    <button
      type="button"
      disabled
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-zinc-600 px-5 text-center font-bold text-zinc-100 sm:w-auto"
    >
      <LogIn size={18} /> Chưa thể đăng nhập
    </button>
  );
}

function OrdersAction({ inverse = false }: { inverse?: boolean }) {
  const auth = useAuth().data;
  const className = inverse
    ? 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-white/40 px-5 text-center font-bold text-white transition hover:border-white hover:bg-white/10 active:translate-y-px sm:w-auto'
    : 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 px-5 text-center font-bold text-zinc-900 transition hover:border-coral-500 hover:text-coral-600 active:translate-y-px sm:w-auto dark:border-zinc-700 dark:text-zinc-50 dark:hover:border-coral-400 dark:hover:text-coral-400';
  const content = (
    <>
      <Layers3 size={18} /> Đơn hàng của tôi
    </>
  );
  if (auth?.authenticated)
    return (
      <Link to="/tai-khoan" className={className}>
        {content}
      </Link>
    );
  if (auth?.googleAuthAvailable)
    return (
      <a href={getGoogleLoginUrl('/tai-khoan')} className={className}>
        {content}
      </a>
    );
  return (
    <Link to="/tai-khoan" className={className}>
      {content}
    </Link>
  );
}

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal-section ${visible ? 'is-visible' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function HomePage() {
  const eventQuery = useEventSettings();
  const event = eventQuery.data;
  return (
    <>
      <section
        id="page-top"
        className="relative isolate min-h-[calc(100dvh-7rem)] overflow-hidden bg-zinc-900 sm:min-h-[calc(100dvh-8rem)]"
      >
        <img
          src="/images/gala-stage.jpg"
          alt="Khán giả hòa mình trong ánh sáng sân khấu nhiều màu sắc"
          className="hero-stage-image absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-zinc-950/75" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[calc(100dvh-7rem)] max-w-7xl items-center px-4 pb-12 pt-10 sm:min-h-[calc(100dvh-8rem)] sm:px-6 sm:pb-16 sm:pt-12 lg:px-8">
          <div className="w-full max-w-4xl text-zinc-50">
            {eventQuery.isPending ? <EventSkeleton /> : null}
            {eventQuery.isError ? (
              <div className="max-w-lg" role="alert">
                <h1 className="text-3xl font-black sm:text-4xl">Chưa tải được thông tin sự kiện</h1>
                <p className="mt-4 leading-relaxed text-zinc-200">
                  Kết nối đến máy chủ chưa sẵn sàng. Vui lòng thử lại sau ít phút.
                </p>
                <button
                  type="button"
                  onClick={() => eventQuery.refetch()}
                  className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-md bg-coral-600 px-5 font-bold text-white"
                >
                  <RefreshCw size={18} /> Thử lại
                </button>
              </div>
            ) : null}
            {event ? (
              <div className="hero-copy">
                <p className="hero-reveal flex items-center gap-2 text-sm font-bold text-coral-400">
                  <HeartHandshake size={18} />{' '}
                  {event.eventSubtitle ?? 'Gây quỹ học bổng Cùng bạn đến trường'}
                </p>
                <h1 className="hero-reveal mt-5 max-w-[16ch] break-words text-4xl font-black leading-[1.08] text-pretty sm:text-6xl lg:text-7xl">
                  {event.eventName}
                </h1>
                <p className="hero-reveal mt-6 max-w-2xl text-base leading-relaxed text-zinc-200 sm:text-lg">
                  Nơi âm nhạc hòa cùng nhịp đập yêu thương, chung tay gieo mầm hy vọng cho những
                  hành trình đến trường
                </p>
                <div className="hero-reveal mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-zinc-200">
                  {event.eventStartsAt ? (
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="text-coral-400" size={18} />{' '}
                      {dateTime.format(new Date(event.eventStartsAt))}
                    </span>
                  ) : null}
                  {event.venue ? (
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="text-coral-400" size={18} /> {event.venue}
                    </span>
                  ) : null}
                </div>
                <div className="hero-reveal mt-9 flex flex-col gap-3 sm:flex-row">
                  <TicketAction event={event} />
                  <OrdersAction inverse />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {event ? (
        <>
          <section className="ticker-shell overflow-hidden border-b border-coral-500 bg-coral-600 py-4 text-white">
            <div className="ticker-track flex w-max items-center" aria-label="Thông tin vé nhanh">
              {[0, 1].map((copy) => (
                <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
                  <TickerFact label="Giá vé" value={currency.format(event.ticketPriceVnd)} />
                  <TickerFact
                    label="Hiện còn"
                    value={`${event.remainingQuantity.toLocaleString('vi-VN')} vé`}
                  />
                  {event.eventStartsAt ? (
                    <TickerFact
                      label="Thời gian"
                      value={dateTime.format(new Date(event.eventStartsAt))}
                    />
                  ) : null}
                  {event.venue ? <TickerFact label="Địa điểm" value={event.venue} /> : null}
                </div>
              ))}
            </div>
          </section>
          <section className="border-b border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-950 sm:py-24">
            <Reveal className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-8">
              <div>
                <p className="text-sm font-bold text-coral-600 dark:text-coral-400">
                  Cùng bạn đến trường
                </p>
                <h2 className="mt-4 max-w-[13ch] text-3xl font-black leading-tight sm:text-5xl">
                  Một đêm vui, thêm một cơ hội học tập
                </h2>
              </div>
              <div className="max-w-2xl self-end border-l-2 border-coral-500 pl-6">
                <p className="text-lg leading-relaxed text-zinc-700 dark:text-zinc-200 sm:text-xl">
                  Gala Sắc màu tuổi trẻ hướng đến gây quỹ học bổng Cùng bạn đến trường. Mỗi tấm vé
                  là một lời đồng hành, để niềm vui trong đêm gala có thể đi xa hơn sân khấu.
                </p>
                <p className="mt-5 leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Tham dự cùng bạn bè, lưu lại một buổi tối đáng nhớ và góp mặt trong hoạt động ý
                  nghĩa dành cho học sinh.
                </p>
              </div>
            </Reveal>
          </section>

          <section
            className="bg-zinc-50 py-16 dark:bg-zinc-900 sm:py-20"
            aria-labelledby="ticket-information"
          >
            <Reveal className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-coral-600 dark:text-coral-400">
                    Thông tin tham dự
                  </p>
                  <h2 id="ticket-information" className="mt-2 text-3xl font-black">
                    Vé gala
                  </h2>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Còn {event.remainingQuantity.toLocaleString('vi-VN')} vé
                </p>
              </div>
              <dl className="mt-8 divide-y divide-zinc-300 border-y border-zinc-300 dark:divide-zinc-700 dark:border-zinc-700">
                <InfoRow label="Giá vé" value={currency.format(event.ticketPriceVnd)} large />
                {event.eventStartsAt ? (
                  <InfoRow
                    label="Thời gian"
                    value={dateTime.format(new Date(event.eventStartsAt))}
                  />
                ) : null}
                {event.venue ? <InfoRow label="Địa điểm" value={event.venue} /> : null}
              </dl>
            </Reveal>
          </section>

          <section className="border-y border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-950 sm:py-20">
            <Reveal className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8">
              <div>
                <MapPinned className="text-coral-600" size={30} strokeWidth={1.7} />
                <p className="mt-8 text-sm font-bold text-coral-600 dark:text-coral-400">
                  Nơi diễn ra chương trình
                </p>
                <h2 className="mt-3 max-w-xl text-3xl font-black leading-tight sm:text-5xl">
                  Trường THPT Nguyễn Trãi - Bình Dương
                </h2>
                <p className="mt-5 max-w-xl leading-relaxed text-zinc-600 dark:text-zinc-300">
                  Theo dõi fanpage nhà trường để cập nhật hoạt động và mở bản đồ khi cần chỉ đường
                  đến địa điểm tổ chức.
                </p>
              </div>
              <div className="border-l-2 border-coral-500 pl-5">
                <a
                  href="https://maps.app.goo.gl/Crt2VzARMN2MKPSY6"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Mở vị trí Trường THPT Nguyễn Trãi - Bình Dương trên Google Maps"
                  className="group flex min-h-16 items-center justify-between gap-4 border-b border-zinc-200 font-bold dark:border-zinc-800"
                >
                  <span className="flex items-center gap-3">
                    <MapPin size={19} className="text-coral-600" /> Chỉ đường đến trường
                  </span>
                  <ExternalLink
                    size={17}
                    className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </a>
                <a
                  href="https://www.facebook.com/profile.php?id=61588679217298"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Mở fanpage Trường THPT Nguyễn Trãi - Bình Dương"
                  className="group flex min-h-16 items-center justify-between gap-4 font-bold"
                >
                  <span className="flex items-center gap-3">
                    <MessagesSquare size={19} className="text-coral-600" /> Fanpage nhà trường
                  </span>
                  <ExternalLink
                    size={17}
                    className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </a>
              </div>
            </Reveal>
          </section>

          {landingGallery.length ? (
            <section
              className="bg-white py-16 dark:bg-zinc-950 sm:py-20"
              aria-labelledby="event-gallery"
            >
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <h2 id="event-gallery" className="text-3xl font-black">
                  Khoảnh khắc gala
                </h2>
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {landingGallery.map((image) => (
                    <figure key={image.src}>
                      <img
                        src={image.src}
                        alt={image.alt}
                        className="aspect-[4/3] w-full object-cover"
                        loading="lazy"
                      />
                      {image.caption ? (
                        <figcaption className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                          {image.caption}
                        </figcaption>
                      ) : null}
                    </figure>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <section className="bg-zinc-950 py-16 text-white sm:py-20">
            <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 sm:px-6 lg:flex-row lg:items-end lg:px-8">
              <div>
                <p className="text-sm font-bold text-coral-400">Hẹn gặp bạn tại gala</p>
                <h2 className="mt-3 max-w-xl text-3xl font-black leading-tight sm:text-5xl">
                  Cùng góp một sắc màu cho hành trình đến trường
                </h2>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <TicketAction event={event} />
                <OrdersAction inverse />
              </div>
            </div>
          </section>
          {event.partners.length ? <PartnersSection partners={event.partners} /> : null}
          <SiteFooter />
        </>
      ) : null}
    </>
  );
}

function TickerFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex shrink-0 items-center gap-3 px-6 sm:px-10">
      <span className="size-1.5 bg-white/70" aria-hidden="true" />
      <span className="text-xs font-semibold text-white/75">{label}</span>
      <strong className="font-black tabular-nums">{value}</strong>
    </div>
  );
}

function PartnersSection({ partners }: { partners: EventPartner[] }) {
  const firstRow = partners.filter((_, index) => index % 2 === 0);
  const secondRow = partners.filter((_, index) => index % 2 === 1);
  const useMarquee = partners.length >= 8;
  return (
    <section className="border-b border-zinc-200 bg-white py-14 dark:border-zinc-800 dark:bg-zinc-950 sm:py-20">
      <Reveal>
        <p className="text-center text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
          Trân trọng sự đồng hành của các đơn vị cùng Gala Sắc màu tuổi trẻ
        </p>
        {useMarquee ? (
          <div className="mt-8 space-y-2 overflow-hidden border-y border-zinc-200 py-2 dark:border-zinc-800">
            <PartnerMarqueeRow partners={firstRow} direction="forward" />
            <PartnerMarqueeRow partners={secondRow} direction="reverse" />
          </div>
        ) : (
          <div className="partner-static mx-auto mt-8 flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-4 border-y border-zinc-200 py-6 dark:border-zinc-800">
            {partners.map((partner) => (
              <PartnerLogo key={partner.id} partner={partner} staticLayout />
            ))}
          </div>
        )}
      </Reveal>
    </section>
  );
}

function PartnerMarqueeRow({
  partners,
  direction,
}: {
  partners: EventPartner[];
  direction: 'forward' | 'reverse';
}) {
  return (
    <div className="partner-marquee overflow-x-hidden">
      <div
        className={`partner-marquee-track flex w-max ${direction === 'reverse' ? 'is-reverse' : ''}`}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
            {partners.map((partner) => (
              <PartnerLogo key={`${copy}-${partner.id}`} partner={partner} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PartnerLogo({
  partner,
  staticLayout = false,
}: {
  partner: EventPartner;
  staticLayout?: boolean;
}) {
  const className = `group relative flex h-24 w-40 shrink-0 items-center justify-center px-6 sm:h-28 sm:w-52 sm:px-8 ${
    staticLayout ? '' : 'border-r border-zinc-200 dark:border-zinc-800'
  }`;
  const content = (
    <>
      <img
        src={partner.logoUrl}
        alt={`Logo ${partner.name}`}
        className="h-14 w-full object-contain transition duration-300 group-hover:-translate-y-2 group-focus-visible:-translate-y-2 sm:h-16"
      />
      <span className="pointer-events-none absolute inset-x-2 bottom-2 translate-y-1 text-center text-xs font-bold opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
        {partner.name}
      </span>
    </>
  );
  return partner.websiteUrl ? (
    <a
      href={partner.websiteUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Mở website ${partner.name}`}
      className={className}
    >
      {content}
    </a>
  ) : (
    <div title={partner.name} className={className}>
      {content}
    </div>
  );
}

function InfoRow({
  label,
  value,
  large = false,
  icon,
}: {
  label: string;
  value: string;
  large?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 py-5 sm:grid-cols-[minmax(12rem,0.7fr)_1.3fr] sm:items-center">
      <dt className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={`flex items-center gap-2 font-bold ${large ? 'text-2xl tabular-nums' : ''}`}>
        {icon}
        {value}
      </dd>
    </div>
  );
}
