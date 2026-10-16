function getDefaultPool() {
  return require('../../database/connection').pool;
}

async function upsertGoogleUser(identity, client = getDefaultPool()) {
  const result = await client.query(
    `
      INSERT INTO users (google_sub, email, email_verified, display_name, avatar_url)
      VALUES ($1, $2, TRUE, $3, $4)
      ON CONFLICT (google_sub) DO UPDATE SET
        email = EXCLUDED.email,
        email_verified = TRUE,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW()
      RETURNING id, email, display_name, avatar_url
    `,
    [identity.sub, identity.email.toLowerCase(), identity.name ?? null, identity.picture ?? null],
  );

  return result.rows[0];
}

module.exports = { upsertGoogleUser };
