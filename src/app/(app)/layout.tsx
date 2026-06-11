'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  Footprints,
  ClipboardList,
  UsersRound,
  Trophy,
  Star,
  Users,
  HelpCircle,
  Bot,
  LogOut,
  Menu,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Início', icon: Home },
  { href: '/palpites', label: 'Palpites', icon: Footprints },
  { href: '/meus-palpites', label: 'Meus Palpites', icon: ClipboardList },
  { href: '/palpites-galera', label: 'Palpites da Galera', icon: UsersRound },
  { href: '/grupos', label: 'Grupos', icon: Trophy },
  { href: '/especiais', label: 'Especiais', icon: Star },
  { href: '/competidores', label: 'Participantes', icon: Users },
  { href: '/pontuacao', label: 'Como funciona', icon: HelpCircle },
  { href: '/assistente', label: 'Assistente', icon: Bot },
]

const adminNavItem = { href: '/admin', label: 'Admin', icon: Wrench }

function NavContent({
  userName,
  isAdmin,
  onLogout,
}: {
  userName: string
  isAdmin: boolean
  onLogout: () => void
}) {
  const pathname = usePathname()
  const items = isAdmin ? [...navItems, adminNavItem] : navItems

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5 border-b border-zinc-800">
        <p className="text-base font-bold text-zinc-50">🏆 Bolão da Copa 2026</p>
      </div>

      <div className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white text-sm"
        >
          {userName.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-zinc-200 truncate">{userName}</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50'
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-2 pb-4">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
        >
          <LogOut className="size-4 shrink-0" />
          Sair
        </button>
      </div>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user
      setUserName(user?.user_metadata?.name ?? user?.email ?? '')
      if (!user) return
      const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
      setIsAdmin(!!profile?.is_admin)
    })
  }, [])

  async function handleLogout() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch {
      toast.error('Erro ao sair')
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
        <NavContent userName={userName} isAdmin={isAdmin} onLogout={handleLogout} />
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex md:hidden items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-zinc-400">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0 bg-zinc-900 border-zinc-800">
              <NavContent
                userName={userName}
                isAdmin={isAdmin}
                onLogout={() => { setMobileOpen(false); handleLogout() }}
              />
            </SheetContent>
          </Sheet>
          <p className="text-sm font-bold text-zinc-50">🏆 Bolão da Copa 2026</p>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
