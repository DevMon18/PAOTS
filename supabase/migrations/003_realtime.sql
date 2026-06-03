-- PAOTS Realtime Subscriptions
-- Run AFTER 001_schema.sql in your Supabase SQL Editor

-- Enable realtime for orders and status_history tables
-- (The React frontend subscribes to these for live updates)

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE status_history;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
