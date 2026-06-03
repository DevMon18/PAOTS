-- PAOTS Database Schema v1
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE order_status AS ENUM ('received', 'designing', 'printing', 'ready', 'collected');
CREATE TYPE user_role AS ENUM ('staff', 'designer', 'manager');
CREATE TYPE payment_method_type AS ENUM ('cash', 'ewallet');
CREATE TYPE payment_status_type AS ENUM ('downpayment', 'partial', 'paid_full');

-- =============================================
-- CUSTOMERS
-- =============================================
CREATE TABLE customers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  email        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_name ON customers USING gin(to_tsvector('simple', name));
CREATE INDEX idx_customers_contact ON customers(contact_number);

-- =============================================
-- USERS (linked to Supabase Auth)
-- =============================================
CREATE TABLE users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT NOT NULL UNIQUE,
  role       user_role NOT NULL DEFAULT 'staff',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PRICING RULES
-- =============================================
CREATE TABLE pricing_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type        TEXT NOT NULL,
  material_type   TEXT NOT NULL,
  price_per_sqm   NUMERIC(10,2) NOT NULL,
  min_quantity    INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_type, material_type)
);

-- Insert default sample pricing rules
INSERT INTO pricing_rules (job_type, material_type, price_per_sqm, min_quantity) VALUES
  ('Tarpaulin',    'Standard',  120.00, 1),
  ('Tarpaulin',    'Premium',   160.00, 1),
  ('Tarpaulin',    'Backlit',   250.00, 1),
  ('Jersey',       'Standard',  300.00, 1),
  ('Jersey',       'Premium',   450.00, 1),
  ('Sticker',      'Glossy',    180.00, 1),
  ('Sticker',      'Matte',     200.00, 1),
  ('Sintra Board', 'Standard',  350.00, 1),
  ('Intra-board',  'Standard',  220.00, 1),
  ('Canvas Print', 'Standard',  280.00, 1);

-- =============================================
-- ORDERS
-- =============================================
CREATE TABLE orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id           TEXT NOT NULL UNIQUE,
  customer_id           UUID NOT NULL REFERENCES customers(id),
  created_by            UUID NOT NULL REFERENCES users(id),
  job_type              TEXT NOT NULL,
  dimensions            TEXT NOT NULL,
  width_m               NUMERIC(8,3) NOT NULL,
  height_m              NUMERIC(8,3) NOT NULL,
  material_type         TEXT NOT NULL,
  quantity              INTEGER NOT NULL CHECK (quantity >= 1),
  total_cost            NUMERIC(10,2) NOT NULL CHECK (total_cost >= 0),
  downpayment_amount    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (downpayment_amount >= 0),
  balance_due           NUMERIC(10,2) NOT NULL CHECK (balance_due >= 0),
  payment_status        payment_status_type NOT NULL DEFAULT 'downpayment',
  status                order_status NOT NULL DEFAULT 'received',
  estimated_pickup_date DATE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_tracking ON orders(tracking_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
-- Full-text search index via customer name (handled by join)

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- PAYMENTS
-- =============================================
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method  payment_method_type NOT NULL,
  ewallet_ref     TEXT,
  payment_status  payment_status_type NOT NULL,
  recorded_by     UUID NOT NULL REFERENCES users(id),
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  is_voided       BOOLEAN NOT NULL DEFAULT FALSE,
  voided_by       UUID REFERENCES users(id),
  void_reason     TEXT,
  voided_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_date ON payments(transaction_date DESC);

-- =============================================
-- FILE ATTACHMENTS
-- =============================================
CREATE TABLE file_attachments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  stored_filename   TEXT NOT NULL,
  storage_path      TEXT NOT NULL,
  file_size_bytes   BIGINT NOT NULL,
  file_format       TEXT NOT NULL,
  uploaded_by       UUID NOT NULL REFERENCES users(id),
  uploaded_at       TIMESTAMPTZ DEFAULT NOW(),
  checksum          TEXT
);

CREATE INDEX idx_files_order ON file_attachments(order_id);

-- =============================================
-- STATUS HISTORY
-- =============================================
CREATE TABLE status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status  TEXT,
  new_status  TEXT NOT NULL,
  changed_by  UUID NOT NULL REFERENCES users(id),
  changed_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_status_history_order ON status_history(order_id);

-- =============================================
-- INVENTORY
-- =============================================
CREATE TABLE inventory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_type   TEXT NOT NULL UNIQUE,
  current_stock   NUMERIC(10,2) NOT NULL DEFAULT 0,
  threshold_level NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit            TEXT NOT NULL DEFAULT 'units',
  last_updated    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- AUDIT LOG
-- =============================================
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id),
  action       TEXT NOT NULL,
  target_table TEXT,
  target_id    UUID,
  details      JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
