const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pool, closeDatabase } = require('../src/database/connection');
const { logger } = require('../src/config/logger');

/* eslint-disable no-await-in-loop -- Database migrations must be applied in filename order. */

const migrationsDirectory = path.resolve(__dirname, '../src/database/migrations');
const migrationLockId = 1_948_220_316;

async function run() {
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [migrationLockId]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const filenames = (await fs.readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith('.sql'))
      .toSorted();

    for (const filename of filenames) {
      const sql = await fs.readFile(path.join(migrationsDirectory, filename), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const existing = await client.query(
        'SELECT checksum FROM schema_migrations WHERE filename = $1',
        [filename],
      );

      if (existing.rowCount > 0) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Applied migration was modified: ${filename}`);
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [
          filename,
          checksum,
        ]);
        await client.query('COMMIT');
        logger.info({ filename }, 'Applied migration');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [migrationLockId]);
    client.release();
    await closeDatabase();
  }
}

run().catch((error) => {
  logger.fatal({ err: error }, 'Migration failed');
  process.exitCode = 1;
});
