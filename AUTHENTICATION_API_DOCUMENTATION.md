# 📚 دوكيومنتيشن كامل لنظام المصادقة - API Documentation

## 🌐 معلومات الإنتاج (Production URLs)

### Base URLs للإنتاج:
```
Production API: http://localhost:3000/api/v1
Admin Console: http://localhost:3001
API Documentation: http://localhost:3000/api/v1/docs (Development Only)
Queues Dashboard: http://localhost:3000/api/v1/queues (Development Only)
```

---

## 🔐 نظام المصادقة (Authentication System)

### 📋 نظرة عامة
النظام يدعم عدة طرق للمصادقة:
- **تسجيل الدخول بالبريد الإلكتروني/الهاتف + كلمة المرور**
- **تسجيل الدخول بـ OTP (بدون كلمة مرور)**
- **تسجيل جديد بالبريد الإلكتروني + كلمة المرور**
- **تسجيل جديد بـ OTP فقط**

---

## 🚀 Authentication Endpoints

### 1. تسجيل الدخول العادي (Email/Phone + Password)

#### Request:
```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json

{
  "identifier": "ahmed@example.com",
  "password": "StrongPass#2025"
}
```

#### أو باستخدام رقم الهاتف:
```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json

{
  "identifier": "+966501234567",
  "password": "StrongPass#2025"
}
```

#### Response (Success - 200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "ahmed@example.com",
    "phone": "+966501234567",
    "name": "أحمد علي",
    "roles": ["USER"],
    "language": "ar"
  }
}
```

#### Response (Error - 401):
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

---

### 2. تسجيل الدخول بـ OTP (بدون كلمة مرور)

#### أ) إرسال OTP:
```http
POST http://localhost:3000/api/v1/auth/otp/send
Content-Type: application/json

{
  "email": "ahmed@example.com",
  "language": "ar"
}
```

#### Response:
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

#### ب) تأكيد OTP:
```http
POST http://localhost:3000/api/v1/auth/otp/verify
Content-Type: application/json

{
  "email": "ahmed@example.com",
  "otp": "123456",
  "name": "أحمد علي"
}
```

#### Response (Success - 200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "ahmed@example.com",
    "name": "أحمد علي",
    "roles": ["USER"],
    "language": "ar"
  },
  "isNewUser": false
}
```

---

### 3. التسجيل الجديد (Registration)

#### أ) إرسال OTP للتسجيل:
```http
POST http://localhost:3000/api/v1/auth/register/otp/send
Content-Type: application/json

{
  "name": "أحمد علي",
  "email": "ahmed@example.com",
  "phone": "+966501234567",
  "password": "StrongPass#2025",
  "language": "ar"
}
```

#### Response:
```json
{
  "success": true,
  "message": "Registration OTP sent"
}
```

#### ب) تأكيد التسجيل:
```http
POST http://localhost:3000/api/v1/auth/register/otp/verify
Content-Type: application/json

{
  "email": "ahmed@example.com",
  "otp": "123456"
}
```

#### Response (Success - 200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "ahmed@example.com",
    "name": "أحمد علي",
    "roles": ["USER"],
    "language": "ar"
  }
}
```

---

### 4. إدارة الجلسات (Session Management)

#### أ) الحصول على الملف الشخصي:
```http
GET http://localhost:3000/api/v1/auth/me
Authorization: Bearer {accessToken}
```

#### Response (Success - 200):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "ahmed@example.com",
  "phone": "+966501234567",
  "name": "أحمد علي",
  "roles": ["USER"],
  "language": "ar",
  "isActive": true,
  "lastLoginAt": "2024-01-15T10:30:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "wallet": {
    "balance": 150.00,
    "loyaltyPoints": 250,
    "totalEarned": 500.00,
    "totalSpent": 350.00
  }
}
```

#### ب) تجديد الرمز المميز:
```http
POST http://localhost:3000/api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Response (Success - 200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 5. تسجيل دخول الموظفين (Staff Login)

#### Request:
```http
POST http://localhost:3000/api/v1/auth/staff/login
Content-Type: application/json

{
  "email": "admin@localhost",
  "password": "AdminPassword123!"
}
```

#### Response (Success - 200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "admin@72.61.159.84",
    "name": "Admin",
    "roles": ["ADMIN"],
    "language": "ar"
  }
}
```

---

### 6. فحص إعدادات البريد الإلكتروني

#### Request:
```http
GET http://localhost:3000/api/v1/auth/email-config
```

#### Response:
```json
{
  "emailConfigured": true,
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "fromEmail": "noreply@72.61.159.84"
}
```

---

## 🔒 تفاصيل الأمان (Security Details)

### أنواع الرموز المميزة (Token Types):
- **Access Token**: صالح لمدة **4 ساعات**
- **Refresh Token**: صالح لمدة **7 أيام**

### طريقة استخدام الرموز:
```http
Authorization: Bearer {accessToken}
```

### معلومات JWT Payload:
```json
{
  "sub": "user-uuid",
  "roles": ["USER"],
  "iat": 1642248000,
  "exp": 1642262400
}
```

---

## 📊 Error Codes & Messages

### 400 Bad Request:
```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "password must be longer than or equal to 6 characters"
  ],
  "error": "Bad Request"
}
```

### 401 Unauthorized:
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

### 401 Invalid OTP:
```json
{
  "statusCode": 401,
  "message": "Invalid or expired OTP",
  "error": "Unauthorized"
}
```

### 429 Too Many Requests:
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}
```

---

## 🛠️ متطلبات البيئة (Environment Variables)

### متغيرات الإنتاج المطلوبة:
```env
# Database
POSTGRES_PASSWORD=your-secure-postgres-password

# JWT
JWT_SECRET=your-super-secure-jwt-secret-key-for-production
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-for-production

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-for-production

# Admin
ADMIN_EMAIL=admin@localhost
ADMIN_PASSWORD=YourSecureAdminPassword123!
ADMIN_NAME=Admin
ADMIN_PHONE=+966500000000

# SMTP Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@localhost

# Frontend
NEXT_PUBLIC_API_BASE=http://localhost:3000/api/v1
```

---

## 📱 مثال تطبيق الموبايل (Mobile App Example)

### React Native / Flutter Example:

```javascript
// Base URL
const API_BASE = 'http://localhost:3000/api/v1';

// تسجيل الدخول
const login = async (identifier, password) => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identifier: identifier,
      password: password,
    }),
  });
  
  const data = await response.json();
  
  if (response.ok) {
    // حفظ الرموز
    await AsyncStorage.setItem('accessToken', data.accessToken);
    await AsyncStorage.setItem('refreshToken', data.refreshToken);
    return data;
  } else {
    throw new Error(data.message);
  }
};

// الحصول على الملف الشخصي
const getProfile = async () => {
  const token = await AsyncStorage.getItem('accessToken');
  
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return response.json();
};

// تجديد الرمز
const refreshToken = async () => {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refreshToken: refreshToken,
    }),
  });
  
  const data = await response.json();
  
  if (response.ok) {
    await AsyncStorage.setItem('accessToken', data.accessToken);
    await AsyncStorage.setItem('refreshToken', data.refreshToken);
    return data;
  } else {
    // إعادة توجيه لتسجيل الدخول
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    throw new Error('Session expired');
  }
};

// تسجيل الدخول بـ OTP
const loginWithOTP = async (email) => {
  // إرسال OTP
  const sendResponse = await fetch(`${API_BASE}/auth/otp/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email,
      language: 'ar'
    }),
  });
  
  if (!sendResponse.ok) {
    throw new Error('Failed to send OTP');
  }
  
  // تأكيد OTP (يتم تنفيذها من خلال UI)
  const verifyOTP = async (otp, name) => {
    const response = await fetch(`${API_BASE}/auth/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        otp: otp,
        name: name
      }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      await AsyncStorage.setItem('accessToken', data.accessToken);
      await AsyncStorage.setItem('refreshToken', data.refreshToken);
      return data;
    } else {
      throw new Error(data.message);
    }
  };
  
  return { verifyOTP };
};

// التسجيل الجديد
const register = async (userData) => {
  // إرسال OTP للتسجيل
  const sendResponse = await fetch(`${API_BASE}/auth/register/otp/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      password: userData.password,
      language: 'ar'
    }),
  });
  
  if (!sendResponse.ok) {
    throw new Error('Failed to send registration OTP');
  }
  
  // تأكيد التسجيل
  const verifyResponse = await fetch(`${API_BASE}/auth/register/otp/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: userData.email,
      otp: userData.otp
    }),
  });
  
  const data = await verifyResponse.json();
  
  if (verifyResponse.ok) {
    await AsyncStorage.setItem('accessToken', data.accessToken);
    await AsyncStorage.setItem('refreshToken', data.refreshToken);
    return data;
  } else {
    throw new Error(data.message);
  }
};
```

---

## 🚀 تشغيل الإنتاج

### تشغيل النظام:
```bash
# استخدام ملف البيئة للإنتاج
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### فحص الحالة:
```bash
# فحص logs
docker-compose -f docker-compose.prod.yml logs api

# اختبار API
curl http://localhost:3000/api/v1/health
```

---

## 📞 الدعم والمساعدة

### في حالة وجود مشاكل:
1. تحقق من logs: `docker-compose logs api`
2. تحقق من إعدادات SMTP: `GET /api/v1/auth/email-config`
3. تحقق من حالة النظام: `GET /api/v1/health`

### معلومات الاتصال:
- **API Documentation**: `http://localhost:3000/api/v1/docs` (Development)
- **Queues Dashboard**: `http://localhost:3000/api/v1/queues` (Development)

---

## ✅ ملخص سريع

| العملية | Method | Endpoint | Authentication |
|---------|--------|----------|----------------|
| تسجيل دخول | POST | `/auth/login` | ❌ |
| تسجيل دخول OTP | POST | `/auth/otp/send` + `/auth/otp/verify` | ❌ |
| تسجيل جديد | POST | `/auth/register/otp/send` + `/auth/register/otp/verify` | ❌ |
| ملف شخصي | GET | `/auth/me` | ✅ Bearer Token |
| تجديد رمز | POST | `/auth/refresh` | ❌ |
| تسجيل دخول موظف | POST | `/auth/staff/login` | ❌ |
| فحص إعدادات | GET | `/auth/email-config` | ❌ |

---

## 🔄 فلو المصادقة الكامل

### 1. فلو التسجيل الجديد:
```
1. المستخدم يختار التسجيل
2. إدخال البيانات (اسم، بريد، هاتف، كلمة مرور)
3. إرسال POST /auth/register/otp/send
4. استلام OTP على البريد الإلكتروني
5. إدخال OTP
6. إرسال POST /auth/register/otp/verify
7. إنشاء حساب + محفظة تلقائياً
8. تسجيل دخول تلقائي + إرجاع الرموز
```

### 2. فلو تسجيل الدخول العادي:
```
1. المستخدم يختار تسجيل الدخول
2. إدخال البريد/الهاتف + كلمة المرور
3. إرسال POST /auth/login
4. التحقق من البيانات
5. إرجاع الرموز + معلومات المستخدم
```

### 3. فلو تسجيل الدخول بـ OTP:
```
1. المستخدم يختار تسجيل الدخول بـ OTP
2. إدخال البريد الإلكتروني
3. إرسال POST /auth/otp/send
4. استلام OTP على البريد الإلكتروني
5. إدخال OTP
6. إرسال POST /auth/otp/verify
7. تسجيل دخول ناجح + إرجاع الرموز
```

### 4. فلو إدارة الجلسة:
```
1. استخدام Access Token للـ API calls
2. عند انتهاء صلاحية الرمز (4 ساعات)
3. استخدام Refresh Token لتجديد الرمز
4. إرسال POST /auth/refresh
5. الحصول على رموز جديدة
6. متابعة الاستخدام
```

---

## 🎯 نصائح للمطورين

### 1. إدارة الرموز:
- احفظ الرموز بشكل آمن (AsyncStorage في React Native)
- تحقق من صلاحية الرمز قبل كل طلب
- استخدم Refresh Token تلقائياً عند انتهاء الصلاحية

### 2. معالجة الأخطاء:
- تحقق من كود الاستجابة دائماً
- اعرض رسائل خطأ واضحة للمستخدم
- أعد توجيه المستخدم لتسجيل الدخول عند انتهاء الجلسة

### 3. الأمان:
- لا تحفظ كلمات المرور في التطبيق
- استخدم HTTPS دائماً في الإنتاج
- تحقق من صحة البيانات قبل الإرسال

### 4. تجربة المستخدم:
- أظهر loading states أثناء الطلبات
- اعرض رسائل نجاح/فشل واضحة
- استخدم OTP كبديل سهل لكلمات المرور

---

هذا الدوكيومنتيشن يغطي جميع جوانب نظام المصادقة مع أمثلة عملية للاستخدام في تطبيق الموبايل.
