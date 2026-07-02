'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

/**
 * Profil-Menü im Header: Glass-Dropdown mit „Mein Profil" und „Abmelden".
 * Ersetzt das frühere Verhalten (Icon = sofort Logout / bzw. nur Link ohne
 * Abmelden-Option). Schliesst bei Outside-Click und Escape, ist tastatur-
 * zugänglich (aria-haspopup/expanded, Focus bleibt bedienbar).
 *
 * Wallet/Einstellungen werden bewusst NICHT verlinkt – diese Routen gibt es
 * noch nicht (Wallet = Phase 3).
 */
export function ProfileMenu() {
  const { signOut } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Outside-Click + Escape schliessen das Menü
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Profil-Menü"
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid h-10 w-10 place-items-center rounded-xl border border-glass-border bg-glass transition active:scale-90"
      >
        <User size={19} className="stroke-[1.8]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-xl border border-glass-border bg-[#0d0d0f]/95 shadow-modal backdrop-blur-heavy"
        >
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/5 hover:text-gold"
          >
            <User size={17} className="stroke-[1.8]" />
            Mein Profil
          </Link>
          <button
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 border-t border-glass-border px-4 py-3 text-left text-sm font-semibold text-white/85 transition hover:bg-uri-danger/10 hover:text-uri-danger"
          >
            <LogOut size={17} className="stroke-[1.8]" />
            Abmelden
          </button>
        </div>
      )}
    </div>
  )
}
