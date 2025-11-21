# دليل إعداد Firebase للإشعارات الفورية

## نظرة عامة

تم ربط Firebase Cloud Messaging (FCM) في الباك اند وتطبيقات Flutter لإرسال الإشعارات الفورية للمستخدمين.

## المتطلبات

1. حساب Firebase (Google)
2. مشروع Firebase
3. تطبيقات Android/iOS في Firebase Console

---

## خطوات الإعداد

### 1. إنشاء مشروع Firebase

1. اذهب إلى [Firebase Console](https://console.firebase.google.com/)
2. انقر "Add project" أو استخدم مشروع موجود
3. أدخل اسم المشروع واتبع التعليمات

### 2. إضافة تطبيقات Android/iOS

#### Android:
1. في Firebase Console، انقر "Add app" → Android
2. أدخل package name (مثال: `com.yourcompany.userapp`)
3. حمّل ملف `google-services.json`
4. ضع الملف في:
   - `user-app/user_app/android/app/google-services.json`
   - `staff_app/android/app/google-services.json`

#### iOS:
1. في Firebase Console، انقر "Add app" → iOS
2. أدخل Bundle ID (مثال: `com.yourcompany.userapp`)
3. حمّل ملف `GoogleService-Info.plist`
4. ضع الملف في:
   - `user-app/user_app/ios/Runner/GoogleService-Info.plist`
   - `staff_app/ios/Runner/GoogleService-Info.plist`

### 3. تفعيل Cloud Messaging

1. في Firebase Console، اذهب إلى **Cloud Messaging**
2. تأكد من تفعيل الخدمة
3. اذهب إلى **Project Settings** → **Service Accounts**
4. انقر **Generate new private key**
5. احفظ ملف JSON (ستحتاجه للباك اند)

### 4. إعداد الباك اند

#### أ. تثبيت الحزم

```bash
cd loopmsq/apps/api
npm install
```

#### ب. إعداد متغيرات البيئة

أضف إلى ملف `.env` أو `docker-compose.yml`:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
```

**ملاحظات مهمة:**
- `FIREBASE_PROJECT_ID`: موجود في Firebase Console → Project Settings
- `FIREBASE_CLIENT_EMAIL`: موجود في ملف JSON الذي حمّلته
- `FIREBASE_PRIVATE_KEY`: من ملف JSON، احتفظ بـ `\n` كما هي

**كيفية استخراج القيم من ملف JSON:**

```json
{
  "project_id": "your-project-id",           // هذا هو FIREBASE_PROJECT_ID
  "client_email": "firebase-adminsdk-...",   // هذا هو FIREBASE_CLIENT_EMAIL
  "private_key": "-----BEGIN PRIVATE KEY-----\n..."  // هذا هو FIREBASE_PRIVATE_KEY
}
```

### 5. إعداد تطبيقات Flutter

#### أ. تثبيت الحزم

```bash
# في user-app
cd user-app/user_app
flutter pub get

# في staff_app
cd staff_app
flutter pub get
```

#### ب. إعداد Android

1. تأكد من وجود `google-services.json` في `android/app/`
2. في `android/build.gradle` (project level)، أضف:

```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

3. في `android/app/build.gradle`، أضف في النهاية:

```gradle
apply plugin: 'com.google.gms.google-services'
```

#### ج. إعداد iOS

1. تأكد من وجود `GoogleService-Info.plist` في `ios/Runner/`
2. في Xcode، أضف الملف إلى Runner target
3. في `ios/Runner/Info.plist`، تأكد من وجود:

```xml
<key>FirebaseAppDelegateProxyEnabled</key>
<false/>
```

### 6. اختبار الإعداد

#### الباك اند:

1. شغّل الباك اند:
```bash
cd loopmsq
docker-compose up
```

2. تحقق من السجلات - يجب أن ترى:
```
[PushProvider] Firebase initialized successfully
```

#### تطبيقات Flutter:

1. شغّل التطبيق
2. تحقق من السجلات - يجب أن ترى:
```
✅ Firebase initialized
📱 FCM Token: [token-here]
✅ FCM token registered with backend
```

---

## استخدام الإشعارات

### إرسال إشعار من الباك اند:

```typescript
await this.notifications.enqueue({
  type: 'BOOKING_CONFIRMED',
  to: { userId: 'user-id-here' },
  data: { bookingId: 'booking-id' },
  channels: ['push'], // أو ['push', 'sms', 'email']
});
```

### أنواع الإشعارات المدعومة:

- `OTP`
- `BOOKING_CONFIRMED`
- `BOOKING_REMINDER`
- `BOOKING_END`
- `BOOKING_CANCELLED`
- `PAYMENT_SUCCESS`
- `TICKETS_ISSUED`
- `TRIP_STATUS`
- `EVENT_STATUS`
- `PROMO`
- `ADMIN_MESSAGE`
- `LOYALTY_EARN`
- `LOYALTY_REDEEM`
- `RATING_REQUEST`
- `WALLET_RECHARGED`

---

## استكشاف الأخطاء

### الباك اند لا يرسل إشعارات:

1. تحقق من متغيرات البيئة:
```bash
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_CLIENT_EMAIL
```

2. تحقق من السجلات:
```bash
docker logs booking-backend | grep Firebase
```

3. تأكد من تثبيت `firebase-admin`:
```bash
cd loopmsq/apps/api
npm list firebase-admin
```

### تطبيق Flutter لا يستقبل إشعارات:

1. تحقق من وجود ملفات التكوين:
   - Android: `android/app/google-services.json`
   - iOS: `ios/Runner/GoogleService-Info.plist`

2. تحقق من السجلات:
```bash
flutter run --verbose | grep Firebase
```

3. تأكد من تسجيل التوكن:
   - تحقق من السجلات: `📱 FCM Token: ...`
   - تحقق من قاعدة البيانات: جدول `device_tokens`

### إشعارات لا تظهر:

1. **Android**: تحقق من إعدادات الإشعارات في الجهاز
2. **iOS**: تأكد من طلب الصلاحيات
3. تحقق من أن التطبيق ليس في وضع "Do Not Disturb"

---

## الأمان

⚠️ **مهم جداً:**

1. لا تشارك `FIREBASE_PRIVATE_KEY` أبداً
2. لا ترفع ملفات `google-services.json` أو `GoogleService-Info.plist` إلى Git
3. استخدم متغيرات البيئة للإنتاج
4. راجع صلاحيات Service Account في Firebase Console

---

## المراجع

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [FlutterFire Documentation](https://firebase.flutter.dev/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

---

## الدعم

إذا واجهت مشاكل:
1. راجع السجلات في الباك اند والتطبيقات
2. تحقق من Firebase Console → Cloud Messaging → Reports
3. تأكد من صحة جميع المتغيرات والملفات





