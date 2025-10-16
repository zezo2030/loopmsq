## خطة استكمال لوحة تحكم الفروع (Branch Dashboard)

هذه الخطة تلخّص العناصر غير المكتملة بحسب المراحل (B0–B5) وتقترح أعمال تنفيذ واضحة. الأقواس تشير لمالك التنفيذ: (BE) للخلفية، (FE) للواجهة.

### B0 — التهيئة والصلاحيات (Setup & Auth)
- [ ] تحديث رد `GET /auth/me` ليعيد `branchId` بالإضافة إلى `id, roles, language` (BE)
- [ ] تضمين `branchId` في نتيجة `POST /auth/staff/login` ضمن كائن `user` (BE)
- [ ] تأكيد أن الواجهة تعتمد حصراً على `me.branchId` ولا تفترض وجوده إن كان فارغاً (عرض رسالة مناسبة) (FE)

### B1 — إدارة الفرع والقاعات (Branch & Halls)
- [ ] السماح لمدير الفرع بتحديث فرعه:
  - تعديل صلاحيات `PUT /content/branches/:id` لتشمل `BRANCH_MANAGER` مع تحقق أن `requester.branchId === :id` (BE)
- [ ] السماح لمدير الفرع بإنشاء/تعديل القاعات داخل فرعه:
  - تعديل صلاحيات `POST /content/halls` و`PUT /content/halls/:id` لتشمل `BRANCH_MANAGER`
  - فرض/التحقق من أن `branchId` للقاعات يساوي `requester.branchId` (BE)
- [ ] في الواجهة، تمرير `branchId` من بروفايل المدير تلقائياً وعدم إتاحة تغييره لفرع آخر (FE)
- [ ] إبقاء `PATCH /content/halls/:id/status` كما هو، مع تحقق ملكية الفرع قبل التغيير (BE)

### B2 — حجوزات الفرع (Branch Bookings)
- [ ] تقييد الوصول لتفاصيل/إلغاء الحجز لصالح المالك:
  - في الخدمة، عند دور `BRANCH_MANAGER` تحقق أن `booking.branchId === requester.branchId` في كلا مساري `GET /bookings/:id` و`POST /bookings/:id/cancel` (BE)
- [ ] التحقق من عرض التفاصيل في الواجهة بسلاسة حتى عند غياب بعض الحقول الاختيارية (FE)

### B3 — الموظفون وQR (Staff & QR)
- [ ] إصلاح مسارات التفعيل/التعطيل في الواجهة:
  - استخدام `/users/:id/activate` و`/users/:id/deactivate` بدلاً من `active|inactive` (FE)
- [ ] تمكين إنشاء موظف بواسطة مدير الفرع:
  - إما السماح بـ `POST /users/staff` لدور `BRANCH_MANAGER` مع فرض `roles=['staff']` و`branchId=requester.branchId`
  - أو إضافة مسار خاص مثل `POST /users/staff/branch/me` يقوم بضبط `branchId` تلقائياً (BE)
- [ ] إظهار/إخفاء الأزرار بحسب الدور في جدول الموظفين (FE)

### B4 — تقارير الفرع (Branch Reports)
- [ ] تعديل صلاحيات التقارير للسماح لمدير الفرع:
  - `GET /reports/overview` و`GET /reports/export` تسمحان `BRANCH_MANAGER`
  - إجبار `branchId=requester.branchId` عند غيابه في الطلب (BE)
- [ ] إصلاح التصدير في الواجهة لاستخدام قاعدة الـ API الصحيحة مع `Authorization` وتحميل الملف عبر Blob (FE)
- [ ] ضمان إرسال نطاق التاريخ بصيغة ISO (FE)

### B5 — التقسية و i18n (Hardening & i18n)
- [ ] تغطية مفاتيح الترجمة الناقصة في `apps/branch/src/locales/ar/common.json` و`en/common.json` (FE)
- [ ] توحيد حالات التحميل/الخطأ في صفحات: Dashboard, Halls, Bookings, Staff, Reports (FE)
- [ ] تحسين رسائل حارس الوصول `useBranchAuth` برسائل i18n واضحة عند رفض الصلاحيات (FE)
- [ ] إضافة GTM/Gtag إن لزم (اختياري) (FE/OPS)

### ملاحظات تكامل سريعة
- واجهة الفرع تعتمد على `branch_manager` حصراً: تأكد من توافق الأدوار عبر `UserRole.BRANCH_MANAGER` في الخادم.
- تأكد من أن جميع نقاط النهاية التي فُتحت لمدير الفرع تفرض تقييد `branchId` على مستوى الخدمة وليس الديكوريتر فقط.



