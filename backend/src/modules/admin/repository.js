const { pool } = require('../../database/connection');

async function syncConfiguredAdmin(userId, email, configuredEmails, client = pool) {
  const isConfigured = configuredEmails.includes(email.toLowerCase());

  if (isConfigured) {
    await client.query(
      `
        INSERT INTO admin_permissions (user_id, role)
        VALUES ($1, 'super_admin')
        ON CONFLICT (user_id, role) DO NOTHING
      `,
      [userId],
    );
    await client.query(`DELETE FROM admin_permissions WHERE user_id = $1 AND role = 'admin'`, [
      userId,
    ]);
  } else {
    await client.query(
      `DELETE FROM admin_permissions WHERE user_id = $1 AND role = 'super_admin'`,
      [userId],
    );
  }

  await client.query(`UPDATE staff_role_grants SET user_id = $1 WHERE email = LOWER($2)`, [
    userId,
    email,
  ]);
  await client.query(
    `
      INSERT INTO admin_permissions (user_id, role, granted_by)
      SELECT $1, role, created_by
      FROM staff_role_grants
      WHERE email = LOWER($2)
      ON CONFLICT (user_id, role) DO NOTHING
    `,
    [userId, email],
  );

  return isConfigured;
}

async function hasAdminPermission(userId, client = pool) {
  const result = await client.query(
    `SELECT EXISTS(
      SELECT 1 FROM admin_permissions WHERE user_id = $1 AND role IN ('admin', 'super_admin')
    ) AS is_admin`,
    [userId],
  );
  return result.rows[0].is_admin;
}

async function getUserRoles(userId, client = pool) {
  const result = await client.query(
    `SELECT role FROM admin_permissions WHERE user_id = $1 ORDER BY role`,
    [userId],
  );
  return result.rows.map((row) => row.role);
}

async function hasSuperAdminPermission(userId, client = pool) {
  const result = await client.query(
    `SELECT EXISTS(
      SELECT 1 FROM admin_permissions WHERE user_id = $1 AND role = 'super_admin'
    ) AS allowed`,
    [userId],
  );
  return result.rows[0].allowed;
}

async function listStaff(configuredEmails, client = pool) {
  const grants = await client.query(`
    SELECT srg.id, srg.email, srg.role, srg.user_id, srg.created_at,
           u.display_name, (u.id IS NOT NULL) AS active
    FROM staff_role_grants srg
    LEFT JOIN users u ON u.id = srg.user_id
    ORDER BY srg.email, srg.role
  `);
  return {
    bootstrapSuperAdmins: configuredEmails,
    grants: grants.rows,
  };
}

async function createStaffGrant(client, grant) {
  const result = await client.query(
    `
      INSERT INTO staff_role_grants (email, role, user_id, created_by)
      VALUES (
        LOWER($1), $2,
        (SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1),
        $3
      )
      RETURNING *
    `,
    [grant.email, grant.role, grant.createdBy],
  );
  const row = result.rows[0];
  if (row.user_id) {
    await client.query(
      `
        INSERT INTO admin_permissions (user_id, role, granted_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, role) DO NOTHING
      `,
      [row.user_id, row.role, grant.createdBy],
    );
  }
  return row;
}

async function deleteStaffGrant(client, grantId) {
  const result = await client.query(`DELETE FROM staff_role_grants WHERE id = $1 RETURNING *`, [
    grantId,
  ]);
  const row = result.rows[0] ?? null;
  if (row?.user_id) {
    await client.query(`DELETE FROM admin_permissions WHERE user_id = $1 AND role = $2`, [
      row.user_id,
      row.role,
    ]);
  }
  return row;
}

async function insertAdminAudit(client, event) {
  await client.query(
    `
      INSERT INTO admin_audit_events (
        actor_user_id, action, entity_type, entity_id, reason, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      event.actorUserId,
      event.action,
      event.entityType,
      event.entityId ?? null,
      event.reason ?? null,
      event.metadata ?? {},
    ],
  );
}

async function hasCheckInPermission(userId, client = pool) {
  const result = await client.query(
    `SELECT EXISTS(
      SELECT 1 FROM admin_permissions
      WHERE user_id = $1 AND role IN ('check_in', 'admin', 'super_admin')
    ) AS allowed`,
    [userId],
  );
  return result.rows[0].allowed;
}

async function getAdminDashboard(client = pool) {
  const summary = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending_payment' AND expires_at > NOW())::INTEGER AS pending_orders,
      COUNT(*) FILTER (WHERE status = 'paid')::INTEGER AS paid_orders,
      COUNT(*) FILTER (WHERE status = 'payment_review')::INTEGER AS review_orders,
      COUNT(*) FILTER (WHERE status = 'refund_pending')::INTEGER AS refund_pending_orders,
      COUNT(*) FILTER (WHERE status = 'expired')::INTEGER AS expired_orders,
      (SELECT COALESCE(SUM(quantity), 0)::INTEGER FROM inventory_reservations WHERE state IN ('active', 'review_hold')) AS reserved_tickets,
      (SELECT COALESCE(SUM(quantity), 0)::INTEGER FROM inventory_reservations WHERE state = 'consumed') AS sold_tickets,
      (SELECT COUNT(*)::INTEGER FROM tickets WHERE status = 'valid') AS valid_tickets,
      (SELECT COUNT(*)::INTEGER FROM tickets WHERE status = 'checked_in') AS checked_in_tickets,
      (SELECT COUNT(*)::INTEGER FROM tickets WHERE status = 'void') AS void_tickets,
      (SELECT COUNT(*)::INTEGER FROM tickets WHERE status = 'refunded') AS refunded_tickets,
      (SELECT COALESCE(SUM(amount_vnd), 0)::BIGINT FROM payment_transactions WHERE direction = 'credit' AND match_status = 'matched') AS gross_revenue_vnd,
      (SELECT COALESCE(SUM(amount_vnd), 0)::BIGINT FROM payment_transactions WHERE direction = 'debit' AND match_status = 'matched') AS refunded_revenue_vnd
    FROM orders
  `);

  const trend = await client.query(`
    WITH days AS (
      SELECT generate_series(
        (CURRENT_DATE - INTERVAL '13 days')::DATE,
        CURRENT_DATE,
        INTERVAL '1 day'
      )::DATE AS day
    ), order_counts AS (
      SELECT (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE AS day,
             COUNT(*)::INTEGER AS orders
      FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '13 days'
      GROUP BY 1
    ), revenues AS (
      SELECT (occurred_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE AS day,
             COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_vnd ELSE -amount_vnd END), 0)::BIGINT AS revenue
      FROM payment_transactions
      WHERE match_status = 'matched' AND occurred_at >= CURRENT_DATE - INTERVAL '13 days'
      GROUP BY 1
    )
    SELECT days.day, COALESCE(order_counts.orders, 0)::INTEGER AS orders,
           COALESCE(revenues.revenue, 0)::BIGINT AS revenue_vnd
    FROM days
    LEFT JOIN order_counts USING (day)
    LEFT JOIN revenues USING (day)
    ORDER BY days.day
  `);

  const reviewOrders = await client.query(`
    SELECT order_code, buyer_name, total_amount_vnd, updated_at
    FROM orders WHERE status IN ('payment_review', 'refund_pending')
    ORDER BY updated_at DESC LIMIT 6
  `);

  const recentCheckIns = await client.query(`
    SELECT ca.result, ca.occurred_at, t.ticket_code, u.email AS operator_email
    FROM checkin_attempts ca
    LEFT JOIN tickets t ON t.id = ca.ticket_id
    JOIN users u ON u.id = ca.operator_user_id
    ORDER BY ca.occurred_at DESC LIMIT 8
  `);

  const administrators = await client.query(`
    SELECT DISTINCT u.email
    FROM admin_permissions ap
    JOIN users u ON u.id = ap.user_id
    WHERE ap.role IN ('admin', 'super_admin')
    ORDER BY u.email
  `);

  return {
    summary: summary.rows[0],
    trend: trend.rows,
    reviewOrders: reviewOrders.rows,
    recentCheckIns: recentCheckIns.rows,
    activeAdminEmails: administrators.rows.map((row) => row.email),
  };
}

async function lockEventSettings(client) {
  const result = await client.query(`
    SELECT * FROM event_settings WHERE singleton_key = TRUE FOR UPDATE
  `);
  return result.rows[0] ?? null;
}

async function getReservedQuantity(client) {
  const result = await client.query(`
    SELECT COALESCE(SUM(quantity), 0)::INTEGER AS reserved_quantity
    FROM inventory_reservations
    WHERE state IN ('active', 'review_hold', 'consumed')
  `);
  return result.rows[0].reserved_quantity;
}

async function updateEventSettings(client, settings) {
  await client.query(
    `
      UPDATE event_settings
      SET
        event_name = $1,
        event_subtitle = $2,
        venue = $3,
        event_starts_at = $4,
        ticket_price_vnd = $5,
        total_capacity = $6,
        min_tickets_per_order = $7,
        max_tickets_per_order = $8,
        sales_start_at = $9,
        sales_end_at = $10,
        reservation_minutes = $11,
        sales_status = $12,
        updated_at = NOW()
      WHERE singleton_key = TRUE
    `,
    [
      settings.eventName,
      settings.eventSubtitle,
      settings.venue,
      settings.eventStartsAt,
      settings.ticketPriceVnd,
      settings.totalCapacity,
      settings.minTicketsPerOrder,
      settings.maxTicketsPerOrder,
      settings.salesStartAt,
      settings.salesEndAt,
      settings.reservationMinutes,
      settings.salesStatus,
    ],
  );
}

async function listPartners(client = pool) {
  const result = await client.query(`
    SELECT id, name, logo_url, logo_data IS NOT NULL AS has_logo_data,
           website_url, sort_order, active, created_at, updated_at
    FROM event_partners
    ORDER BY sort_order, created_at, id
  `);
  return result.rows;
}

async function createPartner(client, partner) {
  const result = await client.query(
    `INSERT INTO event_partners (
       name, logo_url, logo_data, logo_mime, website_url, sort_order, active
     ) VALUES ($1, NULLIF($2, ''), $3, $4, NULLIF($5, ''), $6, $7)
     RETURNING *`,
    [
      partner.name,
      partner.logoUrl ?? '',
      partner.logoData,
      partner.logoMime,
      partner.websiteUrl ?? '',
      partner.sortOrder,
      partner.active,
    ],
  );
  return result.rows[0];
}

async function updatePartner(client, id, partner) {
  const result = await client.query(
    `UPDATE event_partners
     SET name = $2,
         logo_url = CASE WHEN $3::BYTEA IS NULL THEN logo_url ELSE NULL END,
         logo_data = COALESCE($3, logo_data),
         logo_mime = COALESCE($4, logo_mime),
         website_url = NULLIF($5, ''), sort_order = $6,
         active = $7, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      partner.name,
      partner.logoData,
      partner.logoMime,
      partner.websiteUrl ?? '',
      partner.sortOrder,
      partner.active,
    ],
  );
  return result.rows[0] ?? null;
}

async function deletePartner(client, id) {
  const result = await client.query(`DELETE FROM event_partners WHERE id = $1 RETURNING *`, [id]);
  return result.rows[0] ?? null;
}

async function getPartnerLogo(id, client = pool) {
  const result = await client.query(
    `SELECT logo_data, logo_mime FROM event_partners WHERE id = $1 AND logo_data IS NOT NULL`,
    [id],
  );
  return result.rows[0] ?? null;
}

module.exports = {
  syncConfiguredAdmin,
  hasAdminPermission,
  hasCheckInPermission,
  getUserRoles,
  hasSuperAdminPermission,
  getAdminDashboard,
  lockEventSettings,
  getReservedQuantity,
  updateEventSettings,
  listStaff,
  createStaffGrant,
  deleteStaffGrant,
  insertAdminAudit,
  listPartners,
  createPartner,
  updatePartner,
  deletePartner,
  getPartnerLogo,
};
