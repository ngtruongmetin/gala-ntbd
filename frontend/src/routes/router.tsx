import { createBrowserRouter } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { AdminLayout } from '../layouts/AdminLayout';

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'dat-ve',
        lazy: async () => ({ Component: (await import('../pages/OrderPage')).OrderPage }),
      },
      {
        path: 'don-hang/:reference',
        lazy: async () => ({
          Component: (await import('../pages/OrderConfirmationPage')).OrderConfirmationPage,
        }),
      },
      {
        path: 'tai-khoan',
        lazy: async () => ({ Component: (await import('../pages/AccountPage')).AccountPage }),
      },
      {
        path: 'tai-khoan/don-hang/:reference',
        lazy: async () => ({
          Component: (await import('../pages/AccountOrderDetailPage')).AccountOrderDetailPage,
        }),
      },
      {
        path: 'tai-khoan/ve/:code',
        lazy: async () => ({
          Component: (await import('../pages/TicketDetailPage')).TicketDetailPage,
        }),
      },
      {
        path: 'check-in',
        lazy: async () => ({ Component: (await import('../pages/CheckInPage')).CheckInPage }),
      },
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('../pages/admin/AdminDashboardPage')).AdminDashboardPage,
            }),
          },
          {
            path: 'don-hang',
            lazy: async () => ({
              Component: (await import('../pages/admin/AdminOrdersPage')).AdminOrdersPage,
            }),
          },
          {
            path: 'don-hang/:reference',
            lazy: async () => ({
              Component: (await import('../pages/admin/AdminOrderDetailPage')).AdminOrderDetailPage,
            }),
          },
          {
            path: 've',
            lazy: async () => ({
              Component: (await import('../pages/admin/AdminTicketsPage')).AdminTicketsPage,
            }),
          },
          {
            path: 've/:code',
            lazy: async () => ({
              Component: (await import('../pages/admin/AdminTicketDetailPage'))
                .AdminTicketDetailPage,
            }),
          },
          {
            path: 'nhan-su',
            lazy: async () => ({
              Component: (await import('../pages/admin/AdminStaffPage')).AdminStaffPage,
            }),
          },
          {
            path: 'cau-hinh',
            lazy: async () => ({ Component: (await import('../pages/AdminPage')).AdminPage }),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
