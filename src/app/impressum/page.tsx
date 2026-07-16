import type { Metadata } from 'next'
import { LegalShell, LegalSection } from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Impressum – Uri-Markt',
  description: 'Impressum und Anbieterkennzeichnung von Uri-Markt.',
}

export default function ImpressumPage() {
  return (
    <LegalShell title="Impressum" updated="12.07.2026">
      <p>
        Angaben gemäss Art. 3 Abs. 1 lit. s des Bundesgesetzes gegen den
        unlauteren Wettbewerb (UWG).
      </p>

      <LegalSection heading="Anbieter / Betreiber">
        <p>
          Christin Radegonde
          <br />
          Lindenstrasse 20
          <br />
          6472 Erstfeld
          <br />
          Schweiz
        </p>
      </LegalSection>

      <LegalSection heading="Kontakt">
        <p>E-Mail: sellehcyes.ssiws@gmail.com</p>
      </LegalSection>

      <LegalSection heading="Verantwortlich für den Inhalt">
        <p>Christin Radegonde</p>
      </LegalSection>

      <LegalSection heading="Haftung für Inhalte">
        <p>
          Uri-Markt ist eine Vermittlungsplattform. Inserate, Gesuche, Events und
          Kommentare stammen von den Nutzerinnen und Nutzern. Für deren Inhalte,
          Richtigkeit und Rechtmässigkeit sind ausschliesslich die jeweiligen
          Verfasserinnen und Verfasser verantwortlich. Rechtswidrige Inhalte
          werden nach Kenntnisnahme entfernt.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
