-- ============================================================================
-- SEED DATA: Trainers and Related Data
-- Run this SQL to populate the database with sample trainers for development
-- ============================================================================

-- Insert sample trainers into users table
-- Note: openId values are generated UUIDs for demo purposes
INSERT INTO users (openId, name, email, phone, role, active, metadata, createdAt) VALUES
('trainer-sarah-kim-001', 'Sarah Kim', 'sarah.k@email.com', '+1 (555) 123-4567', 'trainer', true, 
 '{"bio": "Certified personal trainer with 5+ years of experience specializing in strength training and weight loss programs.", "specialties": ["Strength Training", "Weight Loss", "HIIT"]}', 
 '2023-06-15 10:00:00'),
('trainer-mike-johnson-002', 'Mike Johnson', 'mike.j@email.com', '+1 (555) 234-5678', 'trainer', true,
 '{"bio": "Sports performance coach focused on athletic development and injury prevention.", "specialties": ["Sports Performance", "Injury Prevention", "Mobility"]}',
 '2023-08-20 10:00:00'),
('trainer-emily-chen-003', 'Emily Chen', 'emily.c@email.com', '+1 (555) 345-6789', 'trainer', true,
 '{"bio": "Holistic wellness coach combining fitness, nutrition, and mindfulness for total body transformation.", "specialties": ["Holistic Wellness", "Nutrition", "Yoga"]}',
 '2023-04-10 10:00:00'),
('trainer-james-wilson-006', 'James Wilson', 'james.w@email.com', '+1 (555) 678-9012', 'trainer', false,
 '{"bio": "Former competitive bodybuilder turned personal trainer.", "specialties": ["Bodybuilding", "Muscle Gain"]}',
 '2023-10-05 10:00:00')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Insert trainer approval records
-- First, get the trainer IDs we just inserted
INSERT INTO trainer_approvals (trainerId, status, applicationData, reviewedAt, createdAt)
SELECT u.id, 'approved', '{"certifications": ["NASM-CPT", "ACE"], "experience_years": 5}', NOW(), u.createdAt
FROM users u WHERE u.openId = 'trainer-sarah-kim-001'
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO trainer_approvals (trainerId, status, applicationData, reviewedAt, createdAt)
SELECT u.id, 'approved', '{"certifications": ["CSCS", "USAW"], "experience_years": 4}', NOW(), u.createdAt
FROM users u WHERE u.openId = 'trainer-mike-johnson-002'
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO trainer_approvals (trainerId, status, applicationData, reviewedAt, createdAt)
SELECT u.id, 'approved', '{"certifications": ["RYT-500", "PN1"], "experience_years": 6}', NOW(), u.createdAt
FROM users u WHERE u.openId = 'trainer-emily-chen-003'
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO trainer_approvals (trainerId, status, applicationData, reviewNotes, reviewedAt, createdAt)
SELECT u.id, 'suspended', '{"certifications": ["NASM-CPT"], "experience_years": 3}', 'Account suspended due to policy violation', NOW(), u.createdAt
FROM users u WHERE u.openId = 'trainer-james-wilson-006'
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Insert pending trainer applications
INSERT INTO users (openId, name, email, phone, role, active, metadata, createdAt) VALUES
('trainer-alex-thompson-004', 'Alex Thompson', 'alex.t@email.com', '+1 (555) 456-7890', 'trainer', true,
 '{"bio": "Aspiring fitness coach with passion for helping beginners.", "specialties": ["Beginner Fitness", "Weight Loss"]}',
 '2024-01-14 10:00:00'),
('trainer-maria-garcia-005', 'Maria Garcia', 'maria.g@email.com', '+1 (555) 567-8901', 'trainer', true,
 '{"bio": "Former dancer transitioning to personal training.", "specialties": ["Dance Fitness", "Flexibility"]}',
 '2024-01-13 10:00:00')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO trainer_approvals (trainerId, status, applicationData, createdAt)
SELECT u.id, 'pending', '{"certifications": ["ACE-CPT"], "experience_years": 1}', u.createdAt
FROM users u WHERE u.openId = 'trainer-alex-thompson-004'
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO trainer_approvals (trainerId, status, applicationData, createdAt)
SELECT u.id, 'pending', '{"certifications": ["AFAA"], "experience_years": 2}', u.createdAt
FROM users u WHERE u.openId = 'trainer-maria-garcia-005'
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Insert sample clients for active trainers
INSERT INTO clients (trainerId, name, email, phone, goals, status, createdAt)
SELECT u.id, 'John Smith', 'john.s@email.com', '+1 (555) 111-1111', '["weight_loss", "strength"]', 'active', NOW()
FROM users u WHERE u.openId = 'trainer-sarah-kim-001'
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO clients (trainerId, name, email, phone, goals, status, createdAt)
SELECT u.id, 'Jane Doe', 'jane.d@email.com', '+1 (555) 222-2222', '["strength", "endurance"]', 'active', NOW()
FROM users u WHERE u.openId = 'trainer-sarah-kim-001'
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO clients (trainerId, name, email, phone, goals, status, createdAt)
SELECT u.id, 'Bob Wilson', 'bob.w@email.com', '+1 (555) 333-3333', '["sports_performance"]', 'active', NOW()
FROM users u WHERE u.openId = 'trainer-mike-johnson-002'
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Insert sample bundle drafts for trainers
INSERT INTO bundle_drafts (trainerId, title, description, price, cadence, status, createdAt)
SELECT u.id, '12-Week Strength Builder', 'Complete strength training program with progressive overload', 299.00, 'monthly', 'published', NOW()
FROM users u WHERE u.openId = 'trainer-sarah-kim-001'
ON DUPLICATE KEY UPDATE title = VALUES(title);

INSERT INTO bundle_drafts (trainerId, title, description, price, cadence, status, createdAt)
SELECT u.id, 'Fat Loss Accelerator', 'High-intensity program designed for rapid fat loss', 199.00, 'monthly', 'published', NOW()
FROM users u WHERE u.openId = 'trainer-sarah-kim-001'
ON DUPLICATE KEY UPDATE title = VALUES(title);

INSERT INTO bundle_drafts (trainerId, title, description, price, cadence, status, createdAt)
SELECT u.id, 'Athletic Performance Pro', 'Sports-specific training for competitive athletes', 349.00, 'monthly', 'published', NOW()
FROM users u WHERE u.openId = 'trainer-mike-johnson-002'
ON DUPLICATE KEY UPDATE title = VALUES(title);

INSERT INTO bundle_drafts (trainerId, title, description, price, cadence, status, createdAt)
SELECT u.id, 'Total Body Transformation', 'Holistic approach to fitness and wellness', 399.00, 'monthly', 'published', NOW()
FROM users u WHERE u.openId = 'trainer-emily-chen-003'
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify data was inserted correctly)
-- ============================================================================
-- SELECT * FROM users WHERE role = 'trainer';
-- SELECT u.name, ta.status FROM users u JOIN trainer_approvals ta ON u.id = ta.trainerId;
-- SELECT u.name, COUNT(c.id) as client_count FROM users u LEFT JOIN clients c ON u.id = c.trainerId WHERE u.role = 'trainer' GROUP BY u.id;
-- SELECT u.name, COUNT(bd.id) as bundle_count FROM users u LEFT JOIN bundle_drafts bd ON u.id = bd.trainerId WHERE u.role = 'trainer' GROUP BY u.id;
