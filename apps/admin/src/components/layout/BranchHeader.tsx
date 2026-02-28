import { Search, User, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import i18n from '@/i18n'
import { useTranslation } from 'react-i18next'

export function BranchHeader() {
  const { t } = useTranslation()

  const handleLogout = () => {
    localStorage.removeItem('accessToken')
    window.location.href = '/login'
  }

  const toggleLang = () => {
    const next = i18n.language === 'ar' ? 'en' : 'ar'
    i18n.changeLanguage(next)
    try {
      localStorage.setItem('console_lang', next)
      document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
    } catch {}
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-100 bg-white/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="relative w-96">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder={t('menu.search') || 'Search...'}
            className="h-10 rounded-xl border-slate-100 bg-slate-50/50 ps-10 text-slate-800 transition-all placeholder:text-slate-500 focus:border-primary/20 focus:bg-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLang}
          className="rounded-xl text-slate-500 transition-all hover:bg-primary/5 hover:text-primary"
        >
          {i18n.language === 'ar' ? 'EN' : 'AR'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="gap-2 rounded-xl border border-transparent px-2 py-6 transition-all hover:border-slate-100 hover:bg-slate-50"
            >
              <Avatar className="h-9 w-9 border-2 border-white ring-1 ring-slate-100 shadow-sm">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/10 font-bold text-primary">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start gap-0.5 pe-2">
                <span className="text-sm font-bold leading-none text-slate-800">
                  Branch Manager
                </span>
                <span className="text-[10px] font-bold uppercase leading-none tracking-tight text-slate-500">
                  {t('profile.role') || 'Branch'}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t('profile.my_account') || 'My Account'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={handleLogout}>
              <LogOut className="me-2 h-4 w-4" />
              {t('profile.sign_out')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
