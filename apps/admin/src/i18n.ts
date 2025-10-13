import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  ar: { translation: { 'app.title': 'لوحة التحكم', 'login.title': 'تسجيل الدخول' } },
  en: { translation: { 'app.title': 'Admin Panel', 'login.title': 'Login' } },
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'ar',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n


