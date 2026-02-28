import { useState } from 'react'
import { message } from 'antd'
import { Mail, Lock, LayoutDashboard, Loader2, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

function getApiBase(): string {
  const base = (import.meta as any).env?.VITE_API_BASE || (window as any).NEXT_PUBLIC_API_BASE
  return typeof base === 'string' && base ? base : 'http://localhost:3000/api/v1'
}

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [roleChoice, setRoleChoice] = useState<'admin' | 'branch'>('admin')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const { t } = useTranslation()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const email = (formData.get('email') as string)?.trim() || ''
    const password = formData.get('password') as string || ''

    const newErrors: { email?: string; password?: string } = {}
    if (!email) {
      newErrors.email = t('login.email_required') || 'Please enter your email'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('login.email_valid') || 'Please enter a valid email'
    }
    if (!password) {
      newErrors.password = t('login.password_required') || 'Please enter your password'
    }
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    setLoading(true)
    try {
      const resp = await fetch(`${getApiBase()}/auth/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!resp.ok) throw new Error(t('auth.invalid') || 'Invalid credentials')
      const data = await resp.json()
      localStorage.setItem('accessToken', data.accessToken)
      message.success(t('login.success') || 'Logged in successfully')

      const meResp = await fetch(`${getApiBase()}/auth/me`, {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      })
      const me = meResp.ok ? await meResp.json() : null
      const roles: string[] = Array.isArray(me?.roles) ? me.roles : []

      const wanted = roleChoice === 'admin' ? 'admin' : 'branch_manager'
      if (!roles.includes(wanted)) {
        message.error(t('auth.not_authorized') || 'Selected role is not authorized for this account')
        return
      }
      try {
        localStorage.setItem('ui_mode', roleChoice)
      } catch {}
      window.location.href = roleChoice === 'admin' ? '/admin' : '/branch'
    } catch (e: unknown) {
      message.error((e as Error)?.message || t('login.failed') || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"
        aria-hidden
      />

      <Card className="relative w-full max-w-md border border-slate-100 bg-white shadow-2xl shadow-slate-200/50">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 rtl:translate-x-1/2">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary shadow-xl shadow-primary/30 rotate-12">
            <LayoutDashboard className="h-12 w-12 -rotate-12 text-primary-foreground" />
          </div>
        </div>

        <CardHeader className="space-y-1 pt-16 text-center">
          <CardTitle className="text-3xl font-extrabold uppercase tracking-tight text-slate-900">
            {t('app.title')}
          </CardTitle>
          <CardDescription className="text-base font-medium text-slate-600">
            {t('login.subtitle') || 'Welcome back! Please sign in to continue'}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-bold text-slate-800">
                {t('login.email') || 'Email Address'}
              </label>
              <div className="relative group">
                <Mail className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-primary" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="admin@example.com"
                  className="h-11 border-slate-200 bg-slate-50 ps-10 text-slate-800 placeholder:text-slate-500 focus:border-primary/20 focus:bg-white focus-visible:ring-primary"
                  disabled={loading}
                />
              </div>
              {errors.email && (
                <p className="text-xs font-medium text-rose-600">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800">
                {t('login.role') || 'Role'}
              </label>
              <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setRoleChoice('admin')}
                  className={cn(
                    'flex-1 rounded-lg py-2.5 text-sm font-bold transition-all',
                    roleChoice === 'admin'
                      ? 'bg-primary text-primary-foreground shadow shadow-primary/20'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {t('roles.admin') || 'Admin'}
                </button>
                <button
                  type="button"
                  onClick={() => setRoleChoice('branch')}
                  className={cn(
                    'flex-1 rounded-lg py-2.5 text-sm font-bold transition-all',
                    roleChoice === 'branch'
                      ? 'bg-primary text-primary-foreground shadow shadow-primary/20'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {t('roles.branch_manager') || 'Branch Manager'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-bold text-slate-800">
                {t('login.password') || 'Password'}
              </label>
              <div className="relative group">
                <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-primary" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('login.password_placeholder') || 'Enter your password'}
                  className="h-11 border-slate-200 bg-slate-50 ps-10 pe-10 text-slate-800 placeholder:text-slate-500 focus:border-primary/20 focus:bg-white focus-visible:ring-primary"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-primary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs font-medium text-rose-600">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              className="h-12 w-full text-base font-bold shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="me-2 h-5 w-5 animate-spin" />
                  {t('login.signing_in') || 'Signing in...'}
                </>
              ) : (
                t('login.signin') || 'Sign In'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center rounded-b-2xl border-t border-slate-100 bg-slate-50/50 p-6">
          <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-600">
            {t('login.footer') || '🔒 Secure access for Admin and Branch Manager accounts only'}
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
