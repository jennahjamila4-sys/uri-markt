import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell, LegalSection } from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Datenschutzerklärung – Uri-Markt',
  description:
    'Datenschutzerklärung von Uri-Markt gemäss dem revidierten Schweizer Datenschutzgesetz (revDSG).',
}

export default function DatenschutzPage() {
  return (
    <LegalShell title="Datenschutzerklärung" updated="12.07.2026">
      <p>
        Diese Datenschutzerklärung informiert dich darüber, welche
        Personendaten Uri-Markt bearbeitet, zu welchem Zweck und welche Rechte
        dir zustehen. Grundlage ist das revidierte Schweizer Datenschutzgesetz
        (revDSG, in Kraft seit 1. September 2023).
      </p>

      <LegalSection heading="1. Verantwortliche Stelle">
        <p>
          Verantwortlich für die Datenbearbeitung ist der Betreiber von
          Uri-Markt. Die vollständigen Kontaktangaben findest du im{' '}
          <Link href="/impressum" className="text-gold hover:underline">
            Impressum
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection heading="2. Welche Daten wir bearbeiten">
        <p>Im Rahmen der Nutzung von Uri-Markt bearbeiten wir:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Kontodaten:</strong> E-Mail-Adresse, Passwort (verschlüsselt
            gespeichert), Zeitpunkt der Registrierung.
          </li>
          <li>
            <strong>Profildaten:</strong> Benutzername, Name, Gemeinde,
            bevorzugte Kategorien, Profilbild, Level und Bewertungen.
          </li>
          <li>
            <strong>Inserate und Gesuche:</strong> Titel, Beschreibung, Fotos,
            Preis, Kategorie, Standortangabe (Gemeinde).
          </li>
          <li>
            <strong>Kommentare:</strong> von dir verfasste Kommentare zu
            Inseraten.
          </li>
          <li>
            <strong>Transaktionsdaten:</strong> Kaufabsichten, bestätigte Deals,
            Uri-Taler-Bewegungen, Bewertungen.
          </li>
          <li>
            <strong>Zahlungsdaten:</strong> beim Kauf von Uri-Talern werden
            Zahlungen über Stripe abgewickelt. Kreditkarten- bzw. Zahldaten
            werden direkt von Stripe verarbeitet; wir speichern keine
            vollständigen Kartendaten.
          </li>
          <li>
            <strong>Technische Daten:</strong> für den Betrieb notwendige Daten
            wie Log-Einträge und Sitzungsinformationen (Cookies zur Anmeldung).
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Zweck der Bearbeitung">
        <p>
          Wir bearbeiten diese Daten, um den Marktplatz bereitzustellen: Konto-
          und Profilverwaltung, Anzeige von Inseraten und Gesuchen, Abwicklung
          von Deals und Bewertungen, Betrieb des Uri-Taler-Guthabens,
          Benachrichtigungen sowie Schutz vor Missbrauch. Eine Bearbeitung
          erfolgt nur, soweit dies für den Betrieb der Plattform erforderlich
          ist oder du eingewilligt hast.
        </p>
      </LegalSection>

      <LegalSection heading="4. Speicherort und Empfänger (Auftragsbearbeiter)">
        <p>
          Zur Erbringung des Dienstes setzen wir sorgfältig ausgewählte
          Dienstleister ein, die Daten in unserem Auftrag bearbeiten:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Supabase</strong> – Datenbank, Authentifizierung und
            Dateispeicher. Serverstandort: EU (Paris, Frankreich).
          </li>
          <li>
            <strong>Vercel</strong> – Hosting und Auslieferung der Anwendung.
          </li>
          <li>
            <strong>Stripe</strong> – Zahlungsabwicklung beim Kauf von
            Uri-Talern.
          </li>
          <li>
            <strong>Resend</strong> – Versand von E-Mails (z. B. Bestätigungen,
            Benachrichtigungen).
          </li>
        </ul>
        <p>
          Diese Dienstleister sind vertraglich zur Einhaltung des Datenschutzes
          verpflichtet. Eine Bekanntgabe von Personendaten ins Ausland erfolgt
          nur an Länder mit angemessenem Datenschutzniveau oder auf Grundlage
          geeigneter vertraglicher Garantien (z. B. Standardvertragsklauseln).
        </p>
      </LegalSection>

      <LegalSection heading="5. Speicherdauer">
        <p>
          Wir bewahren Personendaten so lange auf, wie es für die genannten
          Zwecke oder aufgrund gesetzlicher Aufbewahrungspflichten (z. B. bei
          Transaktions- und Zahlungsdaten) erforderlich ist. Löschst du dein
          Konto, werden deine Daten entfernt bzw. anonymisiert, soweit keine
          gesetzliche Pflicht zur Aufbewahrung besteht.
        </p>
      </LegalSection>

      <LegalSection heading="6. Deine Rechte">
        <p>Nach dem revDSG stehen dir insbesondere folgende Rechte zu:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Auskunft über die von uns bearbeiteten Daten;</li>
          <li>Berichtigung unrichtiger Daten;</li>
          <li>Löschung deiner Daten;</li>
          <li>Widerspruch gegen bestimmte Bearbeitungen;</li>
          <li>Datenherausgabe bzw. -übertragung.</li>
        </ul>
        <p>
          Dein Konto und deine Daten kannst du jederzeit selbst löschen: im
          eingeloggten{' '}
          <Link href="/profile" className="text-gold hover:underline">
            Profil
          </Link>{' '}
          unter „Konto“ findest du die Funktion zur Konto-Löschung. Für alle
          weiteren Anliegen erreichst du uns über die im Impressum genannte
          Kontaktadresse.
        </p>
      </LegalSection>

      <LegalSection heading="7. Cookies">
        <p>
          Uri-Markt verwendet ausschliesslich technisch notwendige Cookies bzw.
          vergleichbaren Speicher (z. B. zur Aufrechterhaltung deiner Anmeldung).
          Es werden keine Werbe- oder Tracking-Cookies gesetzt.
        </p>
      </LegalSection>

      <LegalSection heading="8. Kontakt">
        <p>
          Für Fragen zum Datenschutz oder zur Ausübung deiner Rechte wende dich
          an die im{' '}
          <Link href="/impressum" className="text-gold hover:underline">
            Impressum
          </Link>{' '}
          angegebene Adresse.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
