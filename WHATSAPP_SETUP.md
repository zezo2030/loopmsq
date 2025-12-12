# إعداد WhatsApp Business API لإرسال OTP

تم استبدال Dreams SMS بـ WhatsApp Business API لإرسال رموز التحقق (OTP).

## المميزات

- ✅ **مجاني**: قوالب المصادقة (Authentication Templates) مجانية في معظم البلدان
- ✅ **معدل فتح أعلى**: WhatsApp له معدل فتح أعلى من SMS
- ✅ **تجربة مستخدم أفضل**: واجهة مألوفة للمستخدمين

## المتطلبات

1. حساب WhatsApp Business API من Meta
2. Access Token
3. Phone Number ID

## خطوات الإعداد

> 📖 **دليل مفصل**: راجع ملف [WHATSAPP_KEYS_GUIDE.md](./WHATSAPP_KEYS_GUIDE.md) للحصول على دليل خطوة بخطوة مفصل للحصول على المفاتيح.

### 1. إنشاء حساب WhatsApp Business API

1. اذهب إلى [Meta for Developers](https://developers.facebook.com/)
2. أنشئ تطبيق جديد من نوع "Business"
3. أضف منتج "WhatsApp" إلى التطبيق
4. اتبع التعليمات للحصول على:
   - **Access Token**: من قسم WhatsApp > API Setup
   - **Phone Number ID**: من قسم WhatsApp > API Setup

**للحصول على دليل مفصل خطوة بخطوة**: راجع [WHATSAPP_KEYS_GUIDE.md](./WHATSAPP_KEYS_GUIDE.md)

### 2. إضافة متغيرات البيئة

أضف المتغيرات التالية إلى ملف `.env` أو متغيرات البيئة:

```env
# WhatsApp Business API Configuration
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
```

### 3. استخدام القالب الجاهز

النظام يستخدم القالب الجاهز `authentication_code` من Meta، وهو:
- ✅ مجاني
- ✅ معتمد مسبقاً
- ✅ يدعم العربية والإنجليزية

### 4. اختبار الإرسال

بعد إضافة المتغيرات، يمكنك اختبار إرسال OTP:

```bash
# إرسال OTP للاختبار
POST /api/v1/auth/otp/send
{
  "phone": "+966500000000",
  "language": "ar"
}
```

## ملاحظات مهمة

1. **القالب الجاهز**: النظام يستخدم `authentication_code` وهو قالب معتمد مسبقاً من Meta
2. **دعم اللغات**: يدعم العربية (`ar`) والإنجليزية (`en`)
3. **Fallback**: في حالة فشل WhatsApp، يمكن إضافة fallback إلى SMS لاحقاً

## استكشاف الأخطاء

### الخطأ: "WhatsApp not configured"
- تأكد من إضافة `WHATSAPP_ACCESS_TOKEN` و `WHATSAPP_PHONE_NUMBER_ID`
- تأكد من إعادة تشغيل الخادم بعد إضافة المتغيرات

### الخطأ: "Invalid phone number"
- تأكد من أن رقم الهاتف بصيغة دولية صحيحة (مثال: +966500000000)
- النظام يقوم بتنظيف الرقم تلقائياً (إزالة + والمسافات)

### الخطأ: "Template not found"
- القالب `authentication_code` يجب أن يكون متاحاً في حسابك
- تأكد من أن حساب WhatsApp Business API نشط

## التكلفة

- ✅ **قوالب المصادقة (OTP)**: مجانية في معظم البلدان
- ❌ **قوالب التسويق**: مدفوعة
- ❌ **قوالب الأدوات**: مجانية خلال 24 ساعة فقط

## الملفات المعدلة

- `apps/api/src/modules/notifications/providers/whatsapp.provider.ts` - مزود WhatsApp
- `apps/api/src/modules/notifications/processors/whatsapp.processor.ts` - معالج WhatsApp
- `apps/api/src/modules/notifications/notifications.service.ts` - تحديث الخدمة
- `apps/api/src/modules/notifications/notifications.module.ts` - تحديث الوحدة
- `apps/api/src/modules/auth/auth.service.ts` - تحديث AuthService لاستخدام WhatsApp
- `docker-compose.yml` - إضافة متغيرات WhatsApp
- `docker-compose.dev.yml` - إضافة متغيرات WhatsApp
- `docker-compose.prod.yml` - إضافة متغيرات WhatsApp

## المراجع

- [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)
- [Authentication Templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/)

