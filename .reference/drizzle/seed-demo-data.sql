-- ============================================================================
-- LOCOMOTIVATE DEMO DATA SEED FILE
-- Run this to populate the database with sample data for development/testing
-- ============================================================================

-- ============================================================================
-- TRAINERS (Users with trainer role)
-- ============================================================================

-- Insert trainer users (these would normally come from OAuth, but we seed for demo)
INSERT INTO users (openId, name, email, phone, role, active, createdAt, updatedAt, lastSignedIn) VALUES
('trainer_sarah_001', 'Sarah Kim', 'sarah.k@email.com', '+1 555-0101', 'trainer', true, NOW(), NOW(), NOW()),
('trainer_mike_002', 'Mike Johnson', 'mike.j@email.com', '+1 555-0102', 'trainer', true, NOW(), NOW(), NOW()),
('trainer_emily_003', 'Emily Chen', 'emily.c@email.com', '+1 555-0103', 'trainer', true, NOW(), NOW(), NOW()),
('trainer_david_004', 'David Park', 'david.p@email.com', '+1 555-0104', 'trainer', true, NOW(), NOW(), NOW()),
('trainer_lisa_005', 'Lisa Martinez', 'lisa.m@email.com', '+1 555-0105', 'trainer', true, NOW(), NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ============================================================================
-- TRAINER APPROVALS
-- ============================================================================

-- Approve existing trainers
INSERT INTO trainer_approvals (trainerId, status, applicationData, reviewedAt, createdAt, updatedAt)
SELECT id, 'approved', JSON_OBJECT(
  'specialties', JSON_ARRAY('strength', 'weight_loss'),
  'experience', '5 years',
  'certifications', JSON_ARRAY('NASM', 'ACE')
), NOW(), NOW(), NOW()
FROM users WHERE role = 'trainer' AND openId LIKE 'trainer_%'
ON DUPLICATE KEY UPDATE status = 'approved';

-- ============================================================================
-- CLIENTS
-- ============================================================================

-- Get first trainer ID for client assignment
SET @trainer1_id = (SELECT id FROM users WHERE openId = 'trainer_sarah_001' LIMIT 1);
SET @trainer2_id = (SELECT id FROM users WHERE openId = 'trainer_mike_002' LIMIT 1);

-- Insert clients for trainers
INSERT INTO clients (trainerId, name, email, phone, status, goals, notes, createdAt, updatedAt) VALUES
(@trainer1_id, 'John Doe', 'john.doe@email.com', '+1 555-1001', 'active', '["strength", "weight_loss"]', 'Focused on building lean muscle', NOW(), NOW()),
(@trainer1_id, 'Jane Smith', 'jane.smith@email.com', '+1 555-1002', 'active', '["weight_loss"]', 'Training for marathon', NOW(), NOW()),
(@trainer1_id, 'Alex Chen', 'alex.chen@email.com', '+1 555-1003', 'active', '["strength", "power"]', 'Competitive powerlifter', NOW(), NOW()),
(@trainer1_id, 'Maria Garcia', 'maria.g@email.com', '+1 555-1004', 'pending', '["longevity"]', 'New client - initial assessment pending', NOW(), NOW()),
(@trainer2_id, 'Robert Wilson', 'robert.w@email.com', '+1 555-1005', 'active', '["strength"]', 'Recovering from injury', NOW(), NOW()),
(@trainer2_id, 'Sarah Johnson', 'sarah.j@email.com', '+1 555-1006', 'active', '["weight_loss", "longevity"]', 'Senior fitness program', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ============================================================================
-- BUNDLE DRAFTS (Trainer bundles)
-- ============================================================================

INSERT INTO bundle_drafts (trainerId, title, description, price, cadence, status, servicesJson, productsJson, createdAt, updatedAt)
SELECT 
  id,
  'Strength Week 1',
  'Build muscle and increase strength with this comprehensive bundle including protein, creatine, and 4 training sessions.',
  149.99,
  'weekly',
  'published',
  '[{"type": "training", "quantity": 4, "duration": 60}, {"type": "check_in", "quantity": 2, "duration": 15}]',
  '[]',
  NOW(),
  NOW()
FROM users WHERE openId = 'trainer_sarah_001'
ON DUPLICATE KEY UPDATE title = VALUES(title);

INSERT INTO bundle_drafts (trainerId, title, description, price, cadence, status, servicesJson, productsJson, createdAt, updatedAt)
SELECT 
  id,
  'Weight Loss Accelerator',
  'Comprehensive weight loss program with nutrition guidance, fat burners, and weekly check-ins.',
  199.99,
  'monthly',
  'published',
  '[{"type": "training", "quantity": 8, "duration": 45}, {"type": "check_in", "quantity": 4, "duration": 15}, {"type": "plan_review", "quantity": 2, "duration": 30}]',
  '[]',
  NOW(),
  NOW()
FROM users WHERE openId = 'trainer_sarah_001'
ON DUPLICATE KEY UPDATE title = VALUES(title);

INSERT INTO bundle_drafts (trainerId, title, description, price, cadence, status, servicesJson, productsJson, createdAt, updatedAt)
SELECT 
  id,
  'Power Performance Pack',
  'Elite performance bundle for serious athletes. Includes premium supplements and intensive coaching.',
  299.99,
  'monthly',
  'draft',
  '[{"type": "training", "quantity": 12, "duration": 60}, {"type": "call", "quantity": 4, "duration": 30}]',
  '[]',
  NOW(),
  NOW()
FROM users WHERE openId = 'trainer_mike_002'
ON DUPLICATE KEY UPDATE title = VALUES(title);

INSERT INTO bundle_drafts (trainerId, title, description, price, cadence, status, servicesJson, productsJson, createdAt, updatedAt)
SELECT 
  id,
  'Longevity Essentials',
  'Focus on long-term health with vitamins, recovery supplements, and wellness coaching.',
  129.99,
  'monthly',
  'published',
  '[{"type": "training", "quantity": 4, "duration": 45}, {"type": "check_in", "quantity": 2, "duration": 15}]',
  '[]',
  NOW(),
  NOW()
FROM users WHERE openId = 'trainer_emily_003'
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- ============================================================================
-- SESSIONS (Training sessions)
-- ============================================================================

SET @client1_id = (SELECT id FROM clients WHERE email = 'john.doe@email.com' LIMIT 1);
SET @client2_id = (SELECT id FROM clients WHERE email = 'jane.smith@email.com' LIMIT 1);
SET @client3_id = (SELECT id FROM clients WHERE email = 'alex.chen@email.com' LIMIT 1);

-- Upcoming sessions
INSERT INTO sessions (clientId, trainerId, sessionDate, durationMinutes, sessionType, status, location, createdAt, updatedAt) VALUES
(@client1_id, @trainer1_id, DATE_ADD(NOW(), INTERVAL 1 DAY), 60, 'training', 'scheduled', 'Main Gym', NOW(), NOW()),
(@client1_id, @trainer1_id, DATE_ADD(NOW(), INTERVAL 3 DAY), 60, 'training', 'scheduled', 'Main Gym', NOW(), NOW()),
(@client2_id, @trainer1_id, DATE_ADD(NOW(), INTERVAL 1 DAY), 45, 'training', 'scheduled', 'Studio B', NOW(), NOW()),
(@client3_id, @trainer1_id, DATE_ADD(NOW(), INTERVAL 2 DAY), 30, 'check_in', 'scheduled', 'Virtual', NOW(), NOW()),
(@client1_id, @trainer1_id, DATE_ADD(NOW(), INTERVAL 4 DAY), 30, 'call', 'scheduled', 'Virtual', NOW(), NOW())
ON DUPLICATE KEY UPDATE sessionDate = VALUES(sessionDate);

-- Completed sessions (for history)
INSERT INTO sessions (clientId, trainerId, sessionDate, durationMinutes, sessionType, status, location, notes, createdAt, updatedAt) VALUES
(@client1_id, @trainer1_id, DATE_SUB(NOW(), INTERVAL 2 DAY), 60, 'training', 'completed', 'Main Gym', 'Great progress on squats', NOW(), NOW()),
(@client1_id, @trainer1_id, DATE_SUB(NOW(), INTERVAL 5 DAY), 60, 'training', 'completed', 'Main Gym', 'Increased bench press weight', NOW(), NOW()),
(@client2_id, @trainer1_id, DATE_SUB(NOW(), INTERVAL 3 DAY), 45, 'training', 'completed', 'Studio B', 'Cardio focus session', NOW(), NOW())
ON DUPLICATE KEY UPDATE sessionDate = VALUES(sessionDate);

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

SET @bundle1_id = (SELECT id FROM bundle_drafts WHERE title = 'Strength Week 1' LIMIT 1);
SET @bundle2_id = (SELECT id FROM bundle_drafts WHERE title = 'Weight Loss Accelerator' LIMIT 1);

INSERT INTO subscriptions (clientId, trainerId, bundleDraftId, status, subscriptionType, price, startDate, renewalDate, sessionsIncluded, sessionsUsed, createdAt, updatedAt) VALUES
(@client1_id, @trainer1_id, @bundle1_id, 'active', 'weekly', 149.99, DATE_SUB(NOW(), INTERVAL 14 DAY), DATE_ADD(NOW(), INTERVAL 7 DAY), 4, 2, NOW(), NOW()),
(@client2_id, @trainer1_id, @bundle2_id, 'active', 'monthly', 199.99, DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_ADD(NOW(), INTERVAL 10 DAY), 8, 3, NOW(), NOW()),
(@client3_id, @trainer1_id, @bundle1_id, 'active', 'weekly', 149.99, DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 7 DAY), 4, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- ============================================================================
-- ORDERS
-- ============================================================================

INSERT INTO orders (shopifyOrderId, shopifyOrderNumber, clientId, trainerId, customerEmail, customerName, totalAmount, subtotalAmount, taxAmount, status, fulfillmentStatus, paymentStatus, trackingNumber, trackingUrl, carrier, createdAt, updatedAt) VALUES
(1001, '#1001', @client1_id, @trainer1_id, 'john.doe@email.com', 'John Doe', 149.99, 139.99, 10.00, 'processing', 'unfulfilled', 'paid', NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 2 DAY), NOW()),
(1002, '#1002', @client2_id, @trainer1_id, 'jane.smith@email.com', 'Jane Smith', 199.99, 185.99, 14.00, 'shipped', 'fulfilled', 'paid', 'TRK123456789', 'https://track.example.com/TRK123456789', 'UPS', DATE_SUB(NOW(), INTERVAL 5 DAY), NOW()),
(1003, '#1003', @client3_id, @trainer1_id, 'alex.chen@email.com', 'Alex Chen', 299.99, 279.99, 20.00, 'delivered', 'fulfilled', 'paid', 'TRK987654321', 'https://track.example.com/TRK987654321', 'FedEx', DATE_SUB(NOW(), INTERVAL 10 DAY), NOW())
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- ============================================================================
-- ORDER ITEMS
-- ============================================================================

SET @order1_id = (SELECT id FROM orders WHERE shopifyOrderNumber = '#1001' LIMIT 1);
SET @order2_id = (SELECT id FROM orders WHERE shopifyOrderNumber = '#1002' LIMIT 1);
SET @order3_id = (SELECT id FROM orders WHERE shopifyOrderNumber = '#1003' LIMIT 1);

INSERT INTO order_items (orderId, name, quantity, price, totalPrice, fulfillmentStatus, createdAt) VALUES
(@order1_id, 'Strength Week 1 Bundle', 1, 149.99, 149.99, 'unfulfilled', NOW()),
(@order2_id, 'Weight Loss Accelerator Bundle', 1, 199.99, 199.99, 'fulfilled', NOW()),
(@order3_id, 'Power Performance Pack', 1, 299.99, 299.99, 'fulfilled', NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ============================================================================
-- MESSAGES (Conversations)
-- ============================================================================

SET @trainer_user_id = (SELECT id FROM users WHERE openId = 'trainer_sarah_001' LIMIT 1);

-- Create client users for messaging (if they don't exist)
INSERT INTO users (openId, name, email, role, active, createdAt, updatedAt, lastSignedIn) VALUES
('client_john_001', 'John Doe', 'john.doe@email.com', 'client', true, NOW(), NOW(), NOW()),
('client_jane_002', 'Jane Smith', 'jane.smith@email.com', 'client', true, NOW(), NOW(), NOW()),
('client_alex_003', 'Alex Chen', 'alex.chen@email.com', 'client', true, NOW(), NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name);

SET @client_john_user_id = (SELECT id FROM users WHERE openId = 'client_john_001' LIMIT 1);
SET @client_jane_user_id = (SELECT id FROM users WHERE openId = 'client_jane_002' LIMIT 1);

-- Conversation with John
INSERT INTO messages (senderId, receiverId, conversationId, content, messageType, createdAt) VALUES
(@client_john_user_id, @trainer_user_id, CONCAT('conv_', @trainer_user_id, '_', @client_john_user_id), 'Hi! I wanted to ask about my nutrition plan.', 'text', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(@trainer_user_id, @client_john_user_id, CONCAT('conv_', @trainer_user_id, '_', @client_john_user_id), 'Of course! What questions do you have?', 'text', DATE_SUB(NOW(), INTERVAL 118 MINUTE)),
(@client_john_user_id, @trainer_user_id, CONCAT('conv_', @trainer_user_id, '_', @client_john_user_id), 'Should I take the protein shake before or after workout?', 'text', DATE_SUB(NOW(), INTERVAL 115 MINUTE)),
(@trainer_user_id, @client_john_user_id, CONCAT('conv_', @trainer_user_id, '_', @client_john_user_id), 'Great question! For optimal results, I recommend taking it within 30 minutes after your workout. This helps with muscle recovery and protein synthesis.', 'text', DATE_SUB(NOW(), INTERVAL 110 MINUTE)),
(@client_john_user_id, @trainer_user_id, CONCAT('conv_', @trainer_user_id, '_', @client_john_user_id), 'Perfect, that makes sense. Thanks!', 'text', DATE_SUB(NOW(), INTERVAL 105 MINUTE))
ON DUPLICATE KEY UPDATE content = VALUES(content);

-- Conversation with Jane
INSERT INTO messages (senderId, receiverId, conversationId, content, messageType, createdAt) VALUES
(@client_jane_user_id, @trainer_user_id, CONCAT('conv_', @trainer_user_id, '_', @client_jane_user_id), 'Thanks for the session today!', 'text', DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(@trainer_user_id, @client_jane_user_id, CONCAT('conv_', @trainer_user_id, '_', @client_jane_user_id), 'You did great! Keep up the good work. See you Thursday!', 'text', DATE_SUB(NOW(), INTERVAL 25 MINUTE))
ON DUPLICATE KEY UPDATE content = VALUES(content);

-- ============================================================================
-- CALENDAR EVENTS
-- ============================================================================

INSERT INTO calendar_events (userId, title, description, startTime, endTime, eventType, relatedClientId, createdAt, updatedAt) VALUES
(@trainer_user_id, 'Training Session - John Doe', 'Strength training focus', DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 1 DAY), INTERVAL 60 MINUTE), 'session', @client1_id, NOW(), NOW()),
(@trainer_user_id, 'Training Session - Jane Smith', 'Cardio and core', DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 1 DAY), INTERVAL 45 MINUTE), 'session', @client2_id, NOW(), NOW()),
(@trainer_user_id, 'Check-in Call - Alex Chen', 'Weekly progress review', DATE_ADD(NOW(), INTERVAL 2 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 2 DAY), INTERVAL 30 MINUTE), 'session', @client3_id, NOW(), NOW()),
(@trainer_user_id, 'Product Delivery - John Doe', 'Protein bundle delivery', DATE_ADD(NOW(), INTERVAL 3 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 3 DAY), INTERVAL 15 MINUTE), 'delivery', @client1_id, NOW(), NOW())
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- ============================================================================
-- ACTIVITY LOGS
-- ============================================================================

INSERT INTO activity_logs (userId, action, entityType, entityId, details, createdAt) VALUES
(@trainer_user_id, 'bundle_published', 'bundle', @bundle1_id, '{"title": "Strength Week 1"}', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(@trainer_user_id, 'client_added', 'client', @client1_id, '{"name": "John Doe"}', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(@trainer_user_id, 'session_completed', 'session', 1, '{"client": "John Doe", "type": "training"}', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(@trainer_user_id, 'order_received', 'order', @order1_id, '{"amount": 149.99, "client": "John Doe"}', DATE_SUB(NOW(), INTERVAL 2 DAY))
ON DUPLICATE KEY UPDATE action = VALUES(action);

-- ============================================================================
-- BUNDLE TEMPLATES (Manager templates)
-- ============================================================================

INSERT INTO bundle_templates (title, description, goalType, basePrice, minPrice, maxPrice, defaultServices, defaultProducts, active, createdAt, updatedAt) VALUES
('Strength Builder', 'Build muscle and increase strength with this comprehensive template.', 'strength', 149.99, 99.99, 299.99, '[{"type": "training", "quantity": 4, "duration": 60}, {"type": "check_in", "quantity": 2, "duration": 15}]', '[]', true, NOW(), NOW()),
('Weight Loss Program', 'Comprehensive weight loss program with nutrition guidance.', 'weight_loss', 199.99, 149.99, 349.99, '[{"type": "training", "quantity": 8, "duration": 45}, {"type": "check_in", "quantity": 4, "duration": 15}]', '[]', true, NOW(), NOW()),
('Longevity Essentials', 'Focus on long-term health and wellness.', 'longevity', 129.99, 79.99, 199.99, '[{"type": "training", "quantity": 4, "duration": 45}, {"type": "plan_review", "quantity": 2, "duration": 30}]', '[]', true, NOW(), NOW()),
('Power Performance', 'Elite performance bundle for serious athletes.', 'power', 299.99, 199.99, 499.99, '[{"type": "training", "quantity": 12, "duration": 60}, {"type": "call", "quantity": 4, "duration": 30}]', '[]', true, NOW(), NOW())
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================
