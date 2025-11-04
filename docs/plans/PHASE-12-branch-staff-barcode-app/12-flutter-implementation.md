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



