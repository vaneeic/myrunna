/**
 * Migration runner — executes raw SQL migration files in order.
 * Run with: npx ts-node src/db/migrate.ts
 * or: npm run db:migrate
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
  });

  const client = await pool.connect();

  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    // Get already-executed migrations
    const { rows: executedMigrations } = await client.query(
      'SELECT filename FROM schema_migrations ORDER BY filename',
    );
    const executed = new Set(executedMigrations.map((r) => r.filename));

    // Get all migration files, sorted
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let applied = 0;
    for (const file of files) {
      if (executed.has(file)) {
        console.log(`  [skip] ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file],
        );
        await client.query('COMMIT');
        console.log(`  [ok]   ${file}`);
        applied++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  [fail] ${file}:`, err);
        throw err;
      }
    }

    if (applied === 0) {
      console.log('Database is up to date — no migrations to apply.');
    } else {
      console.log(`Applied ${applied} migration(s) successfully.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// Only run directly when executed as a script (not imported)
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
