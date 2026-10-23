import { Outlet } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { AuthActions } from '../components/AuthActions';

export function PublicLayout() {
  return (
    <div className="min-h-[100dvh] bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-md bg-zinc-950 px-4 py-3 font-bold text-white transition focus:translate-y-0"
      >
        Đi đến nội dung chính
      </a>
      <header className="safe-top relative z-20 min-h-16 border-b border-zinc-200 bg-zinc-50/95 dark:border-zinc-800 dark:bg-zinc-950/95 sm:min-h-20">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center justify-between gap-2 sm:min-h-20">
            <Brand />
            <AuthActions />
          </div>
          <div className="border-t border-zinc-200 pb-3 pt-2 sm:hidden dark:border-zinc-800">
            <p className="text-sm font-black">Gala Sắc màu tuổi trẻ</p>
            <p className="mt-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Gây quỹ học bổng Cùng bạn đến trường
            </p>
          </div>
        </div>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
