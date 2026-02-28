# Environment Configuration for Email OTP & WhatsApp OTP

## المشكلة
عند إرسال OTP عبر البريد الإلكتروني، لا يتم إرسال الرسائل بسبب عدم تكوين إعدادات SMTP.

## الحل المطلوب

### 1. إنشاء ملف `.env` في مجلد `loopmsq/apps/api/`

```env
# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=booking_platform

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-32-characters-long
JWT_EXPIRES_IN=24h

# Application Configuration
PORT=3000
NODE_ENV=development
API_PREFIX=api/v1
ENCRYPTION_KEY=default-32-character-key-for-dev
MAX_FILE_SIZE=10485760
UPLOAD_DEST=./uploads
BOOKING_SLOT_MINUTES=60

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# SMTP Email Configuration (Required for OTP emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com

# WhatsApp Business API Configuration (Required for WhatsApp OTP)
WHATSAPP_ACCESS_TOKEN=your-whatsapp-access-token
WHATSAPP_PHONE_NUMBER_ID=your-whatsapp-phone-number-id

# Payment Configuration
PAYMENT_WEBHOOK_SECRET=dev-webhook-secret

# Firebase Configuration (للإشعارات الفورية)
FIREBASE_PROJECT_ID=events-f1ff2
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@events-f1ff2.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1V3bDSEC0nFL2\nXwOLLPgxYRKrpfbFYT4Y5/zUqt2SZY44nNur/3z506bnKitngTl18M1ZO0NpNEnd\nnjaZ1VUL8Yng7Z8BS7RQWLrsIsyIqGFnxS6aAFSSONOMsrBUb3GdR/l/fSu2Qp82\n9FBHAJmjCXwbFvC/Gl+mSaVhRvvtxAqoWxv7zcd4fghu3gu2vZiMNATlOD8X8h5T\nybWTDTl1i7q6vUK/KxdL/FTQjKEP+1niw0Jc0oLZK0DBkgqO4bC/1w3jP0o9wQRC\nEiGcfgLMQ5lomiUdcTI5ERLgjZVKkhOV/Lg5C3m6aLnyQCOMubb+yk/0fbTTEacr\nTx6kqN/RAgMBAAECggEAQFv74v/0MwWeLiF3lQAPUBsnMLNU2yWRj+5Z3bKMs+YG\nLVKCZk9lMBdtj3J4eCI1XgXqI4a0fJSZuKVrtHox1mzRpfo/qgqPwspTAPayx7eW\n5mjlirOeUE0Jy9ApY7YvyQXf517p0iRf9HWOPjzYyjPWD5k7NV/rXY2au+UhCXem\n2P1YGd9ihTxLzSSamhnZUgUQy5fVg4TOLogPX+temOJCQaEHfFZ+/UOuhq44L6pK\n7x7d4NN8jRgXn1FGwzeVwlkyeZ0dCLRTHLuX+ZM81R8LufIzlX0GYX2BYgJ1zESu\nan7YjHZpW9at0QGL8gZdw0Y3fms3Q+NceDOOl3pLHwKBgQDeq+FgJ07ND9eopFla\n8gfcITH0DDlsAQIXyn1mXTvKuFhNLWvpbg18RSCr79upt7LRfi6PYJg6neBTgNwj\npGbv72iK7RAGKGNFF+haaLHEDtQKbm9mH+VpYbGHg5wGw6KC9vSLqVSlrH2OqdsK\n/KyPe6bKbnXQbsPP0VrZjjltvwKBgQDQe/KnJwVkqtfyKfibDmnxOjrHD1kvS87i\nLGcSePFLpflJLXYNscAyh9EDcE2/CysRZOsyhKQD3YjI+L3kRN1TUbYuRUZM6C/k\nJSRfLMMy7owJ80AWPCMtUTa2a1ul7evredVaKZOZanE6o9YdPVSXwKRV+ZxXrmLC\nmplggmQ2bwKBgDXkt/nDycjMCtBgZtgiOFDJIAQHaWaAn/cOJWe/LReVopmbYsDu\nyAjJ2myC81GSio810SMWqAGX8JGFYMKnqdpswYrOcdBrugshDDXFnTDsvdmAfSnk\nkmv9HzDDY+InO5AjIXEkHL60jvcWmVOBcGqR7P6V2aIHDRGhhDGfwLqVAoGABm3c\nFMWCSBFwqVob/YQbRkIab+sMQAYhch4Wa55pKoEKx/Pr8Q4rNCO2EVoUO7D3egjX\nq+4lNK1PO4tYJ8Lr5FbfvFuMiHCckXeHwJubxWVP0jq7HjRqjUo02rlC0UIeBVvz\ndV1U3OVIapuEzdAHXMqnBrO024tYJlIoKq66smcCgYEAzNOTVgc+ZRquVKE4st6P\nTt7ohqtSGa7quYw34zjwdj6EDRCKY3nEwm9zdAiEDGvvfW2XyCuc8EyJ5StFruSt\njYcB2oOAsZV4CzL/Q0AnKKC31coEVP9WRuk7hPH01zNYMA9dh7bZ0U72H6l6PAIq\nGlwHiGoil2Qz88GmQcsmCqA=\n-----END PRIVATE KEY-----\n"
```

### 2. إعدادات SMTP المطلوبة

المتغيرات التالية مطلوبة لإرسال البريد الإلكتروني:

- `SMTP_HOST`: عنوان خادم SMTP (مثل: smtp.gmail.com)
- `SMTP_PORT`: منفذ SMTP (587 للـ TLS، 465 للـ SSL)
- `SMTP_USER`: اسم المستخدم للبريد الإلكتروني
- `SMTP_PASS`: كلمة مرور البريد الإلكتروني
- `SMTP_FROM`: عنوان المرسل

### 3. إعداد Gmail (مثال)

1. قم بتفعيل "App Passwords" في حساب Gmail
2. استخدم كلمة مرور التطبيق بدلاً من كلمة المرور العادية
3. استخدم الإعدادات التالية:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM=your-email@gmail.com
```

### 4. التحقق من التكوين

بعد إعداد المتغيرات، أعد تشغيل الخادم:

```bash
cd loopmsq/apps/api
npm run start:dev
```

### 5. مراقبة السجلات

تحقق من سجلات الخادم لرؤية رسائل الخطأ:

```bash
# في حالة عدم تكوين SMTP، ستظهر رسالة:
[EMAIL] to=user@example.com subject=OTP Code
```

### 6. اختبار الإرسال

يمكنك اختبار إرسال البريد من خلال:

1. استخدام Swagger UI: `http://localhost:3000/api/v1/docs`
2. اختبار endpoint: `POST /api/v1/auth/otp/send`
3. مراقبة سجلات الخادم للتأكد من الإرسال

## استكشاف الأخطاء

### إذا لم يتم إرسال البريد:

1. تأكد من صحة إعدادات SMTP
2. تحقق من كلمة مرور التطبيق (لـ Gmail)
3. تأكد من أن الخادم يعمل على المنفذ الصحيح
4. تحقق من سجلات الخادم للأخطاء

### رسائل الخطأ الشائعة:

- `SMTP send failed: Authentication failed` - كلمة مرور خاطئة
- `SMTP send failed: Connection timeout` - إعدادات خاطئة للخادم
- `SMTP send failed: Invalid login` - بيانات اعتماد خاطئة

### 7. إعدادات Firebase (للإشعارات الفورية)

المتغيرات التالية مطلوبة لإرسال الإشعارات الفورية:

- `FIREBASE_PROJECT_ID`: معرف مشروع Firebase
- `FIREBASE_CLIENT_EMAIL`: بريد Service Account من Firebase
- `FIREBASE_PRIVATE_KEY`: المفتاح الخاص من ملف JSON (احتفظ بـ `\n` كما هي)

**ملاحظة:** تم إضافة معلومات Firebase إلى `docker-compose.yml` بالفعل. إذا كنت تستخدم ملف `.env` منفصل، أضف المتغيرات أعلاه.
