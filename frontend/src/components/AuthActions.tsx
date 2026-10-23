import { LogIn, LogOut, ScanLine, Settings, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getGoogleLoginUrl } from '../lib/api-client';
import { useAuth, useLogout } from '../features/auth/use-auth';

export function AuthActions() {
  const authQuery = useAuth();
  const logoutMutation = useLogout();
  const auth = authQuery.data;

  if (!auth || authQuery.isPending) {
    return <div className="h-10 w-28 animate-pulse rounded-md bg-zinc-200" />;
  }

  if (auth.authenticated && auth.user) {
    return (
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <span className="hidden max-w-52 truncate text-sm font-semibold text-white lg:block">
          {auth.user.email}
        </span>
        <Link
          to="/tai-khoan"
          title="Vé của tôi"
          className="grid size-10 shrink-0 place-items-center rounded-md border border-zinc-700 text-zinc-100 transition hover:border-brand-magenta-500 hover:text-brand-magenta-400 active:translate-y-px"
        >
          <Ticket aria-hidden="true" size={18} strokeWidth={1.8} />
          <span className="sr-only">Vé của tôi</span>
        </Link>
        {auth.user.roles.some((role) => ['check_in', 'admin', 'super_admin'].includes(role)) ? (
          <Link
            to="/check-in"
            title="Soát vé"
            className="grid size-10 shrink-0 place-items-center rounded-md border border-zinc-700 text-zinc-100 transition hover:border-brand-magenta-500 hover:text-brand-magenta-400 active:translate-y-px"
          >
            <ScanLine aria-hidden="true" size={18} strokeWidth={1.8} />
            <span className="sr-only">Soát vé</span>
          </Link>
        ) : null}
        {auth.user.roles.some((role) => role === 'admin' || role === 'super_admin') ? (
          <Link
            to="/admin"
            title="Quản trị"
            className="grid size-10 shrink-0 place-items-center rounded-md border border-brand-magenta-500 bg-brand-magenta-500/10 text-brand-magenta-400 transition hover:bg-brand-magenta-500/20 active:translate-y-px"
          >
            <Settings aria-hidden="true" size={18} strokeWidth={1.8} />
            <span className="sr-only">Quản trị</span>
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => logoutMutation.mutate(auth.csrfToken)}
          disabled={logoutMutation.isPending}
          title="Đăng xuất"
          className="grid size-10 shrink-0 place-items-center rounded-md border border-zinc-700 text-zinc-100 transition hover:border-brand-magenta-500 hover:text-brand-magenta-400 active:translate-y-px disabled:opacity-60"
        >
          <LogOut aria-hidden="true" size={18} strokeWidth={1.8} />
          <span className="sr-only">Đăng xuất</span>
        </button>
      </div>
    );
  }

  return auth.googleAuthAvailable ? (
    <a
      href={getGoogleLoginUrl('/')}
      className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md bg-brand-magenta-600 px-4 text-sm font-bold text-white transition hover:bg-brand-magenta-500 active:translate-y-px"
    >
      <LogIn aria-hidden="true" size={17} strokeWidth={1.8} />
      <span className="hidden sm:inline">Đăng nhập Google</span>
      <span className="sm:hidden">Đăng nhập</span>
    </a>
  ) : (
    <span
      title="Đăng nhập chưa sẵn sàng"
      className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 px-2 text-xs font-semibold text-zinc-500 sm:px-3"
    >
      <LogIn aria-hidden="true" size={17} strokeWidth={1.8} />
      <span className="hidden whitespace-nowrap sm:inline">Đăng nhập chưa sẵn sàng</span>
      <span className="sr-only sm:hidden">Đăng nhập chưa sẵn sàng</span>
    </span>
  );
}
