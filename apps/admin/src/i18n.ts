import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  ar: { translation: {
    'app.title': 'لوحة التحكم',
    'login.title': 'تسجيل الدخول',
    'menu.dashboard': 'نظرة عامة',
    'menu.users': 'المستخدمون',
    'menu.bookings': 'الحجوزات',
    'menu.trips': 'الرحلات المدرسية',
    'menu.events': 'الأحداث الخاصة',
    'menu.cms': 'إدارة المحتوى',
    'menu.finance': 'المالية',
    'menu.marketing': 'التسويق',
    'menu.content': 'المحتوى',
    'menu.content.branches': 'الفروع',
    'menu.content.halls': 'القاعات',
    'menu.feedback': 'التغذية الراجعة',
    'menu.feedback.reviews': 'المراجعات',
    'menu.support': 'الدعم',
    'menu.support.tickets': 'التذاكر',
    'menu.reports': 'التقارير',
    'menu.reports.overview': 'نظرة عامة',
  } },
  en: { translation: {
    'app.title': 'Admin Panel',
    'login.title': 'Login',
    'menu.dashboard': 'Dashboard',
    'menu.users': 'Users',
    'menu.bookings': 'Bookings',
    'menu.trips': 'School Trips',
    'menu.events': 'Special Events',
    'menu.cms': 'CMS',
    'menu.finance': 'Finance',
    'menu.marketing': 'Marketing',
    'menu.content': 'Content',
    'menu.content.branches': 'Branches',
    'menu.content.halls': 'Halls',
    'menu.feedback': 'Feedback',
    'menu.feedback.reviews': 'Reviews',
    'menu.support': 'Support',
    'menu.support.tickets': 'Tickets',
    'menu.reports': 'Reports',
    'menu.reports.overview': 'Overview',
  } },
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


