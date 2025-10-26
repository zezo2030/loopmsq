# Banner Image Upload System

## Overview
تم إضافة نظام رفع الصور للبانرات في الداشبورد الإداري، مما يسمح برفع الصور مباشرة من الجهاز بدلاً من إدخال URLs يدوياً.

## Features
- رفع الصور مباشرة من الداشبورد
- معاينة الصور قبل الحفظ
- التحقق من نوع الملف (jpg, jpeg, png, gif, webp)
- التحقق من حجم الملف (حد أقصى 5MB)
- خدمة الصور عبر API للعرض في الموبايل

## Backend Changes

### 1. Upload Endpoint
- **URL**: `POST /api/v1/admin/banners/upload`
- **Authentication**: Required (Admin only)
- **Content-Type**: `multipart/form-data`
- **Field**: `file` (image file)

### 2. Static File Serving
- **URL**: `GET /uploads/banners/{filename}`
- الصور متاحة عبر هذا المسار للعرض في الموبايل

### 3. File Storage
- **Location**: `./uploads/banners/`
- **Naming**: `{timestamp}-{random}.{extension}`

## Frontend Changes

### 1. Upload Component
- استخدام Ant Design Upload component
- معاينة الصورة بعد الرفع
- رسائل نجاح/فشل الرفع

### 2. API Helper
- إضافة `apiUpload()` function في `api.ts`
- دعم FormData مع Authorization header

## Usage

### في الداشبورد:
1. اضغط على "New Banner" أو "Edit Banner"
2. اضغط على "Upload Image" لرفع صورة
3. ستظهر معاينة للصورة المرفوعة
4. احفظ البانر

### في الموبايل:
```dart
// استخدام الصورة في Flutter
Image.network('https://your-api-domain.com/uploads/banners/filename.jpg')
```

## File Validation
- **Types**: jpg, jpeg, png, gif, webp
- **Size**: Maximum 5MB
- **Error Handling**: رسائل خطأ واضحة للمستخدم

## Security
- المصادقة مطلوبة للرفع
- صلاحيات Admin فقط
- التحقق من نوع الملف على مستوى الخادم
