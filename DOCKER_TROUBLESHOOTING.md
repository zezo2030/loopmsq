# Docker Build Troubleshooting Guide

## TLS Handshake Timeout Issues

إذا واجهت خطأ `TLS handshake timeout` عند بناء Docker images، جرب الحلول التالية:

### الحل السريع (Quick Fix)

#### Windows (PowerShell):
```powershell
# استخدم السكريبت المرفق
.\docker-build.ps1 admin

# أو بناء جميع الخدمات
.\docker-build.ps1
```

#### Linux/WSL/Mac:
```bash
# امنح الصلاحيات أولاً
chmod +x docker-build.sh

# ثم نفذ السكريبت
./docker-build.sh admin

# أو بناء جميع الخدمات
./docker-build.sh
```

---

## الحلول التفصيلية

### 1. زيادة Timeout في Docker

#### Windows PowerShell:
```powershell
$env:COMPOSE_HTTP_TIMEOUT = "600"
$env:DOCKER_CLIENT_TIMEOUT = "600"
docker-compose build --no-cache admin
```

#### Linux/Mac:
```bash
export COMPOSE_HTTP_TIMEOUT=600
export DOCKER_CLIENT_TIMEOUT=600
docker-compose build --no-cache admin
```

### 2. سحب الـ Images مسبقاً (Pre-pull)

```bash
# سحب الـ base images قبل البناء
docker pull node:20
docker pull node:20-alpine
docker pull node:18-alpine

# ثم ابنِ
docker-compose build --no-cache admin
```

### 3. تكوين Docker Registry Mirror

#### Docker Desktop (Windows/Mac):
1. افتح Docker Desktop
2. اذهب إلى Settings → Docker Engine
3. أضف المرآة (mirror):

```json
{
  "registry-mirrors": [
    "https://mirror.gcr.io",
    "https://dockerhub.azk8s.cn"
  ],
  "dns": ["8.8.8.8", "8.8.4.4"]
}
```

4. اضغط "Apply & Restart"

#### Linux:
أنشئ أو عدّل `/etc/docker/daemon.json`:

```json
{
  "registry-mirrors": [
    "https://mirror.gcr.io",
    "https://dockerhub.azk8s.cn"
  ],
  "dns": ["8.8.8.8", "8.8.4.4"]
}
```

ثم أعد تشغيل Docker:
```bash
sudo systemctl restart docker
```

### 4. إعدادات الـ Proxy

إذا كنت خلف proxy:

#### Docker Desktop:
- Settings → Resources → Proxies
- فعّل "Manual proxy configuration"
- أدخل عنوان الـ proxy

#### Linux:
أنشئ ملف `/etc/systemd/system/docker.service.d/http-proxy.conf`:

```ini
[Service]
Environment="HTTP_PROXY=http://proxy.example.com:8080"
Environment="HTTPS_PROXY=http://proxy.example.com:8080"
Environment="NO_PROXY=localhost,127.0.0.1"
```

ثم:
```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 5. تنظيف Docker Cache

```bash
# تنظيف شامل (احذر: سيحذف كل الـ images غير المستخدمة)
docker system prune -a

# تنظيف Build cache فقط
docker builder prune -a
```

### 6. استخدام Image محفوظ محلياً

إذا فشلت كل الطرق، يمكنك:

```bash
# 1. سحب الـ image على جهاز آخر
docker pull nginx:alpine
docker save nginx:alpine -o nginx-alpine.tar

# 2. انقل الملف إلى جهازك
# 3. حمّله
docker load -i nginx-alpine.tar
```

---

## فحص المشكلة

### فحص الاتصال بـ Docker Hub:
```powershell
# Windows
nslookup registry-1.docker.io
Test-NetConnection registry-1.docker.io -Port 443

# Linux/Mac
nslookup registry-1.docker.io
curl -I https://registry-1.docker.io/v2/
```

### فحص إعدادات Docker:
```bash
docker info
docker version
```

### فحص الـ logs:
```bash
# بناء مع عرض التفاصيل
docker-compose build --progress plain admin
```

---

## أسباب شائعة للمشكلة

1. **اتصال إنترنت ضعيف**: جرب على شبكة أخرى
2. **Firewall/Antivirus**: عطّلهم مؤقتاً للتجربة
3. **VPN**: عطّل الـ VPN أو جرب VPN آخر
4. **ISP Blocking**: بعض مزودي الخدمة يحجبون Docker Hub
5. **Docker Desktop Issues**: أعد تشغيل Docker Desktop
6. **WSL2 Network Issues** (Windows): أعد تشغيل WSL
   ```powershell
   wsl --shutdown
   ```

---

## البناء بدون Cache

إذا واجهت مشاكل مع الـ cache:

```bash
docker-compose build --no-cache --pull admin
```

---

## الاتصال بالدعم

إذا استمرت المشكلة، شارك هذه المعلومات:

```bash
# معلومات النظام
docker info > docker-info.txt
docker version > docker-version.txt

# آخر محاولة بناء مع التفاصيل
docker-compose build --progress plain admin 2>&1 | tee build-log.txt
```

---

## ملاحظات إضافية

### للمطورين في السعودية/الخليج:
بعض مزودي الخدمة قد يحجبون أو يبطئون الوصول إلى Docker Hub. جرب:
- استخدام VPN
- استخدام mirror محلي إن وُجد
- البناء في وقت مختلف من اليوم

### لمستخدمي الشركات:
اتصل بقسم IT للحصول على:
- إعدادات الـ proxy الصحيحة
- registry mirror داخلي
- استثناءات الـ firewall لـ Docker Hub

---

## الخلاصة

التغييرات المطبقة في هذا المشروع:

1. ✅ استبدال `nginx:alpine` بـ `node:20-alpine` + تثبيت nginx
2. ✅ إزالة الاعتماد على Google Container Registry Mirror
3. ✅ إضافة `.dockerignore` لتسريع البناء
4. ✅ توفير سكريبتات بناء مع معالجة timeout
5. ✅ توحيد base images لتقليل عمليات السحب

الآن يمكنك البناء باستخدام:
```bash
# Windows
.\docker-build.ps1 admin

# Linux/Mac
./docker-build.sh admin
```

أو يدوياً:
```bash
docker-compose build --no-cache admin
docker-compose up -d admin
```

