import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell, LegalSection } from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'AGB – Uri-Markt',
  description:
    'Allgemeine Geschäftsbedingungen von Uri-Markt inklusive Uri-Taler-Klausel.',
}

export default function AgbPage() {
  return (
    <LegalShell title="Allgemeine Geschäftsbedingungen (AGB)" updated="12.07.2026">
      <p>
        Diese Allgemeinen Geschäftsbedingungen regeln die Nutzung der Plattform
        Uri-Markt. Mit der Registrierung und Nutzung erklärst du dich mit diesen
        Bedingungen einverstanden.
      </p>

      <LegalSection heading="1. Geltungsbereich und Betreiber">
        <p>
          Uri-Markt ist ein hyperlokaler Online-Marktplatz für den Kanton Uri.
          Betreiber ist die im{' '}
          <Link href="/impressum" className="text-gold hover:underline">
            Impressum
          </Link>{' '}
          genannte Person. Diese AGB gelten für alle Nutzerinnen und Nutzer der
          Plattform.
        </p>
      </LegalSection>

      <LegalSection heading="2. Leistung der Plattform (reine Vermittlung)">
        <p>
          Uri-Markt stellt eine technische Plattform bereit, auf der Nutzerinnen
          und Nutzer Angebote, Gesuche und Events veröffentlichen sowie
          miteinander in Kontakt treten können. Verträge über Waren oder
          Dienstleistungen kommen ausschliesslich zwischen den beteiligten
          Nutzerinnen und Nutzern zustande. Uri-Markt wird nicht Vertragspartei
          dieser Geschäfte und schuldet weder die angebotene Leistung noch deren
          Bezahlung.
        </p>
      </LegalSection>

      <LegalSection heading="3. Registrierung und Konto">
        <p>
          Für die volle Nutzung ist ein Konto erforderlich. Die Angaben bei der
          Registrierung müssen wahrheitsgemäss sein. Du bist für die
          Geheimhaltung deiner Zugangsdaten verantwortlich. Ein Konto ist
          persönlich und nicht übertragbar. Du kannst dein Konto jederzeit im
          Profil selbst löschen.
        </p>
      </LegalSection>

      <LegalSection heading="4. Uri-Taler">
        <p>
          Der Uri-Taler ist ein rein internes, plattforminternes Guthaben zur
          Nutzung bestimmter Funktionen von Uri-Markt. Es gilt:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Uri-Taler sind <strong>kein gesetzliches Zahlungsmittel</strong> und{' '}
            <strong>kein E-Geld</strong> im Sinne der einschlägigen Gesetzgebung.
          </li>
          <li>
            Es besteht <strong>kein Anspruch auf Auszahlung, Rückerstattung
            oder Umtausch</strong> von Uri-Talern in Bargeld oder andere
            Vermögenswerte.
          </li>
          <li>
            Uri-Taler können nicht auf andere Personen ausserhalb der von der
            Plattform vorgesehenen Funktionen übertragen werden.
          </li>
          <li>
            Erworbene Uri-Taler verfallen nicht durch blossen Zeitablauf; bei
            Konto-Löschung verbleibendes Guthaben verfällt jedoch ersatzlos.
          </li>
        </ul>
        <p>
          Ein Startguthaben von 5 Uri-Talern wird neuen Konten als
          unverbindliche Gutschrift zur Verfügung gestellt; darauf besteht kein
          Rechtsanspruch.
        </p>
      </LegalSection>

      <LegalSection heading="5. Provision">
        <p>
          Für erfolgreich bestätigte Deals erhebt Uri-Markt eine Provision von{' '}
          <strong>10 %</strong> des vereinbarten Betrags. Die Provision wird in
          Uri-Talern vom Guthaben der verkaufenden Person verrechnet, sobald der
          Deal bestätigt wird. Ohne bestätigten Deal fällt keine Provision an.
        </p>
      </LegalSection>

      <LegalSection heading="6. Reservierung und Ablauf">
        <p>
          Bei einer Kaufabsicht wird das Inserat vorgemerkt (reserviert).
          Bestätigt die verkaufende Person den Deal nicht innerhalb von{' '}
          <strong>48 Stunden</strong>, läuft die Reservierung automatisch ab und
          das Inserat wird wieder frei geschaltet. Dadurch entstehen keine
          Ansprüche der Parteien gegeneinander.
        </p>
      </LegalSection>

      <LegalSection heading="7. Verhaltensregeln">
        <p>Bei der Nutzung von Uri-Markt ist insbesondere untersagt:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            das Einstellen rechtswidriger, gefälschter, gestohlener oder
            gefährlicher Waren sowie verbotener Dienstleistungen;
          </li>
          <li>
            beleidigende, diskriminierende, betrügerische oder irreführende
            Inhalte;
          </li>
          <li>Spam, Werbung für Dritte sowie Manipulation von Bewertungen;</li>
          <li>
            die Umgehung der Plattform-Funktionen (z. B. der Provision) sowie
            jede missbräuchliche Nutzung.
          </li>
        </ul>
        <p>
          Bei Verstössen kann Uri-Markt Inhalte entfernen, Funktionen
          einschränken oder das Konto sperren.
        </p>
      </LegalSection>

      <LegalSection heading="8. Haftungsausschluss">
        <p>
          Uri-Markt vermittelt lediglich den Kontakt zwischen den Nutzerinnen
          und Nutzern. Für das Zustandekommen, die Erfüllung, die Qualität, die
          Rechtmässigkeit oder die Bezahlung der zwischen Nutzenden
          abgeschlossenen Geschäfte übernimmt Uri-Markt keine Haftung. Soweit
          gesetzlich zulässig, ist die Haftung des Betreibers für leichte
          Fahrlässigkeit ausgeschlossen. Für nutzergenerierte Inhalte sind
          ausschliesslich die jeweiligen Verfasserinnen und Verfasser
          verantwortlich.
        </p>
      </LegalSection>

      <LegalSection heading="9. Änderungen der AGB">
        <p>
          Uri-Markt kann diese AGB anpassen, etwa bei Änderungen des Angebots
          oder der Rechtslage. Über wesentliche Änderungen wird in geeigneter
          Form informiert. Die weitere Nutzung nach Inkrafttreten gilt als
          Zustimmung.
        </p>
      </LegalSection>

      <LegalSection heading="10. Anwendbares Recht und Gerichtsstand">
        <p>
          Es gilt schweizerisches Recht. Gerichtsstand ist, soweit gesetzlich
          zulässig, Erstfeld (Kanton Uri). Zwingende Gerichtsstände zum Schutz
          von Konsumentinnen und Konsumenten bleiben vorbehalten.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
