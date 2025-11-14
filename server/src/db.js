const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'roomvu.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const init = () => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      segment TEXT,
      subscription_start_date TEXT,
      source_campaign TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS cancellations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      cancellation_date TEXT NOT NULL,
      primary_reason TEXT NOT NULL,
      secondary_notes TEXT,
      usage_downloads INTEGER DEFAULT 0,
      usage_posts INTEGER DEFAULT 0,
      usage_logins INTEGER DEFAULT 0,
      usage_minutes INTEGER DEFAULT 0,
      days_on_platform INTEGER,
      closer_name TEXT,
      saved_flag INTEGER DEFAULT 0,
      saved_by TEXT,
      save_reason TEXT,
      save_notes TEXT,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      last_active_date TEXT,
      engagement_level TEXT CHECK(engagement_level IN ('low', 'medium', 'high')),
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_cancellations_customer_id
    ON cancellations(customer_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_cancellations_reason
    ON cancellations(primary_reason)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_cancellations_date
    ON cancellations(cancellation_date)
  `).run();
};

init();

module.exports = db;

