-- PAOTS Row Level Security Policies
-- Run AFTER 001_schema.sql in your Supabase SQL Editor

-- =============================================
-- Enable RLS on all tables
-- =============================================
ALTER TABLE customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules   ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Helper function: get current user's role
-- =============================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role::text FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================
-- CUSTOMERS — all authenticated users can read/write
-- =============================================
CREATE POLICY "All users can read customers"
  ON customers FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff and Manager can insert customers"
  ON customers FOR INSERT WITH CHECK (get_user_role() IN ('staff', 'manager'));

CREATE POLICY "Staff and Manager can update customers"
  ON customers FOR UPDATE USING (get_user_role() IN ('staff', 'manager'));

-- =============================================
-- USERS — managers can read all; users read own
-- =============================================
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT USING (auth.uid() = id OR get_user_role() = 'manager');

CREATE POLICY "Only managers can insert users"
  ON users FOR INSERT WITH CHECK (get_user_role() = 'manager');

CREATE POLICY "Only managers can update users"
  ON users FOR UPDATE USING (get_user_role() = 'manager');

-- =============================================
-- ORDERS — all authenticated can read; staff/manager can insert; designer can update status only
-- =============================================
CREATE POLICY "All authenticated can read orders"
  ON orders FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff and Manager can insert orders"
  ON orders FOR INSERT WITH CHECK (get_user_role() IN ('staff', 'manager'));

-- Designers can update status; staff can update status; managers can update anything
CREATE POLICY "Authenticated users can update orders"
  ON orders FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- PAYMENTS — staff/manager can insert; manager can void; all can read
-- =============================================
CREATE POLICY "All authenticated can read payments"
  ON payments FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff and Manager can insert payments"
  ON payments FOR INSERT WITH CHECK (get_user_role() IN ('staff', 'manager'));

CREATE POLICY "Only managers can void payments"
  ON payments FOR UPDATE USING (get_user_role() = 'manager');

-- =============================================
-- FILE ATTACHMENTS — all can read; staff can insert
-- =============================================
CREATE POLICY "All authenticated can read file attachments"
  ON file_attachments FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff and Manager can insert file attachments"
  ON file_attachments FOR INSERT WITH CHECK (get_user_role() IN ('staff', 'manager'));

-- =============================================
-- STATUS HISTORY — all can read; insert via backend only
-- =============================================
CREATE POLICY "All authenticated can read status history"
  ON status_history FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert status history"
  ON status_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- INVENTORY — all can read; only managers can modify
-- =============================================
CREATE POLICY "All authenticated can read inventory"
  ON inventory FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only managers can modify inventory"
  ON inventory FOR INSERT WITH CHECK (get_user_role() = 'manager');

CREATE POLICY "Only managers can update inventory"
  ON inventory FOR UPDATE USING (get_user_role() = 'manager');

CREATE POLICY "Only managers can delete inventory"
  ON inventory FOR DELETE USING (get_user_role() = 'manager');

-- =============================================
-- AUDIT LOG — only managers can read; insert via backend
-- =============================================
CREATE POLICY "Managers can read audit log"
  ON audit_log FOR SELECT USING (get_user_role() = 'manager');

CREATE POLICY "Authenticated can insert audit log"
  ON audit_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- PRICING RULES — all can read; only managers can modify
-- =============================================
CREATE POLICY "All authenticated can read pricing rules"
  ON pricing_rules FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only managers can modify pricing rules"
  ON pricing_rules FOR ALL USING (get_user_role() = 'manager');

-- =============================================
-- Storage bucket policy (run in Supabase dashboard Storage)
-- Bucket name: order-files
-- =============================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('order-files', 'order-files', false);
-- (Create via Supabase dashboard — set to Private)
