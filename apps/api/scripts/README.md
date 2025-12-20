# Database Management Scripts

هذا المجلد يحتوي على سكريبتات لإدارة قاعدة البيانات.

## مسح البيانات (Clear Database)

### Windows (PowerShell)
```powershell
cd loopmsq
.\apps\api\scripts\clear-database.ps1
```

### Linux/Mac (Bash)
```bash
cd loopmsq
./apps/api/scripts/clear-database.sh
```

**ما يفعله هذا السكريبت:**
- يمسح جميع البيانات من جميع الجداول
- يحتفظ بهيكل الجداول (الجدول نفسه لا يُحذف)
- يمكنك إعادة استخدام قاعدة البيانات مباشرة بعد المسح

## إعادة تعيين قاعدة البيانات بالكامل (Reset Database)

⚠️ **تحذير:** هذا سيحذف قاعدة البيانات بالكامل ويُنشئها من جديد!

### Windows (PowerShell)
```powershell
cd loopmsq
.\apps\api\scripts\reset-database.ps1
```

### Linux/Mac (Bash)
```bash
cd loopmsq
./apps/api/scripts/reset-database.sh
```

**ما يفعله هذا السكريبت:**
- يوقف الحاويات
- يحذف volume قاعدة البيانات بالكامل
- يعيد إنشاء قاعدة البيانات من الصفر
- ستحتاج إلى تشغيل migrations مرة أخرى

## استخدام SQL مباشرة

يمكنك أيضاً استخدام ملف SQL مباشرة:

```bash
# Windows PowerShell
Get-Content apps/api/scripts/clear-database.sql | docker exec -i booking-postgres psql -U postgres -d booking_platform

# Linux/Mac
cat apps/api/scripts/clear-database.sql | docker exec -i booking-postgres psql -U postgres -d booking_platform
```

## ملاحظات

- تأكد من أن حاوية PostgreSQL تعمل قبل تشغيل السكريبتات
- إذا كنت تستخدم `docker-compose.dev.yml`، سيتم اكتشافه تلقائياً
- بعد مسح البيانات، سيتم إعادة إنشاء مستخدم Admin تلقائياً عند تشغيل API (إذا كان `ADMIN_OVERWRITE=true`)





















