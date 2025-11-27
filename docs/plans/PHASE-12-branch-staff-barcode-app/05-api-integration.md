### تكامل الواجهات البرمجية (API)
- **الرأس (Headers)**: `Authorization: Bearer <accessToken>` لكل النداءات المحمية.
- **نقاط النهاية**:
  - تسجيل الدخول: `POST /api/v1/auth/staff/login` → `{ accessToken, refreshToken, user { id, roles, branchId, ... } }`.
  - معلوماتي: `GET /api/v1/auth/me` → يتحقق من الدور `staff` ويقرأ `branchId`.
  - تفاصيل التذكرة: `GET /api/v1/bookings/staff/ticket/:token` → `{ ticket, booking }` أو 404.
  - اعتماد التذكرة: `POST /api/v1/bookings/staff/scan` مع `{ qrToken }` → `{ success, message, ticket?, booking? }`.
  - سجلّي: `GET /api/v1/bookings/staff/scans/me` → `{ scans: Ticket[] }`.























