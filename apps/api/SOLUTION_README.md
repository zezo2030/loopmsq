# حل مشكلة خطأ 500 في طلب الحصول على عرض السعر

## المشكلة
كان يحدث خطأ `500 Internal Server Error` عند محاولة الحصول على عرض سعر للحجز بسبب:

1. **عدم وجود بيانات تجريبية**: لم تكن هناك فروع أو قاعات في قاعدة البيانات
2. **مشكلة في الكود**: كان `hallId` مطلوب في `QuoteRequestModel` بينما يجب أن يكون اختياري

## الحلول المطبقة

### 1. إصلاح الكود
تم تعديل الملفات التالية لجعل `hallId` اختياري:

- `QuoteRequestModel`: جعل `hallId` اختياري في constructor و `toJson()`
- `BookingRepository`: تحديث interface و implementation
- `GetQuoteUseCase`: تحديث method signature
- `BookingCubit`: تحديث method signature

### 2. إضافة بيانات تجريبية
تم إنشاء `SampleDataSeeder` الذي ينشئ:

- **فرع واحد**: الفرع الرئيسي في الرياض
- **ثلاث قاعات**:
  - قاعة الاحتفالات الكبرى (سعة 100 شخص)
  - قاعة الاجتماعات (سعة 50 شخص)
  - قاعة الأفراح (سعة 200 شخص)

## كيفية التشغيل

### 1. تشغيل الخادم
```bash
cd loopmsq/apps/api
npm run start:dev
```

### 2. اختبار API
```bash
# الحصول على عرض سعر
curl -X POST 'http://localhost:3000/api/v1/bookings/quote' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "branchId": "BRANCH_ID_FROM_DATABASE",
    "startTime": "2024-01-15T14:00:00.000Z",
    "durationHours": 3,
    "persons": 50,
    "addOns": [],
    "couponCode": "SAVE20"
  }'
```

### 3. التحقق من البيانات
```bash
# الحصول على الفروع
curl -X GET 'http://localhost:3000/api/v1/content/branches'

# الحصول على القاعات
curl -X GET 'http://localhost:3000/api/v1/content/halls'
```

## الملفات المعدلة

### Flutter App
- `quote_request_model.dart`: جعل `hallId` اختياري
- `booking_repository_impl.dart`: تحديث method signature
- `booking_repository.dart`: تحديث interface
- `get_quote_usecase.dart`: تحديث method signature
- `booking_cubit.dart`: تحديث method signature

### Backend API
- `sample-data.seeder.ts`: إضافة بيانات تجريبية
- `content.module.ts`: إضافة الـ seeder

## النتيجة المتوقعة

بعد تطبيق هذه الحلول:

1. ✅ لن يحدث خطأ 500 عند طلب عرض السعر
2. ✅ سيتم إنشاء بيانات تجريبية تلقائياً عند بدء الخادم
3. ✅ يمكن اختبار جميع وظائف الحجز
4. ✅ `hallId` أصبح اختياري كما هو مطلوب في API

## ملاحظات إضافية

- الـ seeder يعمل تلقائياً عند بدء الخادم
- إذا كانت البيانات موجودة مسبقاً، لن يتم إنشاء بيانات جديدة
- يمكن إضافة المزيد من البيانات التجريبية في `SampleDataSeeder`
