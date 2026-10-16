const { pool } = require('../../database/connection');

const publicColumns = `
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
  sales_status,
  NOW() AS database_now,
  GREATEST(
    total_capacity::BIGINT - COALESCE((
      SELECT SUM(quantity)
      FROM inventory_reservations
      WHERE state IN ('review_hold', 'consumed')
         OR (state = 'active' AND expires_at > NOW())
    ), 0),
    0
  ) AS remaining_quantity
`;

async function findCurrentEventSettings(client = pool) {
  const result = await client.query(`
    SELECT ${publicColumns}
    FROM event_settings
    WHERE singleton_key = TRUE
    LIMIT 1
  `);

  return result.rows[0] ?? null;
}

async function listPublicPartners(client = pool) {
  const result = await client.query(`
    SELECT id, name, logo_url, logo_data IS NOT NULL AS has_logo_data, website_url, sort_order
    FROM event_partners
    WHERE active = TRUE
    ORDER BY sort_order, created_at, id
  `);
  return result.rows;
}

async function getPartnerLogo(id, client = pool) {
  const result = await client.query(
    `SELECT logo_data, logo_mime FROM event_partners WHERE id = $1 AND logo_data IS NOT NULL`,
    [id],
  );
  return result.rows[0] ?? null;
}

module.exports = { findCurrentEventSettings, listPublicPartners, getPartnerLogo };
