function toPublicEventSettings(row) {
  const now = new Date(row.database_now);
  const remainingQuantity = Number(row.remaining_quantity);
  let availabilityStatus = 'open';

  if (row.sales_status !== 'open') availabilityStatus = 'paused';
  else if (now < new Date(row.sales_start_at)) availabilityStatus = 'not_started';
  else if (now > new Date(row.sales_end_at)) availabilityStatus = 'ended';
  else if (remainingQuantity === 0) availabilityStatus = 'sold_out';

  return {
    eventName: row.event_name,
    eventSubtitle: row.event_subtitle,
    venue: row.venue,
    eventStartsAt: row.event_starts_at,
    ticketPriceVnd: Number(row.ticket_price_vnd),
    totalCapacity: row.total_capacity,
    minTicketsPerOrder: row.min_tickets_per_order,
    maxTicketsPerOrder: row.max_tickets_per_order,
    salesStartAt: row.sales_start_at,
    salesEndAt: row.sales_end_at,
    reservationMinutes: row.reservation_minutes,
    salesStatus: row.sales_status,
    remainingQuantity,
    availabilityStatus,
    canOrder: availabilityStatus === 'open',
    serverTime: row.database_now,
  };
}

async function getPublicEventSettings() {
  const repository = require('./repository');
  const [settings, partnerRows] = await Promise.all([
    repository.findCurrentEventSettings(),
    repository.listPublicPartners(),
  ]);
  return settings
    ? {
        ...toPublicEventSettings(settings),
        partners: partnerRows.map(toPartner),
      }
    : null;
}

function toPartner(row) {
  return {
    id: row.id,
    name: row.name,
    logoUrl:
      row.has_logo_data || row.logo_data
        ? `/api/event-settings/partners/${row.id}/logo`
        : row.logo_url,
    websiteUrl: row.website_url,
    sortOrder: row.sort_order,
    active: row.active ?? true,
  };
}

module.exports = { getPublicEventSettings, toPublicEventSettings, toPartner };
