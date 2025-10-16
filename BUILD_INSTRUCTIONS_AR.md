# تعليمات البناء - حل مشكلة TLS Timeout

## المشكلة
عند بناء Docker images، تظهر رسالة خطأ:
```
net/http: TLS handshake timeout
```

## الحل المطبق ✅

تم تعديل ملفات Dockerfile لتجنب سحب `nginx:alpine` مباشرة من Docker Hub:

### قبل:
```dockerfile
FROM nginx:alpine AS prod
```

### بعد:
```dockerfile
FROM node:20-alpine AS prod
RUN apk add --no-cache nginx
```

هذا يستخدم image واحد فقط (`node:20-alpine`) ويثبت nginx من Alpine package manager بدلاً من سحب image منفصل.

---

## طريقة البناء

### الطريقة الأولى: استخدام السكريبت (موصى بها) ⭐

#### Windows (PowerShell):
```powershell
.\docker-build.ps1 admin
```

#### Linux/WSL/Mac:
```bash
chmod +x docker-build.sh
./docker-build.sh admin
```

السكريبت سيقوم بـ:
- ✅ زيادة timeout تلقائياً
- ✅ سحب الـ base images مسبقاً
- ✅ إعادة المحاولة عند الفشل
- ✅ عرض رسائل واضحة

### الطريقة الثانية: يدوياً

#### 1. زيادة Timeout:
```powershell
# Windows PowerShell
$env:COMPOSE_HTTP_TIMEOUT = "600"
$env:DOCKER_CLIENT_TIMEOUT = "600"
```

```bash
# Linux/Mac
export COMPOSE_HTTP_TIMEOUT=600
export DOCKER_CLIENT_TIMEOUT=600
```

#### 2. سحب Images مسبقاً (اختياري):
```bash
docker pull node:20
docker pull node:20-alpine
```

#### 3. بناء الـ Admin:
```bash
docker-compose build --no-cache admin
```

#### 4. تشغيل الـ Container:
```bash
docker-compose up -d admin
```

---

## التحقق من النجاح

بعد البناء الناجح:

```bash
# عرض الـ containers
docker-compose ps

# فحص logs
docker-compose logs admin

# الوصول للتطبيق
# افتح المتصفح على: http://localhost:3001
```

---

## إذا استمرت المشكلة

### الحل 1: تكوين Registry Mirror

افتح Docker Desktop → Settings → Docker Engine وأضف:

```json
{
  "registry-mirrors": ["https://mirror.gcr.io"],
  "dns": ["8.8.8.8", "8.8.4.4"]
}
```

اضغط Apply & Restart ثم حاول البناء مرة أخرى.

### الحل 2: تنظيف Docker

```bash
# تنظيف build cache
docker builder prune -a

# ثم حاول البناء
docker-compose build --no-cache admin
```

### الحل 3: فحص الاتصال

```powershell
# Windows - فحص DNS
nslookup registry-1.docker.io

# Windows - فحص الاتصال
Test-NetConnection registry-1.docker.io -Port 443
```

```bash
# Linux/Mac
curl -I https://registry-1.docker.io/v2/
```

### الحل 4: استخدام VPN

إذا كان ISP الخاص بك يحجب أو يبطئ Docker Hub:
- جرب VPN
- أو استخدم hotspot من جهاز آخر

---

## الملفات المعدلة

1. ✅ `apps/admin/Dockerfile` - استبدال nginx:alpine
2. ✅ `apps/api/Dockerfile` - توحيد node images
3. ✅ `Dockerfile` - توحيد node images
4. ✅ `.dockerignore` - جديد (تسريع البناء)
5. ✅ `docker-build.ps1` - سكريبت Windows
6. ✅ `docker-build.sh` - سكريبت Linux/Mac
7. ✅ `DOCKER_TROUBLESHOOTING.md` - دليل شامل بالإنجليزية
8. ✅ `BUILD_INSTRUCTIONS_AR.md` - هذا الملف

---

## بناء جميع الخدمات

لبناء كل شيء دفعة واحدة:

```powershell
# Windows
.\docker-build.ps1

# Linux/Mac
./docker-build.sh
```

أو يدوياً:
```bash
docker-compose build --no-cache
docker-compose up -d
```

---

## نصائح إضافية

### تسريع البناء:
- ✅ استخدم `--no-cache` فقط عند الضرورة
- ✅ الملف `.dockerignore` يمنع نسخ ملفات غير ضرورية
- ✅ بناء خدمة واحدة بدلاً من الكل عند التطوير

### توفير Bandwidth:
- ✅ الـ images الجديدة تستخدم node:20 و node:20-alpine فقط
- ✅ لا حاجة لسحب nginx:alpine منفصل
- ✅ Alpine images أصغر من الـ full images

### التطوير:
```bash
# للتطوير، استخدم docker-compose.dev.yml
docker-compose -f docker-compose.dev.yml up
```

---

## الدعم

إذا واجهت مشاكل:

1. راجع `DOCKER_TROUBLESHOOTING.md` للحلول الشاملة
2. شغّل مع `--progress plain` لمزيد من التفاصيل:
   ```bash
   docker-compose build --progress plain admin
   ```
3. احفظ الـ logs:
   ```bash
   docker-compose build admin 2>&1 | Out-File -FilePath build-log.txt
   ```

---

## ملخص سريع 🚀

```powershell
# Windows - نفّذ هذا الأمر فقط:
.\docker-build.ps1 admin
```

```bash
# Linux/Mac - نفّذ هذا الأمر فقط:
chmod +x docker-build.sh && ./docker-build.sh admin
```

ثم افتح: http://localhost:3001

**تم! بالتوفيق 🎉**

