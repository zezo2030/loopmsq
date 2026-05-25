-- مسح الحجوزات والعمليات المالية فقط (يُبقي المستخدمين، الفروع، العروض، الإضافات، …)
-- يعيد أرصدة المحافظ إلى الصفر بعد حذف حركات المحفظة والولاء.
-- يتطلب PostgreSQL. يستخدم تعطيل مؤقت لفحوصات التكرار لتفادي تعارض المفاتيح الأجنبية.

BEGIN;

SET LOCAL session_replication_role = 'replica';

-- تبعيات الحجز / الدفع (الترتيب آمن مع CASCADE عند الحاجة)
TRUNCATE TABLE
  "gift_order_events",
  "subscription_usage_logs",
  "offer_tickets",
  "tickets",
  "reviews",
  "loyalty_transactions",
  "wallet_transactions",
  "payments",
  "referral_earnings",
  "gift_orders",
  "subscription_purchases",
  "offer_bookings",
  "bookings",
  "event_requests",
  "school_trip_requests"
CASCADE;

SET LOCAL session_replication_role = 'origin';

-- إعادة ضبط أرصدة المحافظ (السجلات أعلاه حُذفت)
UPDATE "wallets"
SET
  "balance" = 0,
  "loyaltyPoints" = 0,
  "totalEarned" = 0,
  "totalSpent" = 0,
  "lastTransactionAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE true;

COMMIT;

SELECT 'تم مسح الحجوزات والعمليات المالية وإعادة ضبط المحافظ.' AS "message";
