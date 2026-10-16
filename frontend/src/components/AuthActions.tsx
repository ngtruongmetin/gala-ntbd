import { LogIn, LogOut, ScanLine, Settings, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getGoogleLoginUrl } from '../lib/api-client';
import { useAuth, useLogout } from '../features/auth/use-auth';

export function AuthActions() {
  const authQuery = useAuth();
  const logoutMutation = useLogout();
  const auth = authQuery.data;

  if (!auth || authQuery.isPending) {
    return <div className="h-10 w-28 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />;
  }

  if (auth.authenticated && auth.user) {
    return (
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <span className="hidden max-w-52 truncate text-sm font-semibold text-zinc-700 lg:block dark:text-zinc-200">
          {auth.user.email}
        </span>
        <Link
          to="/tai-khoan"
          title="Vé của tôi"
          className="grid size-10 shrink-0 place-items-center rounded-md border border-zinc-300 text-zinc-700 transition hover:border-coral-500 hover:text-coral-600 active:translate-y-px dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-coral-400 dark:hover:text-coral-400"
        >
          <Ticket aria-hidden="true" size={18} strokeWidth={1.8} />
          <span className="sr-only">Vé của tôi</span>
        </Link>
        {auth.user.roles.some((role) => ['check_in', 'admin', 'super_admin'].includes(role)) ? (
          <Link
            to="/check-in"
            title="Soát vé"
            className="grid size-10 shrink-0 place-items-center rounded-md border border-zinc-300 text-zinc-700 transition hover:border-coral-500 hover:text-coral-600 active:translate-y-px dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-coral-400 dark:hover:text-coral-400"
          >
            <ScanLine aria-hidden="true" size={18} strokeWidth={1.8} />
            <span className="sr-only">Soát vé</span>
          </Link>
        ) : null}
        {auth.user.roles.some((role) => role === 'admin' || role === 'super_admin') ? (
          <Link
            to="/admin"
            title="Quản trị"
            className="grid size-10 shrink-0 place-items-center rounded-md border border-coral-500 bg-coral-500/5 text-coral-600 transition hover:bg-coral-500/10 active:translate-y-px dark:text-coral-400"
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
          className="grid size-10 shrink-0 place-items-center rounded-md border border-zinc-300 text-zinc-700 transition hover:border-coral-500 hover:text-coral-600 active:translate-y-px disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-coral-400 dark:hover:text-coral-400"
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
      className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md bg-coral-600 px-4 text-sm font-bold text-white transition hover:bg-coral-500 active:translate-y-px"
    >
      <LogIn aria-hidden="true" size={17} strokeWidth={1.8} />
      <span className="hidden sm:inline">Đăng nhập Google</span>
      <span className="sm:hidden">Đăng nhập</span>
    </a>
  ) : (
    <span
      title="Đăng nhập chưa sẵn sàng"
      className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 px-2 text-xs font-semibold text-zinc-500 sm:px-3 dark:border-zinc-700 dark:text-zinc-400"
    >
      <LogIn aria-hidden="true" size={17} strokeWidth={1.8} />
      <span className="hidden whitespace-nowrap sm:inline">Đăng nhập chưa sẵn sàng</span>
      <span className="sr-only sm:hidden">Đăng nhập chưa sẵn sàng</span>
    </span>
  );
}
