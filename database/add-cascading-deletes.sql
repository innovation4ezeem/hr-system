-- ============================================================
-- SQL Migration: Add Cascading Deletes for User Records
-- ============================================================

-- 1. Clean up orphaned records first to ensure constraints can be added
DELETE FROM leave_balances WHERE employee_id NOT IN (SELECT id FROM users);
DELETE FROM leave_requests WHERE employee_id NOT IN (SELECT id FROM users);
DELETE FROM employee_service_years WHERE employee_id NOT IN (SELECT id FROM users);
DELETE FROM performance_inputs WHERE employee_id NOT IN (SELECT id FROM users);
DELETE FROM performance_scores WHERE employee_id NOT IN (SELECT id FROM users);
DELETE FROM penalties WHERE employee_id NOT IN (SELECT id FROM users);
DELETE FROM notifications WHERE recipient_id NOT IN (SELECT id FROM users);

-- 2. Add Foreign Key constraints with ON DELETE CASCADE

-- Leave Balances
ALTER TABLE leave_balances 
ADD CONSTRAINT fk_leave_balances_employee 
FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE;

-- Leave Requests
ALTER TABLE leave_requests 
ADD CONSTRAINT fk_leave_requests_employee 
FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE;

-- Employee Service Years
ALTER TABLE employee_service_years 
ADD CONSTRAINT fk_service_years_employee 
FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE;

-- Performance Inputs
ALTER TABLE performance_inputs 
ADD CONSTRAINT fk_performance_inputs_employee 
FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE;

-- Performance Scores
ALTER TABLE performance_scores 
ADD CONSTRAINT fk_performance_scores_employee 
FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE;

-- Penalties
ALTER TABLE penalties 
ADD CONSTRAINT fk_penalties_employee 
FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE;

-- Notifications
ALTER TABLE notifications 
ADD CONSTRAINT fk_notifications_recipient 
FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;
