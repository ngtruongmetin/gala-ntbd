import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { FormEvent } from 'react';
import { createStaffGrant, listStaff, revokeStaffGrant } from '../../features/admin/api';
import { useAuth } from '../../features/auth/use-auth';
import { getApiErrorMessage } from '../../lib/api-error';

export function AdminStaffPage() {
  const auth = useAuth().data;
  const queryClient = useQueryClient();
  const staffQuery = useQuery({ queryKey: ['admin', 'staff'], queryFn: listStaff });
  const mutation = useMutation({
    mutationFn: (task: () => Promise<unknown>) => task(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] }),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate(() =>
      createStaffGrant(
        {
          email: String(form.get('email')),
          role: String(form.get('role')) as 'admin' | 'check_in',
        },
        auth?.csrfToken ?? '',
      ),
    );
    event.currentTarget.reset();
  };
  if (!staffQuery.data) return <div className="min-h-[50dvh] animate-pulse" />;
  return (
    <section>
      <h1 className="text-2xl font-black sm:text-3xl">Nhân sự</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Cấp quyền cho người phụ trách quản trị hoặc soát vé.
      </p>
      <div className="mt-7 rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="flex items-center gap-2 font-black">
          <ShieldCheck className="text-coral-600" size={19} /> Chủ hệ thống
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Có toàn quyền quản trị và quản lý nhân sự.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {staffQuery.data.bootstrapSuperAdmins.map((email) => (
            <span
              key={email}
              className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-bold dark:bg-zinc-800"
            >
              {email}
            </span>
          ))}
        </div>
      </div>
      <form
        onSubmit={submit}
        className="mt-6 grid gap-3 rounded-md border border-zinc-200 bg-white p-4 md:grid-cols-[1fr_180px_auto] md:p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input
          required
          name="email"
          type="email"
          placeholder="email@gmail.com"
          className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
        <select
          name="role"
          className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        >
          <option value="check_in">Nhân viên soát vé</option>
          <option value="admin">Quản trị viên</option>
        </select>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-coral-600 px-4 font-bold text-white">
          <UserPlus size={17} /> Cấp quyền
        </button>
      </form>
      {mutation.isError ? (
        <p className="mt-4 text-sm font-bold text-coral-600">
          {getApiErrorMessage(mutation.error, 'Không thể cập nhật quyền.')}
        </p>
      ) : null}
      <div className="mt-6 overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {staffQuery.data.grants.length === 0 ? (
          <p className="p-5 text-zinc-500">Chưa có quyền bổ sung.</p>
        ) : (
          staffQuery.data.grants.map((grant) => (
            <div
              key={grant.id}
              className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 p-4 last:border-b-0 dark:border-zinc-800"
            >
              <div className="min-w-0">
                <strong className="block break-all">{grant.email}</strong>
                <p className="mt-1 text-sm text-zinc-500">
                  {grant.role === 'admin' ? 'Quản trị viên' : 'Nhân viên soát vé'} ·{' '}
                  {grant.active ? 'Đã liên kết Google' : 'Chờ đăng nhập'}
                </p>
              </div>
              <button
                title="Thu hồi quyền"
                onClick={() =>
                  mutation.mutate(() =>
                    revokeStaffGrant(
                      grant.id,
                      'Quản trị viên cấp cao thu hồi quyền',
                      auth?.csrfToken ?? '',
                    ),
                  )
                }
                className="grid size-10 place-items-center rounded-md border border-coral-500 text-coral-600"
              >
                <Trash2 size={17} />
                <span className="sr-only">Thu hồi quyền</span>
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
