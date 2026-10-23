import { ArrowUp, ExternalLink, Mail, MapPin, MessagesSquare, ShieldCheck } from 'lucide-react';
import { OrganizationLogo } from './OrganizationLogo';

const contactLinks = [
  {
    href: 'mailto:contact@sacmautuoitre.io.vn',
    label: 'contact@sacmautuoitre.io.vn',
    description: 'Email hỗ trợ',
    icon: Mail,
    external: false,
  },
  {
    href: 'https://gala.thptnguyentraibinhduong.edu.vn',
    label: 'gala.thptnguyentraibinhduong.edu.vn',
    description: 'Trang web sự kiện',
    icon: ExternalLink,
    external: true,
  },
  {
    href: 'https://www.facebook.com/profile.php?id=61588679217298',
    label: 'Fanpage nhà trường',
    description: 'Tin tức và thông báo',
    icon: MessagesSquare,
    external: true,
  },
  {
    href: 'https://maps.app.goo.gl/Crt2VzARMN2MKPSY6',
    label: 'Google Maps',
    description: 'Chỉ đường đến trường',
    icon: MapPin,
    external: true,
  },
] as const;

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t-2 border-coral-500 bg-zinc-900 text-zinc-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,0.9fr)] lg:gap-16 lg:py-14">
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <OrganizationLogo
                src="/images/logotruong.png"
                alt="Logo Trường THPT Nguyễn Trãi - Bình Dương"
                kind="school"
                className="size-14 shrink-0"
              />
              <OrganizationLogo
                src="/images/logodoan.png"
                alt="Logo Đoàn trường THPT Nguyễn Trãi - Bình Dương"
                kind="youth"
                className="size-14 shrink-0"
              />
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-coral-400">
              <ShieldCheck size={18} aria-hidden="true" /> Kênh thông tin chính thức
            </p>
            <h2 className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl">
              Gala Sắc màu tuổi trẻ
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-zinc-400 sm:text-base">
              Thông tin sự kiện, đơn hàng và vé điện tử được quản lý trực tiếp tại website này bởi
              ban tổ chức chương trình.
            </p>
          </div>

          <nav aria-label="Thông tin liên hệ" className="grid gap-x-8 sm:grid-cols-2">
            {contactLinks.map(({ href, label, description, icon: Icon, external }) => (
              <a
                key={href}
                href={href}
                {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                className="group flex min-h-20 items-center gap-3 border-b border-zinc-700/80 py-4 transition-colors hover:border-coral-500 focus-visible:border-coral-500"
                aria-label={external ? `${label} (mở trong tab mới)` : label}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-zinc-800 text-coral-400 transition-colors group-hover:bg-coral-600 group-hover:text-white">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-zinc-500">{description}</span>
                  <span className="mt-1 block break-words text-sm font-bold text-zinc-100 transition-colors group-hover:text-white">
                    {label}
                  </span>
                </span>
              </a>
            ))}
          </nav>
        </div>

        <div className="flex min-h-20 flex-col justify-center gap-3 border-t border-zinc-700/80 py-4 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} Gala Sắc màu tuổi trẻ. Trường THPT Nguyễn Trãi - Bình Dương.</p>
          <a
            href="#page-top"
            aria-label="Về đầu trang"
            title="Về đầu trang"
            className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-zinc-300 transition-colors hover:text-coral-400 sm:self-auto"
          >
            Về đầu trang
            <span className="grid size-9 place-items-center rounded-md border border-zinc-700 transition-colors group-hover:border-coral-500">
              <ArrowUp size={17} aria-hidden="true" />
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
