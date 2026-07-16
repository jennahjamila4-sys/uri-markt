import Link from 'next/link'

/**
 * Globaler Footer mit den Rechtsseiten-Links. Wird im Root-Layout unter jeder
 * Seite gerendert, damit Impressum / Datenschutz / AGB von ueberall erreichbar
 * sind (Schweizer Pflichtangaben, UWG Art. 3). Die untere Polsterung haelt die
 * Links frei von der fixierten BottomNav (h-84px) auf Feed-/Profil-Seiten.
 */
export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer
      data-testid="site-footer"
      className="mx-auto max-w-[480px] border-t border-glass-border px-6 pb-28 pt-8 text-center text-white/55"
    >
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium">
        <Link href="/impressum" className="transition hover:text-gold">
          Impressum
        </Link>
        <Link href="/datenschutz" className="transition hover:text-gold">
          Datenschutz
        </Link>
        <Link href="/agb" className="transition hover:text-gold">
          AGB
        </Link>
      </nav>
      <p className="mt-4 text-xs text-white/40">
        © {year} Uri-Markt · Regional – Genau was es brucht.
      </p>
    </footer>
  )
}
