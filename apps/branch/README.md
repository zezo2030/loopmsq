# Branch Manager Dashboard

لوحة تحكم مخصصة لمديري الفروع لإدارة فرعهم وقاعاتهم وحجوزاتهم وموظفيهم.

## المميزات

### 🔐 المصادقة والأمان
- تسجيل دخول آمن لمديري الفروع فقط
- حماية الصفحات بـ Auth Guard
- دعم RTL للعربية

### 📊 لوحة التحكم الرئيسية
- إحصائيات الفرع الرئيسية
- مؤشرات الأداء (KPIs)
- آخر الحجوزات والأنشطة
- رسوم بيانية للإيرادات

### 🏢 إدارة الفرع
- عرض وتعديل معلومات الفرع
- إدارة أوقات العمل والخدمات
- تحديث حالة الفرع

### 🏛️ إدارة القاعات
- قائمة القاعات مع الإحصائيات
- إنشاء وتعديل القاعات
- إدارة التسعير والمزايا
- تغيير حالة القاعات

### 📅 إدارة الحجوزات
- قائمة الحجوزات مع الفلاتر
- تفاصيل الحجز الكاملة
- إلغاء الحجوزات
- فلاتر حسب التاريخ والحالة

### 👥 إدارة الموظفين
- قائمة الموظفين
- إنشاء موظفين جدد
- تفعيل/تعطيل الموظفين
- إحصائيات الموظفين

### 📈 التقارير والتحليلات
- تقارير شاملة للفرع
- مؤشرات الأداء
- تصدير CSV
- تحليل الإيرادات

## التقنيات المستخدمة

- **React 19** - مكتبة واجهة المستخدم
- **TypeScript** - لغة البرمجة
- **Vite** - أداة البناء
- **Ant Design** - مكتبة مكونات UI
- **React Query** - إدارة البيانات
- **React Router** - التنقل
- **i18next** - التعريب
- **CSS Variables** - التصميم

## التثبيت والتشغيل

```bash
# تثبيت التبعيات
npm install

# تشغيل في وضع التطوير
npm run dev

# بناء للإنتاج
npm run build

# معاينة البناء
npm run preview
```

## متغيرات البيئة

```env
VITE_API_BASE=http://localhost:3000/api/v1
```

## البنية

```
src/
├── main.tsx              # نقطة البداية
├── App.tsx               # Auth Guard
├── auth.ts               # إدارة المصادقة
├── api.ts                # دوال API
├── i18n.ts               # إعداد التعريب
├── theme.css             # التصميم
├── layouts/
│   └── MainLayout.tsx    # التخطيط الرئيسي
├── pages/
│   ├── Login.tsx         # تسجيل الدخول
│   ├── Dashboard.tsx     # لوحة التحكم
│   ├── branch/
│   │   └── BranchInfo.tsx
│   ├── halls/
│   │   ├── HallsList.tsx
│   │   └── HallForm.tsx
│   ├── bookings/
│   │   ├── BookingsList.tsx
│   │   └── BookingDetail.tsx
│   ├── staff/
│   │   ├── StaffList.tsx
│   │   └── CreateStaff.tsx
│   └── reports/
│       └── Overview.tsx
└── locales/
    ├── ar/common.json    # الترجمة العربية
    └── en/common.json    # الترجمة الإنجليزية
```

## API Endpoints

### المصادقة
- `POST /auth/staff/login` - تسجيل دخول الموظفين
- `GET /auth/me` - معلومات المستخدم الحالي

### إدارة الفرع
- `GET /content/branches/:id` - جلب معلومات الفرع
- `PUT /content/branches/:id` - تحديث الفرع

### إدارة القاعات
- `GET /content/halls?branchId=X` - قائمة القاعات
- `POST /content/halls` - إنشاء قاعة
- `PUT /content/halls/:id` - تحديث قاعة
- `PATCH /content/halls/:id/status` - تغيير حالة القاعة

### إدارة الحجوزات
- `GET /bookings/branch/me` - حجوزات الفرع
- `GET /bookings/:id` - تفاصيل الحجز
- `POST /bookings/:id/cancel` - إلغاء الحجز

### إدارة الموظفين
- `POST /users/staff` - إنشاء موظف
- `GET /users?role=staff&branchId=X` - قائمة الموظفين
- `PATCH /users/:id/activate` - تفعيل الموظف
- `PATCH /users/:id/deactivate` - تعطيل الموظف

### التقارير
- `GET /reports/overview` - نظرة عامة على التقارير
- `GET /reports/export` - تصدير CSV

## الصلاحيات

- **BRANCH_MANAGER فقط**: يمكن لمديري الفروع فقط الوصول للوحة التحكم
- **branchId**: يتم استخراجه من token المستخدم
- **فلترة تلقائية**: جميع الطلبات تُفلتر حسب branchId

## التعريب

- دعم كامل للعربية والإنجليزية
- RTL للعربية
- تبديل اللغة من Header
- جميع النصوص مترجمة

## التصميم

- تصميم حديث ومتجاوب
- ألوان متسقة مع نظام التصميم
- دعم RTL
- تجربة مستخدم محسنة

## التطوير

```bash
# تشغيل في وضع التطوير
npm run dev

# فحص الأخطاء
npm run lint

# بناء للإنتاج
npm run build
```

## المساهمة

1. Fork المشروع
2. إنشاء فرع للميزة الجديدة
3. Commit التغييرات
4. Push للفرع
5. إنشاء Pull Request

## الترخيص

هذا المشروع مرخص تحت رخصة MIT.