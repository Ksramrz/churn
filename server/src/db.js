const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/roomvu';

const pool = new Pool({
  connectionString,
  ssl:
    process.env.NODE_ENV === 'production'
      ? {
          rejectUnauthorized: false
        }
      : false
});

const runMigrations = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      segment TEXT,
      subscription_start_date DATE,
      source_campaign TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cancellations (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      cancellation_date DATE NOT NULL,
      primary_reason TEXT NOT NULL,
      secondary_notes TEXT,
      usage_downloads INTEGER DEFAULT 0,
      usage_posts INTEGER DEFAULT 0,
      usage_logins INTEGER DEFAULT 0,
      usage_minutes INTEGER DEFAULT 0,
      days_on_platform INTEGER,
      closer_name TEXT,
      saved_flag BOOLEAN DEFAULT FALSE,
      saved_by TEXT,
      save_reason TEXT,
      save_notes TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      last_active_date DATE,
      engagement_level TEXT CHECK (engagement_level IN ('low', 'medium', 'high'))
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cancellations_customer_id ON cancellations(customer_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cancellations_reason ON cancellations(primary_reason);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cancellations_date ON cancellations(cancellation_date);`);
};

module.exports = {
  pool,
  runMigrations
};

