import {
  ClipboardList,
  LayoutDashboard,
  ScanLine,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  MoreHorizontal,
  X,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/use-auth';
import { getGoogleLoginUrl } from '../lib/api-client';

const navItems = [
  { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/admin/don-hang', label: 'Đơn hàng', icon: ClipboardList },
  { to: '/admin/ve', label: 'Vé', icon: Ticket },
  { to: '/check-in', label: 'Soát vé', icon: ScanLine },
  { to: '/admin/nhan-su', label: 'Nhân sự', icon: Users, superOnly: true },
  { to: '/admin/cau-hinh', label: 'Cấu hình', icon: Settings },
];

export function AdminLayout() {
  const authQuery = useAuth();
  const user = authQuery.data?.user;
  const isAdmin = user?.roles.some((role) => role === 'admin' || role === 'super_admin');
  const isSuperAdmin = user?.roles.includes('super_admin');
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  if (authQuery.isPending) return <div className="min-h-[70dvh] animate-pulse" />;
  if (!authQuery.data?.authenticated) {
    return (
      <section className="mx-auto min-h-[60dvh] max-w-5xl px-4 py-16">
        <ShieldCheck className="text-brand-navy-600" size={30} strokeWidth={1.8} />
        <h1 className="mt-5 text-3xl font-black">Đăng nhập quản trị</h1>
        <a
          href={getGoogleLoginUrl('/admin')}
          className="mt-7 inline-flex h-12 items-center rounded-md bg-brand-navy-600 px-5 font-bold text-white"
        >
          Đăng nhập Google
        </a>
      </section>
    );
  }
  if (!isAdmin) {
    return (
      <section className="mx-auto min-h-[60dvh] max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-black">Không có quyền truy cập</h1>
        <p className="mt-4 text-zinc-600">
          Tài khoản Google này chưa có quyền quản trị.
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden border-r border-zinc-800 bg-zinc-950 px-5 py-7 text-white lg:block lg:min-h-[calc(100dvh-5rem)]">
        <p className="text-sm font-black">Quản trị Gala</p>
        <nav className="mt-6 grid gap-2" aria-label="Điều hướng quản trị">
          {navItems
            .filter((item) => !item.superOnly || isSuperAdmin)
            .map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-bold transition ${
                      isActive
                        ? 'bg-brand-navy-600 text-white'
                        : 'text-white/70 hover:bg-brand-navy-600 hover:text-white'
                    }`
                  }
                >
                  <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
                  {item.label}
                </NavLink>
              );
            })}
        </nav>
      </aside>
      <div className="pb-admin-nav min-w-0 bg-zinc-50 px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <Outlet />
      </div>
      <nav
        aria-label="Điều hướng quản trị trên điện thoại"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-zinc-800 bg-zinc-950/95 px-1 pt-1 text-white backdrop-blur lg:hidden"
      >
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-bold transition ${
                  isActive
                    ? 'text-brand-navy-300'
                    : 'text-white/65 hover:text-brand-navy-300'
                }`
              }
            >
              <Icon aria-hidden="true" size={21} strokeWidth={1.8} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-bold ${
            moreOpen ||
            location.pathname.includes('/nhan-su') ||
            location.pathname.includes('/cau-hinh')
              ? 'text-brand-navy-300'
              : 'text-white/65 hover:text-brand-navy-300'
          }`}
        >
          <MoreHorizontal size={21} />
          <span>Thêm</span>
        </button>
      </nav>
      {moreOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Thêm điều hướng"
        >
          <button
            type="button"
            aria-label="Đóng menu"
            className="absolute inset-0 bg-zinc-950/45"
            onClick={() => setMoreOpen(false)}
          />
          <div className="safe-bottom absolute inset-x-0 bottom-0 rounded-t-lg bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <strong>Thêm</strong>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="grid size-11 place-items-center rounded-md"
              >
                <X size={22} />
                <span className="sr-only">Đóng</span>
              </button>
            </div>
            <div className="grid gap-2">
              {isSuperAdmin ? (
                <MobileMoreLink
                  to="/admin/nhan-su"
                  label="Nhân sự"
                  icon={Users}
                  close={() => setMoreOpen(false)}
                />
              ) : null}
              <MobileMoreLink
                to="/admin/cau-hinh"
                label="Cấu hình"
                icon={Settings}
                close={() => setMoreOpen(false)}
              />
              <MobileMoreLink
                to="/tai-khoan"
                label="Vé của tôi"
                icon={UserRound}
                close={() => setMoreOpen(false)}
              />
              <Link
                to="/"
                onClick={() => setMoreOpen(false)}
                className="flex min-h-12 items-center gap-3 rounded-md px-3 font-bold hover:bg-zinc-100"
              >
                <Ticket size={20} /> Trang bán vé
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileMoreLink({
  to,
  label,
  icon: Icon,
  close,
}: {
  to: string;
  label: string;
  icon: typeof Users;
  close: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={close}
      className={({ isActive }) =>
        `flex min-h-12 items-center gap-3 rounded-md px-3 font-bold ${isActive ? 'bg-brand-navy-600 text-white' : 'hover:bg-brand-navy-100 hover:text-brand-navy-600'}`
      }
    >
      <Icon size={20} /> {label}
    </NavLink>
  );
}
