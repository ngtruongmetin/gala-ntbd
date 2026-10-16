const test = require('node:test');
const assert = require('node:assert/strict');
const { toPublicEventSettings } = require('../src/modules/event-settings/service');

test('maps database event settings to the public API shape', () => {
  const result = toPublicEventSettings({
    event_name: 'Gala test',
    event_subtitle: 'Gây quỹ học bổng',
    venue: 'Trường THPT Nguyễn Trãi - Bình Dương',
    event_starts_at: '2026-11-14T11:00:00.000Z',
    ticket_price_vnd: '250000',
    total_capacity: 1000,
    min_tickets_per_order: 1,
    max_tickets_per_order: 10,
    sales_start_at: '2026-10-01T00:00:00.000Z',
    sales_end_at: '2026-12-31T00:00:00.000Z',
    reservation_minutes: 15,
    sales_status: 'paused',
    database_now: '2026-10-15T00:00:00.000Z',
    remaining_quantity: '997',
    internal_note: 'must not leak',
  });

  assert.deepEqual(result, {
    eventName: 'Gala test',
    eventSubtitle: 'Gây quỹ học bổng',
    venue: 'Trường THPT Nguyễn Trãi - Bình Dương',
    eventStartsAt: '2026-11-14T11:00:00.000Z',
    ticketPriceVnd: 250000,
    totalCapacity: 1000,
    minTicketsPerOrder: 1,
    maxTicketsPerOrder: 10,
    salesStartAt: '2026-10-01T00:00:00.000Z',
    salesEndAt: '2026-12-31T00:00:00.000Z',
    reservationMinutes: 15,
    salesStatus: 'paused',
    remainingQuantity: 997,
    availabilityStatus: 'paused',
    canOrder: false,
    serverTime: '2026-10-15T00:00:00.000Z',
  });
});
