# تحسينات إعدادات النشر (Docker/Nginx)

## ملخص التحسينات

تم مراجعة وتحسين إعدادات النشر للمشروع لضمان عمل صحيح في بيئات التطوير والإنتاج.

## التغييرات المطبقة

### 1. تحسين `apps/branch/nginx.conf`
- ✅ إضافة `location /api/` لتوجيه طلبات API إلى الخادم الخلفي
- ✅ إضافة `location /uploads/` لتوجيه طلبات الملفات المرفوعة
- ✅ إضافة headers مناسبة للـ proxy

### 2. تحسين `apps/admin/nginx.conf`
- ✅ إضافة `proxy_read_timeout` و `proxy_connect_timeout` لتحسين الأداء
- ✅ تحسين إعدادات الـ proxy headers

### 3. تحسين `runtime-entrypoint.sh` (admin & branch)
- ✅ تحسين معالجة `NEXT_PUBLIC_API_BASE` للتعامل مع:
  - Relative paths (مثل `/api/v1`) - للاستخدام مع nginx proxy
  - Absolute URLs (مثل `http://localhost:3000/api/v1`) - للتطوير المحلي
- ✅ إضافة تعليقات توضيحية

### 4. تحسين `docs/nginx-host.conf.example`
- ✅ إضافة `location /uploads/` مع cache headers
- ✅ إضافة `proxy_read_timeout` و `proxy_connect_timeout`
- ✅ تحسين إعدادات الـ caching للملفات المرفوعة

### 5. تحسين `docker-compose.prod.yml`
- ✅ إضافة `networks` configuration للخدمات
- ✅ تحسين `depends_on` مع `condition: service_started`
- ✅ ضمان أن جميع الخدمات على نفس الشبكة

### 6. تحسين `docker-compose.yml` (التطوير)
- ✅ تغيير `NEXT_PUBLIC_API_BASE` من `http://localhost:3000/api/v1` إلى `/api/v1`
- ✅ إضافة `networks` configuration
- ✅ تحسين `depends_on` مع health check

## كيفية الاستخدام

### للتطوير المحلي:
```bash
docker-compose up -d
```
- API: `http://localhost:3000`
- Console: `http://localhost:3001`
- الـ console يستخدم `/api/v1` (relative path) ويتم التوجيه عبر nginx داخل الحاوية

### للإنتاج:
```bash
# 1. أنشئ ملف .env.production
cp .env.example .env.production
# عدّل المتغيرات حسب الحاجة

# 2. شغّل الخدمات
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# 3. ثبّت Nginx على الخادم
# 4. انسخ docs/nginx-host.conf.example إلى /etc/nginx/sites-available/
# 5. فعّل الملف وأعد تحميل nginx
```

## إعدادات `NEXT_PUBLIC_API_BASE`

### في Docker (مع nginx proxy):
```env
NEXT_PUBLIC_API_BASE=/api/v1
```
- يستخدم relative path
- nginx داخل الحاوية يتولى التوجيه إلى `http://api:3000/api/`

### في الإنتاج (مع nginx خارجي):
```env
NEXT_PUBLIC_API_BASE=/api/v1
```
- يستخدم relative path
- nginx على الخادم يتولى التوجيه إلى `http://127.0.0.1:3000/api/`

### للتطوير المحلي (بدون Docker):
```env
VITE_API_BASE=http://localhost:3000/api/v1
```
- يستخدم absolute URL
- الاتصال مباشر إلى API

## ملاحظات مهمة

1. **الشبكة (Network)**: جميع الخدمات يجب أن تكون على نفس الشبكة `booking-network` للتواصل الداخلي
2. **Health Checks**: تم إضافة health checks للـ API لضمان بدء الخدمات بالترتيب الصحيح
3. **Timeouts**: تم إضافة timeouts مناسبة للـ proxy لتحسين الأداء
4. **Caching**: تم إضافة caching للملفات المرفوعة في nginx-host.conf.example

## استكشاف الأخطاء

### مشكلة: `ERR_CONNECTION_REFUSED`
- تأكد أن API يعمل: `docker-compose ps`
- تحقق من logs: `docker-compose logs api`
- تأكد من أن nginx داخل الحاوية يمكنه الوصول إلى `api:3000`

### مشكلة: API requests لا تعمل
- تحقق من `NEXT_PUBLIC_API_BASE` في environment variables
- تحقق من nginx logs: `docker-compose logs console`
- تأكد من أن `runtime-config.js` يتم تحميله في المتصفح

### مشكلة: الملفات المرفوعة لا تظهر
- تحقق من `location /uploads/` في nginx.conf
- تأكد من أن volume mount صحيح: `./uploads:/app/uploads`
- تحقق من permissions على مجلد uploads

## الملفات المعدلة

- ✅ `apps/admin/nginx.conf`
- ✅ `apps/admin/runtime-entrypoint.sh`
- ✅ `apps/branch/nginx.conf`
- ✅ `apps/branch/runtime-entrypoint.sh`
- ✅ `docs/nginx-host.conf.example`
- ✅ `docker-compose.yml`
- ✅ `docker-compose.prod.yml`










