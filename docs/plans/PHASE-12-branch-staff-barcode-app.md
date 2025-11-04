### تطبيق موظف الفرع @loopmsq لتصوير/فحص الباركود (QR)

- **الهدف**: تمكين موظف الفرع من تسجيل الدخول، فحص تذاكر الحجز عبر الكاميرا (QR)، اعتماد التذكرة، وعرض سجل عمليات الفحص مع الالتزام بقيود الفرع والصلاحيات.
- **نطاق الإصدار الأول (MVP)**: تسجيل الدخول، فحص وعرض تفاصيل التذكرة قبل الاعتماد، اعتماد التذكرة، سجل عمليات الفحص، تسجيل الخروج. دعم العربية أولاً.

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

### متطلبات غير وظيفية
- **الأمان**: استخدام HTTPS، تمرير رمز `Bearer` في الهيدر، تخزين الرموز بشكل آمن (يفضل الذاكرة/Storage محلي مشفر إن أمكن)، حماية من مشاركة الحساب.
- **الأداء والاعتمادية**: فتح الكاميرا بسرعة، مؤشرات تقدم أثناء قراءة الكود، التعامل مع ضوء ضعيف، تكرار الفحص يمنع الاعتماد المزدوج.
- **الدولية (i18n)**: العربية افتراضيًا؛ رسائل الأخطاء مطابقة لرسائل الباك-إند المذكورة.
- **التوافق**: PWA تعمل على متصفحات الجوال الحديثة (Android/iOS) مع صلاحيات الكاميرا.

### تصميم الواجهات (MVP)
- **شاشة تسجيل الدخول**: حقول البريد/كلمة المرور، تذكرني، رسائل أخطاء دقيقة.
- **شاشة الفحص**:
  - نافذة كاميرا مع مربع تركيز، زر تشغيل/إطفاء الفلاش، نص إرشادي.
  - عرض معاينة تفاصيل التذكرة بعد القراءة (اسم الفعالية/القاعة/الوقت وعدد الأشخاص) عبر `GET ticket/:token`، وزر اعتماد.
  - عند الاعتماد: نداء `POST staff/scan` مع عرض نتيجة واضحة (نجاح/مرفوض + سبب).
- **شاشة سجل الفحوصات**: قائمة بأحدث الفحوصات مع إمكانية البحث البسيط حسب التاريخ.
- **إعدادات بسيطة**: تبديل اللغة مستقبلاً، ومعلومات الإصدار.

### تكامل الواجهات البرمجية (API)
- **الرأس (Headers)**: `Authorization: Bearer <accessToken>` لكل النداءات المحمية.
- **نقاط النهاية**:
  - تسجيل الدخول: `POST /api/v1/auth/staff/login` → `{ accessToken, refreshToken, user { id, roles, branchId, ... } }`.
  - معلوماتي: `GET /api/v1/auth/me` → يتحقق من الدور `staff` ويقرأ `branchId`.
  - تفاصيل التذكرة: `GET /api/v1/bookings/staff/ticket/:token` → `{ ticket, booking }` أو 404.
  - اعتماد التذكرة: `POST /api/v1/bookings/staff/scan` مع `{ qrToken }` → `{ success, message, ticket?, booking? }`.
  - سجلّي: `GET /api/v1/bookings/staff/scans/me` → `{ scans: Ticket[] }`.

### ملاحظات تقنية من الباك-إند
- يتم توليد/مطابقة الـ QR عبر `qrToken` أو token مؤقت يحل عبر Redis؛ لا يحتاج العميل إلى التجزئة—يرسل النص كما تمت قراءته من QR.
- التحقق الزمني للتذكرة يعتمد على فترة الحجز (`startTime` + `durationHours`).
- يتم وسم التذكرة بالمستخدم القائم بالفحص (`staffId`) ووقت الفحص `scannedAt` عند النجاح.

### خطة التنفيذ
- **البنية**
  - خيار 1: إنشاء تطبيق جديد `apps/branch-staff` (Vite React) مخصص للفحص.
  - خيار 2: إضافة مساحة/صفحات داخل `apps/branch` تحت قسم "الموظفين" مع صلاحية `staff` فقط.
- **المكتبات المقترحة للفحص (Web)**
  - `@zxing/browser` أو `react-qr-reader`/`react-qr-barcode-scanner` للفحص عبر WebRTC.
- **إدارة الحالة**: `React Query` للنداءات وجلب/تخزين `accessToken`، وتغليف طبقة `api.ts` مشتركة.
- **التخزين**: حفظ `accessToken` و`refreshToken` بأمان؛ دعم التجديد التلقائي عبر اعتراضات HTTP.
- **i18n**: الاستفادة من النمط المستخدم في `apps/admin`/`apps/branch` (ملفات locales).
- **التحقق من الدور**: بعد تسجيل الدخول أو بدء التطبيق، إذا لم يكن الدور يحتوي `staff` → حظر الوصول.
- **الخصائص (MVP)**
  1) تسجيل الدخول.
  2) فحص QR + عرض التفاصيل + اعتماد.
  3) عرض سجل الفحوصات.
  4) تسجيل الخروج.

### النشر والإعدادات
- **بيئة التشغيل**: استخدم `NEXT_PUBLIC_API_BASE` أو مكافئها في Vite لتعيين `http(s)://<host>:3000/api/v1`.
- **Docker/Compose**: الخدمة الخلفية متاحة على `3000` وفق `docker-compose.yml`، والكونسول على `3001`.
- **الأذونات**: تأكد من `https` و`camera` permissions عبر PWA manifest وسياسات المتصفح.

### الاختبارات والقبول
- اختبارات وحدة لطبقة API (حالات النجاح والفشل المذكورة).
- اختبارات تكامل للفحص باستخدام QR تجريبي.
- اعتماد نهائي مع سيناريوهات: تذكرة صحيحة، مستخدمة سابقًا، منتهية/ملغاة، وقت غير صالح، فرع غير مطابق.

### الجدول الزمني المقترح (MVP)
- يوم 1: إعداد المشروع، المصادقة، طبقة API.
- يوم 2: شاشة الفحص + معاينة التفاصيل + اعتماد.
- يوم 3: سجل الفحوصات + صقل UX + i18n.
- يوم 4: اختبارات، تحسين أداء الكاميرا، وثائق ونشر.

### ملحق: أمثلة سريعة (cURL)
```bash
# تسجيل دخول الموظف
curl -X POST "$API_BASE/auth/staff/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@booking.com","password":"SecurePassword123"}'

# تفاصيل التذكرة قبل الاعتماد
curl -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/bookings/staff/ticket/$QR_TOKEN"

# اعتماد التذكرة
curl -X POST "$API_BASE/bookings/staff/scan" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"qrToken":"'$QR_TOKEN'"}'
```

ملاحظة: استبدل `$API_BASE` بـ `http(s)://<host>:3000/api/v1` و`$TOKEN` برمز الوصول بعد تسجيل الدخول.

### تنفيذ Flutter (بدلاً من Web)
- **الحزم المقترحة**:
  - المسح بالكاميرا: `mobile_scanner` (مُوصى به) أو `qr_code_scanner` كبديل.
  - الشبكات: `dio` مع interceptors لإضافة `Authorization` والتعامل مع التجديد.
  - التخزين الآمن: `flutter_secure_storage` لحفظ `accessToken` و`refreshToken`.
  - الحالة/DI: `flutter_riverpod` أو `bloc` مع `get_it` اختيارياً.
  - الترجمة: `easy_localization` أو `flutter_i18n`.
  - البيئة: `flutter_dotenv` أو `--dart-define` لتحديد `API_BASE` حسب الـ flavor.

- **تهيئة المنصات**:
  - Android: أضف صلاحية الكاميرا إلى `AndroidManifest.xml` (`android.permission.CAMERA`) وحدّث `minSdk`/`targetSdk` حسب متطلبات الحزم.
  - iOS: أضف `NSCameraUsageDescription` في `Info.plist`. إن كان الخادم غير HTTPS في التطوير، فعّل استثناء ATS مؤقتاً أو استخدم HTTPS.

- **الإعداد/البيئة**:
  - عرّف `API_BASE` مثل: `--dart-define=API_BASE=https://<host>:3000/api/v1`.
  - أنشئ نكهات `dev/staging/prod` لضبط العناوين بسهولة.

- **التوثيق والتخزين**:
  - عند `POST /auth/staff/login` خزّن الرموز في `flutter_secure_storage`.
  - Interceptor لـ Dio:
    - يضيف `Bearer <accessToken>` تلقائياً.
    - عند 401، يستدعي `POST /auth/refresh` لتحديث الوصول مرة واحدة فقط، ثم يعيد الطلب الأصلي.

- **تدفق الفحص (UI/منطق)**:
  1) شاشة كاميرا باستخدام `mobile_scanner` مع كشف تلقائي للـ QR، دعم تشغيل/إيقاف الفلاش.
  2) بعد القراءة: نداء `GET /bookings/staff/ticket/:token` لعرض التفاصيل قبل الاعتماد.
  3) زر "اعتماد" يستدعي `POST /bookings/staff/scan` مع `{ qrToken }` وإظهار نتيجة واضحة.
  4) شاشة "سجل الفحوصات" تستدعي `GET /bookings/staff/scans/me` وتعرض أحدث النتائج.

- **هيكلة المشروع (اقتراح)**:
  - مجلد التطبيق: `apps/branch_staff_flutter/`
  - بنية `lib/`:
    - `core/network/dio_client.dart`, `core/storage/secure_storage.dart`
    - `features/auth/...`, `features/scan/...`, `features/history/...`
    - `l10n/` لملفات الترجمة

- **التوافق والأداء**:
  - اهتزاز/صوت عند نجاح القراءة، ومنع التكرار السريع لنفس الرمز.
  - إظهار مؤشرات حالة الشبكة ورسائل الأخطاء (مطابقة لرسائل الباك-إند).

- **الاختبار**:
  - اختبارات وحدة لطبقة الشبكات واعتراضات التجديد.
  - اختبارات تكامل على أجهزة فعلية لضمان استقرار الكاميرا وجودة القراءة في الإضاءة المختلفة.

