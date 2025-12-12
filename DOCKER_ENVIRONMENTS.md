# دليل بيئات Docker Compose

هذا الملف يشرح الأوضاع الثلاثة المتاحة لتشغيل المشروع باستخدام Docker Compose.

## 📋 الأوضاع المتاحة

### 1. `docker-compose.yml` - **وضع التطوير الكامل** (موصى به للتطوير)

**الاستخدام:**
```bash
docker compose up -d
```

**المميزات:**
- ✅ يحتوي على جميع الخدمات: API, Console, Postgres, Redis
- ✅ أدوات مساعدة: Adminer (إدارة قاعدة البيانات), Redis Commander
- ✅ **Hot Reload تلقائي** - التغييرات في الكود تنعكس تلقائياً بدون إعادة تشغيل
- ✅ أسرع من وضع الإنتاج (لا يحتاج لإعادة بناء في كل مرة)
- ✅ مناسب للتطوير اليومي

**الخدمات:**
- `booking-backend` (API) - Port 3000
- `booking-console` (Admin Panel) - Port 3001
- `booking-postgres` (Database) - Port 5432
- `booking-redis` (Cache) - Internal
- `booking-adminer` (DB Management) - Port 8080
- `booking-redis-commander` (Redis Management) - Port 8081

**ملاحظات:**
- يستخدم `NODE_ENV=development`
- كلمات مرور افتراضية للتطوير
- يحتوي على جميع متغيرات البيئة المطلوبة

---

### 2. `docker-compose.dev.yml` - **وضع التطوير البسيط**

**الاستخدام:**
```bash
docker compose -f docker-compose.dev.yml up -d
```

**المميزات:**
- ✅ نفس ميزات `docker-compose.yml`
- ✅ أسماء containers منفصلة (`-dev` suffix)
- ✅ volumes منفصلة (`_dev` suffix)
- ✅ شبكة منفصلة (`booking-network-dev`)
- ✅ مفيد عند تشغيل عدة بيئات في نفس الوقت

**الخدمات:** (نفس الخدمات في `docker-compose.yml`)

**الفرق عن `docker-compose.yml`:**
- أسماء containers مختلفة لتجنب التعارض
- volumes منفصلة
- شبكة منفصلة

---

### 3. `docker-compose.prod.yml` - **وضع الإنتاج**

**الاستخدام:**
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

**المميزات:**
- ✅ مبني للإنتاج - محسّن للأداء
- ✅ يستخدم متغيرات البيئة من `.env` file
- ✅ أمان أعلى (كلمات مرور من متغيرات البيئة)
- ✅ لا يحتوي على أدوات التطوير (Adminer, Redis Commander)

**الخدمات:**
- `booking-backend` (API) - Port 3000
- `booking-console` (Admin Panel) - Port 8080
- `booking-postgres` (Database) - Port 5432
- `booking-redis` (Cache) - Internal

**ملاحظات مهمة:**
- ⚠️ **يستغرق وقت أطول** - يبني الصور من الصفر
- ⚠️ يحتاج ملف `.env` مع جميع المتغيرات المطلوبة
- ⚠️ مناسب للنشر فقط، ليس للتطوير اليومي

**المتغيرات المطلوبة في `.env`:**
```env
POSTGRES_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
ENCRYPTION_KEY=your-32-character-key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure-password
ADMIN_NAME=Admin Name
ADMIN_PHONE=+966500000000
ADMIN_OVERWRITE=true
DREAMS_API_URL=...
DREAMS_USER=...
DREAMS_SECRET_KEY=...
DREAMS_SENDER=...
TAP_SECRET_KEY=...
TAP_PUBLIC_KEY=...
TAP_API_BASE=...
PAYMENT_WEBHOOK_SECRET=...
```

---

## 🚀 التوصيات

### للتطوير اليومي:
```bash
# استخدم docker-compose.yml (الأسرع والأسهل)
docker compose up -d

# عند تغيير dependencies، أعد البناء:
docker compose up -d --build
```

## 🔥 Hot Reload - إعادة التحميل التلقائي

### ✅ **لا تحتاج لإعادة التشغيل عند التعديل في الكود!**

عند استخدام `docker-compose.yml` أو `docker-compose.dev.yml`:

1. **التغييرات في الكود تنعكس تلقائياً** - لا حاجة لإعادة تشغيل Docker
2. **NestJS Watch Mode** - يراقب التغييرات ويعيد التشغيل تلقائياً
3. **حفظ الملف = تحديث تلقائي** - فقط احفظ الملف وسيتم إعادة تحميل الخادم

### كيف يعمل:

- الكود المصدري مربوط بـ **volume mount** مباشرة
- NestJS يعمل في وضع `start:dev` مع `--watch`
- أي تغيير في ملفات `.ts` يتم اكتشافه تلقائياً

### متى تحتاج لإعادة البناء:

- ✅ عند إضافة/تعديل `package.json` (dependencies جديدة)
- ✅ عند تغيير Dockerfile
- ✅ عند تغيير متغيرات البيئة في docker-compose.yml

### متى لا تحتاج لإعادة البناء:

- ❌ عند تعديل أي ملف في `apps/api/src/`
- ❌ عند تعديل أي ملف TypeScript
- ❌ عند إضافة ملفات جديدة في المشروع

### عرض اللوجات لمراقبة Hot Reload:

```bash
# عرض لوجات API لرؤية التحديثات التلقائية
docker compose logs -f api
```

سترى رسائل مثل:
```
[Nest] INFO  [NestFactory] Starting Nest application...
[Nest] INFO  File change detected. Starting incremental compilation...
[Nest] INFO  Found 0 errors. Watching for file changes.
```

### للإنتاج:
```bash
# تأكد من وجود ملف .env مع جميع المتغيرات
docker compose -f docker-compose.prod.yml up -d --build
```

### لتشغيل بيئتين في نفس الوقت:
```bash
# بيئة تطوير عادية
docker compose up -d

# بيئة تطوير منفصلة
docker compose -f docker-compose.dev.yml up -d
```

---

## 📊 مقارنة سريعة

| الميزة | docker-compose.yml | docker-compose.dev.yml | docker-compose.prod.yml |
|--------|-------------------|------------------------|-------------------------|
| **سرعة البناء** | ⚡ سريع | ⚡ سريع | 🐌 بطيء |
| **API** | ✅ | ✅ | ✅ |
| **Console** | ✅ | ✅ | ✅ |
| **Adminer** | ✅ | ✅ | ❌ |
| **Redis Commander** | ✅ | ✅ | ❌ |
| **Hot Reload** | ✅ | ✅ | ❌ |
| **أمان** | ⚠️ تطوير | ⚠️ تطوير | ✅ إنتاج |
| **استخدام** | تطوير يومي | تطوير متعدد | إنتاج فقط |

---

## 🔧 أوامر مفيدة

### عرض الحالة:
```bash
docker compose ps
```

### عرض اللوجات:
```bash
docker compose logs -f api
docker compose logs -f console
```

### إيقاف الخدمات:
```bash
docker compose down
```

### إيقاف مع حذف Volumes:
```bash
docker compose down -v
```

### إعادة بناء خدمة معينة:
```bash
docker compose build api
docker compose up -d api
```

---

## ⚠️ ملاحظات مهمة

1. **لا تستخدم `docker-compose.prod.yml` للتطوير** - سيكون بطيئاً جداً
2. **استخدم `docker-compose.yml` للتطوير اليومي** - الأسرع والأسهل
3. **تأكد من وجود ملف `.env`** عند استخدام وضع الإنتاج
4. **Volumes منفصلة** - البيانات في `docker-compose.dev.yml` منفصلة عن `docker-compose.yml`

