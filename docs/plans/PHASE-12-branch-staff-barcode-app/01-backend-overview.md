### نظرة عامة على الباك-إند الحالي (Ready)
- **الإطار**: NestJS + PostgreSQL + Redis + JWT. المعرّف العام للواجهات `API_PREFIX` هو `api/v1`.
- **الأدوار**: `user`, `branch_manager`, `staff`, `admin`.
- **قيود الفرع**: عند الفحص يتم التحقق أن `staff.branchId === booking.branchId` قبل الاعتماد.
- **نقاط نهاية ذات صلة**:
  - مصادقة الموظفين: `POST /api/v1/auth/staff/login` (الجسد: `{ email, password }`).
  - معلومات المستخدم: `GET /api/v1/auth/me`.
  - فحص التذكرة (اعتماد): `POST /api/v1/bookings/staff/scan` (الجسد: `{ qrToken }`).
  - تفاصيل التذكرة قبل الاعتماد: `GET /api/v1/bookings/staff/ticket/:token`.
  - سجل عمليات الفحص للموظف: `GET /api/v1/bookings/staff/scans/me`.






