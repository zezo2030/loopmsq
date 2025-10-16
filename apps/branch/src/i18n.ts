import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en/common.json'
import ar from './locales/ar/common.json'

const resources = {
  ar: { translation: ar as any },
  en: { translation: en as any },
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: (typeof localStorage !== 'undefined' && localStorage.getItem('branch_lang')) || 'ar',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n
