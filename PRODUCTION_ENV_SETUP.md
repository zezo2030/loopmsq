# Production Environment Setup

## متغيرات البيئة المطلوبة للإنتاج

### 1. إنشاء ملف `.env.production`:

```env
# Database Configuration
POSTGRES_PASSWORD=your-secure-postgres-password

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-for-production
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-for-production

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-for-production

# Admin Configuration
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourSecureAdminPassword123!
ADMIN_NAME=Admin
ADMIN_PHONE=+966500000000
ADMIN_OVERWRITE=false

# SMTP Email Configuration (Required for OTP emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com

# Frontend Configuration
NEXT_PUBLIC_API_BASE=https://yourdomain.com/api/v1

# SSL / Let's Encrypt (للاستخدام على الخادم)
LETSENCRYPT_EMAIL=admin@yourdomain.com
```

### 2. تشغيل الإنتاج (دون Nginx داخل Docker):

```bash
# استخدام ملف البيئة للإنتاج
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

> يقوم ملف الـ compose الآن بفتح المنفذين `3000` (لواجهة الـ API) و `8080` (واجهة الإدارة) لكي يتمكن Nginx المثبت على الخادم من التوجيه إليهما.

### 3. تهيئة Nginx على الخادم الرئيسي:

1. ثبّت Nginx و Certbot (مثال أوبونتو):

   ```bash
   sudo apt update
   sudo apt install nginx certbot python3-certbot-nginx
   ```

2. انسخ الملف `docs/nginx-host.conf.example` إلى الخادم واحفظه في `/etc/nginx/sites-available/kinetic-app.conf`. ثم حدّث أسماء النطاقات إذا لزم الأمر.

3. أنشئ مجلد التحدي لشهادة Let's Encrypt:

   ```bash
   sudo mkdir -p /var/www/certbot
   sudo chown www-data:www-data /var/www/certbot
   ```

4. فعّل الملف:

   ```bash
   sudo ln -s /etc/nginx/sites-available/kinetic-app.conf /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. أصدر الشهادة لأول مرة:

   ```bash
   sudo certbot certonly --webroot -w /var/www/certbot \
     -d kinetic-app.cloud -d www.kinetic-app.cloud \
     --email "$LETSENCRYPT_EMAIL" --agree-tos --no-eff-email
   ```

6. بعد نجاح الإصدار، أعد تحميل Nginx:

   ```bash
   sudo systemctl reload nginx
   ```

> يمكن لـ Certbot إضافة مهمة كرون للتحقق مرتين يوميًا (`/etc/cron.d/certbot`) لتجديد الشهادة تلقائيًا.

### 4. إعدادات SMTP للإنتاج:

#### Gmail (مثال):
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-production-email@gmail.com
SMTP_PASS=your-production-app-password
SMTP_FROM=noreply@yourdomain.com
```

#### Outlook (بديل):
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
SMTP_FROM=noreply@yourdomain.com
```

#### SendGrid (احترافي):
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com
```

### 5. التحقق من التكوين:

```bash
# تحقق من logs
docker-compose -f docker-compose.prod.yml logs api

# اختبر endpoint
curl https://yourdomain.com/api/v1/auth/email-config
```

### 6. نصائح الأمان للإنتاج:

1. **استخدم كلمات مرور قوية**
2. **لا تشارك ملف .env.production**
3. **استخدم App Passwords للبريد**
4. **فعّل 2FA على جميع الحسابات**
5. **استخدم HTTPS في الإنتاج**

## ✅ تم تحديث الملفات:

- ✅ `docker-compose.yml` - إعدادات التطوير
- ✅ `docker-compose.prod.yml` - إعدادات الإنتاج
- ✅ إضافة متغيرات SMTP في كلا الملفين
