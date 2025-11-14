import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'finance.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    loan_amount REAL NOT NULL,
    weekly_amount REAL NOT NULL,
    balance REAL NOT NULL,
    start_date TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'closed', 'defaulted')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_date TEXT NOT NULL,
    weeks_covered REAL NOT NULL,
    week_number INTEGER NOT NULL,
    balance_after REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_loans_customer ON loans(customer_id);
  CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
  CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);
  CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
`);

console.log('Database initialized successfully!');

export default db;
