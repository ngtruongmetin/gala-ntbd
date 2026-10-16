const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const repository = require('../src/modules/orders/repository');
const { createOrder, getOrder, getOwnedOrder } = require('../src/modules/orders/service');
const adminRepository = require('../src/modules/admin/repository');
const adminService = require('../src/modules/admin/service');
const paymentRepository = require('../src/modules/payments/repository');
const paymentService = require('../src/modules/payments/service');
const webhookService = require('../src/modules/webhooks/service');
const checkinRepository = require('../src/modules/checkin/repository');
const checkinService = require('../src/modules/checkin/service');

/* eslint-disable no-await-in-loop -- Test migrations must be applied in filename order. */

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test(
    'PostgreSQL order integration tests',
    { skip: 'TEST_DATABASE_URL is not configured' },
    () => {},
  );
} else {
  const schema = `gala_test_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
  const adminPool = new Pool({ connectionString: databaseUrl, max: 2 });
  const pool = new Pool({
    connectionString: databaseUrl,
    options: `-c search_path=${schema},public`,
    max: 10,
  });

  async function withTransaction(callback) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function createUser(email) {
    const result = await pool.query(
      `INSERT INTO users (google_sub, email, email_verified) VALUES ($1, $2, TRUE) RETURNING id, email`,
      [`sub-${email}`, email],
    );
    return result.rows[0];
  }

  async function seedEvent(overrides = {}) {
    const now = Date.now();
    const settings = {
      price: 250000,
      capacity: 5,
      minimum: 1,
      maximum: 5,
      startsAt: new Date(now - 60_000),
      endsAt: new Date(now + 3_600_000),
      minutes: 15,
      status: 'open',
      ...overrides,
    };
    await pool.query(
      `
        INSERT INTO event_settings (
          singleton_key, event_name, ticket_price_vnd, total_capacity,
          min_tickets_per_order, max_tickets_per_order, sales_start_at,
          sales_end_at, reservation_minutes, sales_status
        ) VALUES (TRUE, 'Integration Gala', $1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        settings.price,
        settings.capacity,
        settings.minimum,
        settings.maximum,
        settings.startsAt,
        settings.endsAt,
        settings.minutes,
        settings.status,
      ],
    );
  }

  function placeOrder(user, quantity = 1, extras = {}, options = {}) {
    return createOrder(
      {
        user,
        input: {
          fullName: 'NGUYỄN VĂN AN',
          phone: '0901234567',
          quantity,
          ...extras,
        },
      },
      {
        repository,
        withTransaction,
        paymentsEnabled: options.paymentsEnabled ?? true,
      },
    );
  }

  test.before(async () => {
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    for (const filename of [
      '001_initial_schema.sql',
      '002_safe_ordering.sql',
      '003_event_details.sql',
      '004_ticket_lifecycle.sql',
    ]) {
      const sql = await fs.readFile(
        path.resolve(__dirname, `../src/database/migrations/${filename}`),
        'utf8',
      );
      await pool.query(sql);
    }
  });

  test.beforeEach(async () => {
    await pool.query(`
      TRUNCATE admin_permissions, tickets, payment_transactions, orders, users, event_settings CASCADE
    `);
  });

  test.after(async () => {
    await pool.end();
    await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
    await adminPool.end();
  });

  test('rejects orders while sales are paused', async () => {
    await seedEvent({ status: 'paused' });
    const user = await createUser('paused@example.com');
    await assert.rejects(placeOrder(user), (error) => error.code === 'SALES_PAUSED');
  });

  test('rejects orders outside the sales window', async () => {
    await seedEvent({
      startsAt: new Date(Date.now() + 60_000),
      endsAt: new Date(Date.now() + 120_000),
    });
    const user = await createUser('early@example.com');
    await assert.rejects(placeOrder(user), (error) => error.code === 'SALES_NOT_STARTED');
  });

  test('enforces configured per-order limits', async () => {
    await seedEvent({ minimum: 2, maximum: 3 });
    const user = await createUser('limit@example.com');
    await assert.rejects(placeOrder(user, 1), (error) => error.code === 'QUANTITY_OUT_OF_RANGE');
    await assert.rejects(placeOrder(user, 4), (error) => error.code === 'QUANTITY_OUT_OF_RANGE');
  });

  test('uses authenticated email and server price', async () => {
    await seedEvent({ price: 375000 });
    const user = await createUser('trusted@example.com');
    const order = await placeOrder(user, 2, {
      email: 'attacker@example.com',
      unitPriceVnd: 1,
    });
    assert.equal(order.buyerEmail, 'trusted@example.com');
    assert.equal(order.unitPriceVnd, 375000);
    assert.equal(order.totalAmountVnd, 750000);
  });

  test('issues tickets immediately when payments are disabled', async () => {
    await seedEvent({ capacity: 4, maximum: 4 });
    const user = await createUser('instant-tickets@example.com');
    const order = await placeOrder(user, 2, {}, { paymentsEnabled: false });

    assert.equal(order.status, 'paid');
    assert.equal(order.reservationState, 'consumed');
    assert.equal(order.ticketCount, 2);
    assert.equal(
      Number(
        (
          await pool.query(
            `SELECT COUNT(*) FROM tickets t JOIN orders o ON o.id = t.order_id WHERE o.order_code = $1`,
            [order.reference],
          )
        ).rows[0].count,
      ),
      2,
    );
    assert.equal(
      Number(
        (
          await pool.query(
            `SELECT COUNT(*) FROM payment_transactions pt JOIN orders o ON o.id = pt.order_id WHERE o.order_code = $1`,
            [order.reference],
          )
        ).rows[0].count,
      ),
      0,
    );
  });

  test('cannot reserve more tickets than remain', async () => {
    await seedEvent({ capacity: 2, maximum: 2 });
    const first = await createUser('first@example.com');
    const second = await createUser('second@example.com');
    await placeOrder(first, 2);
    await assert.rejects(placeOrder(second, 1), (error) => error.code === 'INSUFFICIENT_INVENTORY');
  });

  test('concurrent requests cannot oversell the final tickets', async () => {
    await seedEvent({ capacity: 3, maximum: 3 });
    const first = await createUser('concurrent-one@example.com');
    const second = await createUser('concurrent-two@example.com');
    const results = await Promise.allSettled([placeOrder(first, 2), placeOrder(second, 2)]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    const reserved = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0)::INTEGER AS quantity FROM orders`,
    );
    assert.equal(reserved.rows[0].quantity, 2);
  });

  test('expired reservations release inventory and expire idempotently', async () => {
    await seedEvent({ capacity: 2, maximum: 2 });
    const oldUser = await createUser('expired@example.com');
    const buyer = await createUser('new@example.com');
    await pool.query(
      `
        INSERT INTO orders (
          order_code, user_id, buyer_name, phone, email, quantity,
          unit_price_vnd, status, expires_at
        ) VALUES ('GALA-EXPIRED', $1, 'NGUYỄN VĂN AN', '0901234567', $2, 2, 250000, 'pending_payment', NOW() - INTERVAL '1 minute')
      `,
      [oldUser.id, oldUser.email],
    );
    const order = await placeOrder(buyer, 2);
    assert.equal(order.quantity, 2);
    assert.equal(
      (await pool.query(`SELECT status FROM orders WHERE order_code = 'GALA-EXPIRED'`)).rows[0]
        .status,
      'expired',
    );
    assert.equal(await repository.expirePendingReservations(pool), 0);
  });

  test('expiration processing never overwrites a paid order', async () => {
    await seedEvent({ capacity: 2, maximum: 2 });
    const user = await createUser('paid@example.com');
    await pool.query(
      `
        INSERT INTO orders (
          order_code, user_id, buyer_name, phone, email, quantity,
          unit_price_vnd, status, expires_at, paid_at
        ) VALUES ('GALA-PAID', $1, 'NGUYỄN VĂN AN', '0901234567', $2, 1, 250000, 'paid', NOW() - INTERVAL '1 minute', NOW())
      `,
      [user.id, user.email],
    );
    assert.equal(await repository.expirePendingReservations(pool), 0);
    assert.equal(
      (await pool.query(`SELECT status FROM orders WHERE order_code = 'GALA-PAID'`)).rows[0].status,
      'paid',
    );
  });

  test('only the owner or an administrator can retrieve an order', async () => {
    await seedEvent();
    const owner = await createUser('owner@example.com');
    const stranger = await createUser('stranger@example.com');
    const order = await placeOrder(owner);
    const fetched = await getOrder(order.reference, owner, { repository, client: pool });
    assert.equal(fetched.reference, order.reference);
    await assert.rejects(
      getOrder(order.reference, stranger, { repository, client: pool }),
      (error) => error.code === 'ORDER_NOT_FOUND',
    );
    await pool.query(
      `INSERT INTO admin_permissions (user_id, role, granted_by) VALUES ($1, 'admin', $2)`,
      [stranger.id, owner.id],
    );
    const adminView = await getOrder(order.reference, stranger, { repository, client: pool });
    assert.equal(adminView.reference, order.reference);
  });

  test('only the owner order endpoint includes valid ticket QR payloads', async () => {
    await seedEvent();
    const owner = await createUser('qr-owner@example.com');
    const admin = await createUser('qr-admin@example.com');
    const order = await placeOrder(owner, 2, {}, { paymentsEnabled: false });
    await pool.query(
      `INSERT INTO admin_permissions (user_id, role, granted_by) VALUES ($1, 'admin', $2)`,
      [admin.id, owner.id],
    );

    const ownerView = await getOwnedOrder(order.reference, owner, {
      repository,
      ticketsRepository: require('../src/modules/tickets/repository'),
      client: pool,
    });
    assert.equal(ownerView.tickets.length, 2);
    assert.equal(
      ownerView.tickets.every((ticket) => ticket.qrPayload?.startsWith('gala:t1:')),
      true,
    );

    const adminView = await getOrder(order.reference, admin, { repository, client: pool });
    assert.equal(
      adminView.tickets.every((ticket) => ticket.qrPayload === null),
      true,
    );
    await assert.rejects(
      getOwnedOrder(order.reference, admin, { repository, client: pool }),
      (error) => error.code === 'ORDER_NOT_FOUND',
    );
  });

  test('configured admin emails grant and revoke database permission', async () => {
    const user = await createUser('configured-admin@example.com');
    assert.equal(
      await adminRepository.syncConfiguredAdmin(
        user.id,
        user.email,
        ['first@example.com', 'configured-admin@example.com'],
        pool,
      ),
      true,
    );
    assert.equal(await adminRepository.hasAdminPermission(user.id, pool), true);
    await adminRepository.syncConfiguredAdmin(user.id, user.email, ['first@example.com'], pool);
    assert.equal(await adminRepository.hasAdminPermission(user.id, pool), false);
    const dashboard = await adminRepository.getAdminDashboard(pool);
    assert.equal(typeof dashboard.summary.pending_orders, 'number');
    assert.equal(Array.isArray(dashboard.trend), true);
  });

  test('admin cannot reduce capacity below active reservations', async () => {
    await seedEvent({ capacity: 5, maximum: 5 });
    const user = await createUser('capacity@example.com');
    await placeOrder(user, 3);
    await assert.rejects(
      adminService.updateEventSettings(
        {
          eventName: 'Integration Gala',
          eventSubtitle: 'Scholarship fundraiser',
          venue: 'Integration venue',
          eventStartsAt: new Date(Date.now() + 3_600_000).toISOString(),
          ticketPriceVnd: 250000,
          totalCapacity: 2,
          minTicketsPerOrder: 1,
          maxTicketsPerOrder: 2,
          salesStartAt: new Date(Date.now() - 60_000).toISOString(),
          salesEndAt: new Date(Date.now() + 1_800_000).toISOString(),
          reservationMinutes: 15,
          salesStatus: 'open',
        },
        user,
        { repository: adminRepository, withTransaction },
      ),
      (error) => error.code === 'CAPACITY_BELOW_RESERVED',
    );
  });

  test('exact manual payment issues tickets once and consumes inventory', async () => {
    await seedEvent({ capacity: 4, maximum: 4 });
    const buyer = await createUser('paid-buyer@example.com');
    const admin = await createUser('payment-admin@example.com');
    const order = await placeOrder(buyer, 2);
    const first = await paymentService.recordManualPayment(
      order.reference,
      {
        transactionReference: 'BANK-EXACT-001',
        amountVnd: order.totalAmountVnd,
        occurredAt: new Date().toISOString(),
        notes: 'integration test',
      },
      admin,
      { repository: paymentRepository, withTransaction },
    );
    assert.equal(first.orderStatus, 'paid');
    const tickets = await pool.query(
      `SELECT t.status, t.qr_payload FROM tickets t JOIN orders o ON o.id = t.order_id WHERE o.order_code = $1`,
      [order.reference],
    );
    assert.equal(tickets.rowCount, 2);
    assert.equal(
      tickets.rows.every((ticket) => ticket.status === 'valid'),
      true,
    );
    assert.equal(
      tickets.rows.every((ticket) => ticket.qr_payload.startsWith('gala:t1:')),
      true,
    );
    assert.equal(
      (
        await pool.query(
          `SELECT state FROM inventory_reservations ir JOIN orders o ON o.id = ir.order_id WHERE o.order_code = $1`,
          [order.reference],
        )
      ).rows[0].state,
      'consumed',
    );
    await assert.rejects(
      paymentService.recordManualPayment(
        order.reference,
        {
          transactionReference: 'BANK-EXACT-002',
          amountVnd: order.totalAmountVnd,
          occurredAt: new Date().toISOString(),
        },
        admin,
        { repository: paymentRepository, withTransaction },
      ),
      (error) => error.code === 'ORDER_ALREADY_PAID',
    );
    assert.equal(
      Number(
        (
          await pool.query(
            `SELECT COUNT(*) FROM tickets t JOIN orders o ON o.id=t.order_id WHERE o.order_code=$1`,
            [order.reference],
          )
        ).rows[0].count,
      ),
      2,
    );
  });

  test('amount mismatch creates review hold without issuing tickets', async () => {
    await seedEvent();
    const buyer = await createUser('review-buyer@example.com');
    const admin = await createUser('review-admin@example.com');
    const order = await placeOrder(buyer, 1);
    const result = await paymentService.recordManualPayment(
      order.reference,
      {
        transactionReference: 'BANK-MISMATCH-001',
        amountVnd: order.totalAmountVnd - 1000,
        occurredAt: new Date().toISOString(),
      },
      admin,
      { repository: paymentRepository, withTransaction },
    );
    assert.equal(result.orderStatus, 'payment_review');
    assert.equal(
      (
        await pool.query(
          `SELECT state FROM inventory_reservations ir JOIN orders o ON o.id=ir.order_id WHERE o.order_code=$1`,
          [order.reference],
        )
      ).rows[0].state,
      'review_hold',
    );
    assert.equal(
      Number(
        (
          await pool.query(
            `SELECT COUNT(*) FROM tickets t JOIN orders o ON o.id=t.order_id WHERE o.order_code=$1`,
            [order.reference],
          )
        ).rows[0].count,
      ),
      0,
    );
  });

  test('Pay2S payment confirms an order once when the webhook is retried', async () => {
    await seedEvent({ capacity: 4, maximum: 4 });
    const buyer = await createUser('pay2s-buyer@example.com');
    const order = await placeOrder(buyer, 2);
    const transferContent = (
      await pool.query(`SELECT transfer_content FROM orders WHERE order_code = $1`, [
        order.reference,
      ])
    ).rows[0].transfer_content;
    const transaction = {
      id: 'PAY2S-EXACT-001',
      gateway: 'MB',
      transactionDate: '2026-10-15 12:30:00',
      transactionNumber: 'MB-001',
      accountNumber: '0123456789',
      content: `THANH TOAN ${transferContent}`,
      transferType: 'IN',
      transferAmount: order.totalAmountVnd,
      checksum: 'pay2s-checksum-001',
    };
    const dependencies = {
      repository: paymentRepository,
      withTransaction,
      accountNumber: '0123456789',
    };

    assert.equal(
      (await webhookService.processTransaction(transaction, dependencies)).matchStatus,
      'matched',
    );
    assert.equal(
      (await webhookService.processTransaction(transaction, dependencies)).matchStatus,
      'duplicate',
    );
    assert.equal(Number((await pool.query(`SELECT COUNT(*) FROM tickets`)).rows[0].count), 2);
    assert.equal(
      Number((await pool.query(`SELECT COUNT(*) FROM payment_transactions`)).rows[0].count),
      1,
    );
  });

  test('Pay2S mismatches go to review and unknown or outgoing payments remain unmatched', async () => {
    await seedEvent();
    const buyer = await createUser('pay2s-review@example.com');
    const order = await placeOrder(buyer);
    const transferContent = (
      await pool.query(`SELECT transfer_content FROM orders WHERE order_code = $1`, [
        order.reference,
      ])
    ).rows[0].transfer_content;
    const base = {
      gateway: 'MB',
      transactionDate: '2026-10-15 12:30:00',
      transactionNumber: 'MB-REVIEW',
      accountNumber: '0123456789',
      transferType: 'IN',
      checksum: 'pay2s-review-checksum',
    };
    const dependencies = {
      repository: paymentRepository,
      withTransaction,
      accountNumber: '0123456789',
    };

    const mismatch = await webhookService.processTransaction(
      {
        ...base,
        id: 'PAY2S-MISMATCH-001',
        content: transferContent,
        transferAmount: order.totalAmountVnd - 1,
      },
      dependencies,
    );
    assert.equal(mismatch.matchStatus, 'amount_mismatch');
    assert.equal(
      (await pool.query(`SELECT status FROM orders WHERE order_code = $1`, [order.reference]))
        .rows[0].status,
      'payment_review',
    );

    const results = await webhookService.processWebhook(
      [
        { ...base, id: 'PAY2S-UNKNOWN-001', content: 'NO ORDER CODE', transferAmount: 1000 },
        {
          ...base,
          id: 'PAY2S-OUT-001',
          content: transferContent,
          transferType: 'OUT',
          transferAmount: 1000,
        },
      ],
      dependencies,
    );
    assert.deepEqual(
      results.map((result) => result.matchStatus),
      ['unmatched', 'unmatched'],
    );
    assert.equal(
      Number(
        (
          await pool.query(
            `SELECT COUNT(*) FROM payment_transactions WHERE order_id IS NULL AND match_status = 'unmatched'`,
          )
        ).rows[0].count,
      ),
      2,
    );
  });

  test('refund confirmation voids tickets then releases inventory', async () => {
    await seedEvent();
    const buyer = await createUser('refund-buyer@example.com');
    const admin = await createUser('refund-admin@example.com');
    const order = await placeOrder(buyer, 2);
    await paymentService.recordManualPayment(
      order.reference,
      {
        transactionReference: 'BANK-REFUND-CREDIT',
        amountVnd: order.totalAmountVnd,
        occurredAt: new Date().toISOString(),
      },
      admin,
      { repository: paymentRepository, withTransaction },
    );
    await paymentService.requestRefund(order.reference, 'Buyer requested refund', admin, {
      repository: paymentRepository,
      withTransaction,
    });
    assert.equal(
      Number((await pool.query(`SELECT COUNT(*) FROM tickets WHERE status='void'`)).rows[0].count),
      2,
    );
    await paymentService.confirmManualRefund(
      order.reference,
      {
        transactionReference: 'BANK-REFUND-DEBIT',
        amountVnd: order.totalAmountVnd,
        occurredAt: new Date().toISOString(),
      },
      admin,
      { repository: paymentRepository, withTransaction },
    );
    assert.equal(
      (
        await pool.query(
          `SELECT state FROM inventory_reservations ir JOIN orders o ON o.id=ir.order_id WHERE o.order_code=$1`,
          [order.reference],
        )
      ).rows[0].state,
      'released',
    );
    assert.equal(
      Number(
        (await pool.query(`SELECT COUNT(*) FROM tickets WHERE status='refunded'`)).rows[0].count,
      ),
      2,
    );
  });

  test('concurrent scanners produce one success and one already checked in result', async () => {
    await seedEvent();
    const buyer = await createUser('scan-buyer@example.com');
    const admin = await createUser('scan-admin@example.com');
    const order = await placeOrder(buyer, 1);
    await paymentService.recordManualPayment(
      order.reference,
      {
        transactionReference: 'BANK-SCAN-001',
        amountVnd: order.totalAmountVnd,
        occurredAt: new Date().toISOString(),
      },
      admin,
      { repository: paymentRepository, withTransaction },
    );
    const qrPayload = (await pool.query(`SELECT qr_payload FROM tickets LIMIT 1`)).rows[0]
      .qr_payload;
    const firstRequestId = crypto.randomUUID();
    const results = await Promise.all([
      checkinService.scanTicket(
        { requestId: firstRequestId, qrToken: qrPayload, source: 'camera' },
        admin,
        { repository: checkinRepository, withTransaction, client: pool },
      ),
      checkinService.scanTicket(
        { requestId: crypto.randomUUID(), qrToken: qrPayload, source: 'usb' },
        admin,
        { repository: checkinRepository, withTransaction, client: pool },
      ),
    ]);
    assert.deepEqual(results.map((result) => result.result).toSorted(), [
      'already_checked_in',
      'success',
    ]);
    assert.equal(
      Number(
        (await pool.query(`SELECT COUNT(*) FROM ticket_events WHERE action='checked_in'`)).rows[0]
          .count,
      ),
      1,
    );
    const replay = await checkinService.scanTicket(
      { requestId: firstRequestId, qrToken: qrPayload, source: 'camera' },
      admin,
      { repository: checkinRepository, withTransaction, client: pool },
    );
    assert.equal(replay.result, results[0].result);
    assert.equal(
      Number(
        (
          await pool.query(`SELECT COUNT(*) FROM checkin_attempts WHERE request_id = $1`, [
            firstRequestId,
          ])
        ).rows[0].count,
      ),
      1,
    );
  });

  test('check-in remains available before and after the configured event time', async () => {
    await seedEvent({ capacity: 2, maximum: 2 });
    const buyer = await createUser('event-time-buyer@example.com');
    const operator = await createUser('event-time-operator@example.com');
    await placeOrder(buyer, 2, {}, { paymentsEnabled: false });
    const tickets = await pool.query(`SELECT ticket_code FROM tickets ORDER BY sequence_number`);

    await pool.query(
      `UPDATE event_settings SET event_starts_at = NOW() + INTERVAL '1 day' WHERE singleton_key = TRUE`,
    );
    const beforeEvent = await checkinService.manualCheckIn(
      { requestId: crypto.randomUUID(), ticketCode: tickets.rows[0].ticket_code },
      operator,
      { repository: checkinRepository, withTransaction, client: pool },
    );
    assert.equal(beforeEvent.result, 'success');

    await pool.query(
      `UPDATE event_settings SET event_starts_at = NOW() - INTERVAL '1 day' WHERE singleton_key = TRUE`,
    );
    const afterEvent = await checkinService.manualCheckIn(
      { requestId: crypto.randomUUID(), ticketCode: tickets.rows[1].ticket_code },
      operator,
      { repository: checkinRepository, withTransaction, client: pool },
    );
    assert.equal(afterEvent.result, 'success');
  });
}
