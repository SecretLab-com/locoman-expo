-- ============================================================================
-- ENABLE SUPABASE REALTIME
-- Adds key tables to the supabase_realtime publication so row-level
-- changes are pushed to subscribed clients via WebSocket.
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE bundle_drafts;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE payment_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE product_deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE user_invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE collections;
