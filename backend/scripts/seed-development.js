const { z } = require('zod');
const { pool, closeDatabase } = require('../src/database/connection');
const { logger } = require('../src/config/logger');

const seedSchema = z
  .object({
    SEED_EVENT_NAME: z.string().min(1),
    SEED_EVENT_SUBTITLE: z.string().min(1),
    SEED_EVENT_VENUE: z.string().min(1),
    SEED_EVENT_STARTS_AT: z.string().datetime({ offset: true }),
    SEED_TICKET_PRICE_VND: z.coerce.number().int().positive(),
    SEED_TOTAL_CAPACITY: z.coerce.number().int().positive(),
    SEED_MIN_TICKETS_PER_ORDER: z.coerce.number().int().positive(),
    SEED_MAX_TICKETS_PER_ORDER: z.coerce.number().int().positive(),
    SEED_SALES_START_AT: z.string().datetime({ offset: true }),
    SEED_SALES_END_AT: z.string().datetime({ offset: true }),
    SEED_RESERVATION_MINUTES: z.coerce.number().int().min(1).max(1440),
  })
  .refine((data) => data.SEED_MAX_TICKETS_PER_ORDER >= data.SEED_MIN_TICKETS_PER_ORDER, {
    message: 'Maximum tickets per order must be at least the minimum.',
  })
  .refine((data) => data.SEED_MAX_TICKETS_PER_ORDER <= data.SEED_TOTAL_CAPACITY, {
    message: 'Maximum tickets per order cannot exceed total capacity.',
  });

async function seed() {
  const values = seedSchema.parse(process.env);

  await pool.query(
    `
      INSERT INTO event_settings (
        singleton_key,
        event_name,
        event_subtitle,
        venue,
        event_starts_at,
        ticket_price_vnd,
        total_capacity,
        min_tickets_per_order,
        max_tickets_per_order,
        sales_start_at,
        sales_end_at,
        reservation_minutes,
        sales_status
      )
      VALUES (TRUE, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'paused')
      ON CONFLICT (singleton_key) DO UPDATE SET
        event_name = EXCLUDED.event_name,
        event_subtitle = EXCLUDED.event_subtitle,
        venue = EXCLUDED.venue,
        event_starts_at = EXCLUDED.event_starts_at,
        ticket_price_vnd = EXCLUDED.ticket_price_vnd,
        total_capacity = EXCLUDED.total_capacity,
        min_tickets_per_order = EXCLUDED.min_tickets_per_order,
        max_tickets_per_order = EXCLUDED.max_tickets_per_order,
        sales_start_at = EXCLUDED.sales_start_at,
        sales_end_at = EXCLUDED.sales_end_at,
        reservation_minutes = EXCLUDED.reservation_minutes,
        updated_at = NOW()
    `,
    [
      values.SEED_EVENT_NAME,
      values.SEED_EVENT_SUBTITLE,
      values.SEED_EVENT_VENUE,
      values.SEED_EVENT_STARTS_AT,
      values.SEED_TICKET_PRICE_VND,
      values.SEED_TOTAL_CAPACITY,
      values.SEED_MIN_TICKETS_PER_ORDER,
      values.SEED_MAX_TICKETS_PER_ORDER,
      values.SEED_SALES_START_AT,
      values.SEED_SALES_END_AT,
      values.SEED_RESERVATION_MINUTES,
    ],
  );

  logger.info('Development event settings seeded with sales paused');
}

seed()
  .catch((error) => {
    logger.fatal({ err: error }, 'Development seed failed');
    process.exitCode = 1;
  })
  .finally(closeDatabase);
