import { useNavigate, useParams } from 'react-router-dom';
import { TicketQrViewer } from '../components/TicketQrViewer';
import { useAccountTicket } from '../features/account/use-account';

export function TicketDetailPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const ticketQuery = useAccountTicket(code);
  if (ticketQuery.isPending) return <div className="min-h-[60dvh] animate-pulse" />;
  if (!ticketQuery.data) return <p className="p-10">Không tìm thấy vé.</p>;
  return (
    <TicketQrViewer
      tickets={[ticketQuery.data]}
      onClose={() => navigate(`/tai-khoan/don-hang/${ticketQuery.data.orderReference}`)}
    />
  );
}
