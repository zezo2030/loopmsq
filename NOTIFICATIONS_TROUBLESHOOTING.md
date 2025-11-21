# دليل استكشاف أخطاء الإشعارات

## المشاكل الشائعة والحلول

### 1. الباك اند لا يرسل إشعارات

#### التحقق من التهيئة:

```bash
# تحقق من سجلات الباك اند
docker logs booking-backend | grep Firebase
```

يجب أن ترى:
```
[PushProvider] Firebase Config Check: projectId=true, clientEmail=true, privateKey=true
[PushProvider] Firebase initialized successfully
```

#### إذا لم ترى هذه الرسائل:

1. **تحقق من متغيرات البيئة:**
```bash
docker exec booking-backend printenv | grep FIREBASE
```

2. **تحقق من أن firebase-admin مثبت:**
```bash
docker exec booking-backend npm list firebase-admin
```

3. **تحقق من السجلات للأخطاء:**
```bash
docker logs booking-backend | grep -i "firebase\|error\|failed"
```

#### حلول محتملة:

- **المشكلة:** `Firebase not configured`
  - **الحل:** تأكد من وجود المتغيرات في `docker-compose.yml`:
    ```yaml
    FIREBASE_PROJECT_ID: events-f1ff2
    FIREBASE_CLIENT_EMAIL: firebase-adminsdk-fbsvc@events-f1ff2.iam.gserviceaccount.com
    FIREBASE_PRIVATE_KEY: "..."
    ```

- **المشكلة:** `Failed to init Firebase`
  - **الحل:** تحقق من صحة `FIREBASE_PRIVATE_KEY` - يجب أن يحتوي على `\n` كما هي
  - تأكد من أن المفتاح كامل (يبدأ بـ `-----BEGIN PRIVATE KEY-----`)

- **المشكلة:** `firebase-admin not found`
  - **الحل:** أعد بناء الصورة:
    ```bash
    docker-compose down
    docker-compose build --no-cache api
    docker-compose up -d
    ```

---

### 2. تطبيق Flutter لا يستقبل إشعارات

#### التحقق من التهيئة:

في سجلات التطبيق، يجب أن ترى:
```
✅ Firebase initialized successfully
📱 FCM Token: [token-here]
✅ FCM token registered with backend
```

#### إذا لم ترى هذه الرسائل:

1. **تحقق من وجود ملفات Firebase:**
   - Android: `android/app/google-services.json`
   - iOS: `ios/Runner/GoogleService-Info.plist`

2. **تحقق من firebase_options.dart:**
   - يجب أن يكون موجوداً في `lib/firebase_options.dart`
   - يجب أن يحتوي على `DefaultFirebaseOptions.currentPlatform`

3. **تحقق من أن Firebase.initializeApp يستخدم Options:**
   ```dart
   await Firebase.initializeApp(
     options: DefaultFirebaseOptions.currentPlatform,
   );
   ```

#### حلول محتملة:

- **المشكلة:** `MissingPluginException` أو `PlatformException`
  - **الحل:** 
    ```bash
    flutter clean
    flutter pub get
    flutter run
    ```

- **المشكلة:** `FCM Token: null`
  - **الحل:** 
    - تأكد من وجود `google-services.json` في `android/app/`
    - تأكد من إضافة Google Services plugin في `build.gradle`
    - أعد بناء التطبيق

- **المشكلة:** `Failed to register FCM token`
  - **الحل:**
    - تأكد من تسجيل الدخول أولاً (يحتاج userId)
    - تحقق من اتصال التطبيق بالباك اند
    - تحقق من السجلات: `⚠️ User data not found`

---

### 3. الإشعارات لا تظهر على الجهاز

#### Android:

1. **تحقق من إعدادات الإشعارات:**
   - Settings → Apps → [Your App] → Notifications
   - تأكد من تفعيل الإشعارات

2. **تحقق من Do Not Disturb:**
   - تأكد من أن الجهاز ليس في وضع "Do Not Disturb"

3. **تحقق من Battery Optimization:**
   - Settings → Apps → [Your App] → Battery → Unrestricted

#### iOS:

1. **تحقق من الصلاحيات:**
   - Settings → [Your App] → Notifications
   - تأكد من تفعيل "Allow Notifications"

2. **تحقق من Alert Style:**
   - يجب أن يكون "Alerts" وليس "Banners"

---

### 4. اختبار الإشعارات

#### من الباك اند:

1. **استخدم Swagger UI:**
   - اذهب إلى: `http://localhost:3000/api/v1/docs`
   - ابحث عن `/notifications/send-promo`
   - أرسل إشعار تجريبي

2. **أو استخدم curl:**
```bash
curl -X POST http://localhost:3000/api/v1/notifications/send-promo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Test",
    "message": "Test notification",
    "channels": ["push"]
  }'
```

#### من قاعدة البيانات:

تحقق من وجود device tokens:
```sql
SELECT * FROM device_tokens WHERE "userId" = 'YOUR_USER_ID';
```

---

### 5. التحقق من تسجيل التوكن

#### في التطبيق:

بعد تسجيل الدخول، تحقق من السجلات:
```
📱 FCM Token: [token]
✅ FCM token registered with backend
```

#### في قاعدة البيانات:

```sql
SELECT id, "userId", token, platform, "createdAt" 
FROM device_tokens 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

---

### 6. إعادة تسجيل التوكن

إذا كان التوكن غير مسجل:

1. **سجل خروج ثم دخول:**
   - هذا سيعيد تسجيل التوكن تلقائياً

2. **أو أعد تشغيل التطبيق:**
   - بعد تسجيل الدخول، سيتم تسجيل التوكن تلقائياً

---

### 7. الأخطاء الشائعة

#### `Firebase not initialized`
- **السبب:** Firebase.initializeApp() لم يتم استدعاؤه أو فشل
- **الحل:** تحقق من أن `firebase_options.dart` موجود ويستخدم `DefaultFirebaseOptions.currentPlatform`

#### `No device tokens found`
- **السبب:** المستخدم لم يسجل جهازه بعد
- **الحل:** تأكد من تسجيل الدخول في التطبيق

#### `FCM send failed: Invalid registration token`
- **السبب:** التوكن غير صالح أو منتهي الصلاحية
- **الحل:** سجل خروج ثم دخول لإعادة تسجيل التوكن

#### `Failed to init Firebase: Error: ...`
- **السبب:** مشكلة في بيانات الاعتماد
- **الحل:** تحقق من `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, و `FIREBASE_PRIVATE_KEY`

---

## خطوات التحقق السريع

1. ✅ الباك اند يعمل: `docker ps | grep booking-backend`
2. ✅ Firebase مهيأ: `docker logs booking-backend | grep "Firebase initialized"`
3. ✅ التطبيق مهيأ: تحقق من السجلات `✅ Firebase initialized`
4. ✅ التوكن مسجل: تحقق من قاعدة البيانات `device_tokens`
5. ✅ المستخدم مسجل دخول: تحقق من وجود `userId` في التوكن

---

## طلب المساعدة

إذا استمرت المشكلة:

1. اجمع السجلات:
   ```bash
   # الباك اند
   docker logs booking-backend > backend.log
   
   # التطبيق
   flutter logs > app.log
   ```

2. تحقق من:
   - إصدارات الحزم (`package.json`, `pubspec.yaml`)
   - إعدادات Firebase في Console
   - حالة الخدمات (PostgreSQL, Redis)

3. راجع `FIREBASE_SETUP.md` للتأكد من الإعداد الصحيح





