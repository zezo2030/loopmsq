-- Script to fix offers and coupons tables before adding branchId
-- Run this BEFORE starting the application

-- Delete all existing offers and coupons (they don't have branchId)
DELETE FROM "offers";
DELETE FROM "coupons";

-- Note: After running this script, restart the application
-- TypeORM synchronize will then add the branchId and hallId columns successfully

