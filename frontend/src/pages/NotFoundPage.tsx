import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <div>
        <p className="text-sm font-bold uppercase text-coral-600 dark:text-coral-400">
          Không tìm thấy
        </p>
        <h1 className="mt-4 text-4xl font-black sm:text-5xl">Trang này không tồn tại</h1>
        <Link
          to="/"
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-coral-600 px-5 font-bold text-white transition hover:bg-coral-500 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral-500"
        >
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.8} />
          Về trang chủ
        </Link>
      </div>
    </section>
  );
}
