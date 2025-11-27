### ملحق: أمثلة سريعة (cURL)
```bash
# تسجيل دخول الموظف
curl -X POST "$API_BASE/auth/staff/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@booking.com","password":"SecurePassword123"}'

# تفاصيل التذكرة قبل الاعتماد
curl -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/bookings/staff/ticket/$QR_TOKEN"

# اعتماد التذكرة
curl -X POST "$API_BASE/bookings/staff/scan" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"qrToken":"'$QR_TOKEN'"}'
```

ملاحظة: استبدل `$API_BASE` بـ `http(s)://<host>:3000/api/v1` و`$TOKEN` برمز الوصول بعد تسجيل الدخول.























