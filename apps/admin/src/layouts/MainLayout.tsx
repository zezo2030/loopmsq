import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default function MainLayout() {
  useEffect(() => {
    try {
      const lang = localStorage.getItem('console_lang') || 'ar'
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    } catch {}
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Background pattern - like dashboard */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"
          aria-hidden
        />
        <Header />
        <main className="relative z-10 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
