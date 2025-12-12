-- Script to clear all data from database
-- This will delete all data but keep the table structure

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Clear all tables (in order to respect foreign keys)
TRUNCATE TABLE "tickets" CASCADE;
TRUNCATE TABLE "payments" CASCADE;
TRUNCATE TABLE "bookings" CASCADE;
TRUNCATE TABLE "offers" CASCADE;
TRUNCATE TABLE "coupons" CASCADE;
TRUNCATE TABLE "event_requests" CASCADE;
TRUNCATE TABLE "addons" CASCADE;
TRUNCATE TABLE "event_packages" CASCADE;
TRUNCATE TABLE "school_trip_requests" CASCADE;
TRUNCATE TABLE "branches" CASCADE;
TRUNCATE TABLE "users" CASCADE;
TRUNCATE TABLE "wallet_transactions" CASCADE;
TRUNCATE TABLE "favorites" CASCADE;
-- Note: The following tables may not exist in all database versions
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
        TRUNCATE TABLE "notifications" CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'home_content') THEN
        TRUNCATE TABLE "home_content" CASCADE;
    END IF;
END $$;
TRUNCATE TABLE "banners" CASCADE;
TRUNCATE TABLE "activities" CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Reset sequences (if any)
-- Note: PostgreSQL doesn't use sequences for UUID primary keys, but if you have integer IDs, reset them here

SELECT 'Database cleared successfully!' AS message;

