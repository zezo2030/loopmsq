# Environment Configuration for Email OTP

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

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# SMTP Email Configuration (Required for OTP emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com

# Twilio SMS Configuration (Optional)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_NUMBER=+1234567890

# Payment Configuration
PAYMENT_WEBHOOK_SECRET=dev-webhook-secret
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
