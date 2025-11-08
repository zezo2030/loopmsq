### تدفق الاستخدام (UX Flows)
- **تسجيل الدخول**
  - شاشة بريد إلكتروني/كلمة مرور → `POST /auth/staff/login` → تخزين `accessToken` و`refreshToken`، ثم `GET /auth/me` للتحقق من الدور والفرع.
- **استكشاف/عرض التذكرة قبل الاعتماد (اختياري)**
  - مسح QR واستخراج `token` → `GET /bookings/staff/ticket/:token` لعرض بيانات التذكرة والحجز والفرع والوقت.
- **اعتماد التذكرة**
  - إرسال `qrToken` كما هو من محتوى الـ QR إلى `POST /bookings/staff/scan`.
  - حالات الرد المتوقعة: `Invalid QR code`, `Not allowed` (اختلاف الفرع), `Ticket already used`, `Ticket is EXPIRED/CANCELLED`, `Ticket is not valid for current time`, أو نجاح مع إرجاع `ticket` و`booking`.
- **سجل عمليات الفحص**
  - `GET /bookings/staff/scans/me` مع عرض أحدث الفحوصات (التاريخ، القاعة، الفرع).
- **تسجيل الخروج وتجديد الرمز**
  - استخدام `POST /auth/refresh` لتجديد `accessToken` عند الحاجة. دعم تسجيل الخروج بمسح التخزين المحلي.









