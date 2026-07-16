import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Gemeinsame Huelle fuer die statischen Rechtsseiten (Impressum, Datenschutz,
 * AGB). Einheitlicher Kopf mit Zurueck-Link, Titel und lesbarer Textspalte.
 * Der globale Footer kommt aus dem Root-Layout.
 */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto max-w-[680px] px-6 pb-16 pt-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/60 transition hover:text-gold"
      >
        <ArrowLeft size={16} /> Zurück zum Marktplatz
      </Link>

      <h1 className="font-display text-3xl font-bold text-white">{title}</h1>
      <p className="mt-2 text-xs text-white/40">Stand: {updated}</p>

      <div className="legal-prose mt-8 space-y-6 text-[15px] leading-relaxed text-white/80">
        {children}
      </div>
    </main>
  )
}

/** Abschnitt mit Ueberschrift innerhalb einer Rechtsseite. */
export function LegalSection({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-white">{heading}</h2>
      {children}
    </section>
  )
}
