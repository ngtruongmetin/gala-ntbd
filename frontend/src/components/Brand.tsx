import { Link } from 'react-router-dom';
import { OrganizationLogo } from './OrganizationLogo';

export function Brand() {
  return (
    <Link
      to="/"
      className="inline-flex min-w-0 items-center gap-2 text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral-500 sm:gap-3 dark:text-zinc-50"
      aria-label="Gala Sắc màu tuổi trẻ - Gây quỹ học bổng Cùng bạn đến trường - Trang chủ"
    >
      <OrganizationLogo
        src="/images/logotruong.png"
        alt="Logo Trường THPT Nguyễn Trãi - Bình Dương"
        kind="school"
        className="size-10 shrink-0 rounded-md p-1"
      />
      <OrganizationLogo
        src="/images/logodoan.png"
        alt="Logo Đoàn trường THPT Nguyễn Trãi - Bình Dương"
        kind="youth"
        className="size-10 shrink-0 rounded-md p-1"
      />
      <span className="hidden min-w-0 text-sm font-bold leading-tight sm:block sm:text-base">
        Gala Sắc màu tuổi trẻ
        <span className="block whitespace-nowrap text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Gây quỹ học bổng Cùng bạn đến trường
        </span>
      </span>
    </Link>
  );
}
