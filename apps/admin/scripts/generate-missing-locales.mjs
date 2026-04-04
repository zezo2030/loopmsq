import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(__dirname, '../src')

function walk(d, acc = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    const s = fs.statSync(p)
    if (s.isDirectory()) walk(p, acc)
    else if (/\.(tsx|ts)$/.test(f)) acc.push(p)
  }
  return acc
}

const files = walk(src)
const keys = new Set()
const tCall = /(?:^|[^A-Za-z0-9_])t\(\s*['"]([a-zA-Z][a-zA-Z0-9_.]*)['"]/g
const labelKey = /labelKey:\s*['"]([a-zA-Z][a-zA-Z0-9_.]*)['"]/g
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8')
  let m
  while ((m = tCall.exec(c))) keys.add(m[1])
  while ((m = labelKey.exec(c))) keys.add(m[1])
}

const arPath = path.join(src, 'locales/ar/common.json')
const enPath = path.join(src, 'locales/en/common.json')
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'))
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))

const segPath = path.join(__dirname, 'segment-ar.json')
const SEG_AR = {
  ...JSON.parse(fs.readFileSync(segPath, 'utf8')),
  organizingBranches: 'تنظيم الفروع',
  introVideo: 'فيديو التعريف',
  videoUrl: 'رابط الفيديو',
  keepTracking: 'متابعة التتبع',
  cms: 'CMS',
  events: 'الفعاليات',
  trips: 'الرحلات',
  notifications: 'الإشعارات',
  content: 'المحتوى',
  finance: 'المالية',
  feedback: 'التقييمات',
  referrals: 'الإحالات',
  payments: 'المدفوعات',
  wallets: 'المحافظ',
  settings: 'الإعدادات',
  loyalty: 'الولاء',
  organizing: 'تنظيم',
  branches: 'الفروع',
  activities: 'الأنشطة',
  banners: 'البانرات',
  coupons: 'الكوبونات',
  offers: 'العروض',
  packages: 'الباقات',
  addons: 'الإضافات',
  intro: 'مقدمة',
  video: 'فيديو',
}

/** Natural phrases (avoid awkward literal segment chains) */
const FULL_AR = {
  'page.create_staff': 'إنشاء موظف',
  'page.create_branch_manager': 'إنشاء مدير فرع',
  'dashboard.keep_tracking': 'استمر في المتابعة',
  'search.placeholder': 'ابحث في المستخدمين والحجوزات والمدفوعات…',
  'search.button': 'بحث',
  'search.users': 'المستخدمون',
  'search.results': 'نتيجة',
  'search.bookings': 'الحجوزات',
  'search.payments': 'المدفوعات',
  'search.start_time': 'وقت البدء',
  'bookings.persons': 'الأشخاص',
  'branch.load_failed': 'فشل تحميل الفرع',
  'roles.staff': 'موظف',
  'roles.user': 'مستخدم',
}

const FULL_EN = {
  'page.create_staff': 'Create staff member',
  'page.create_branch_manager': 'Create branch manager',
  'dashboard.keep_tracking': 'Keep tracking',
  'search.placeholder': 'Search users, bookings, payments…',
  'search.button': 'Search',
  'search.users': 'Users',
  'search.results': 'results',
  'search.bookings': 'Bookings',
  'search.payments': 'Payments',
  'search.start_time': 'Start time',
  'bookings.persons': 'Persons',
  'branch.load_failed': 'Failed to load branch',
  'roles.staff': 'Staff',
  'roles.user': 'User',
}

function humanizeEn(k) {
  if (FULL_EN[k]) return FULL_EN[k]
  return k
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function toAr(k) {
  if (FULL_AR[k]) return FULL_AR[k]
  return k
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((s) => SEG_AR[s] || s)
    .join(' ')
}

const missing = [...keys].filter((k) => !(k in ar)).sort()
let added = 0
for (const k of missing) {
  if (k in ar) continue
  ar[k] = toAr(k)
  en[k] = humanizeEn(k)
  added++
}

fs.writeFileSync(arPath, JSON.stringify(ar, null, 2) + '\n', 'utf8')
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8')
console.log(`Merged ${added} missing keys into ar/ and en/ common.json`)
