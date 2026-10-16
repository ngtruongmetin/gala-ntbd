const test = require('node:test');
const assert = require('node:assert/strict');
const { updateEventSettingsSchema } = require('../src/modules/admin/validation');

function validSettings(overrides = {}) {
  return {
    eventName: 'GALA Sắc màu tuổi trẻ',
    eventSubtitle: 'Gây quỹ học bổng Cùng bạn đến trường',
    venue: 'Trường THPT Nguyễn Trãi - Bình Dương',
    eventStartsAt: '2026-11-14T18:00:00+07:00',
    ticketPriceVnd: 250000,
    totalCapacity: 1000,
    minTicketsPerOrder: 1,
    maxTicketsPerOrder: 10,
    salesStartAt: '2026-10-01T00:00:00+07:00',
    salesEndAt: '2026-11-14T17:30:00+07:00',
    reservationMinutes: 15,
    salesStatus: 'paused',
    ...overrides,
  };
}

test('accepts a valid single-event admin configuration', () => {
  assert.equal(updateEventSettingsSchema.safeParse(validSettings()).success, true);
});

test('rejects invalid sales windows and ticket limits', () => {
  assert.equal(
    updateEventSettingsSchema.safeParse(
      validSettings({ minTicketsPerOrder: 5, maxTicketsPerOrder: 2 }),
    ).success,
    false,
  );
  assert.equal(
    updateEventSettingsSchema.safeParse(validSettings({ salesEndAt: '2026-09-01T00:00:00+07:00' }))
      .success,
    false,
  );
});

test('allows ticket sales to end after the event starts', () => {
  assert.equal(
    updateEventSettingsSchema.safeParse(
      validSettings({
        eventStartsAt: '2026-11-14T16:00:00+07:00',
        salesEndAt: '2026-11-14T20:00:00+07:00',
      }),
    ).success,
    true,
  );
});
