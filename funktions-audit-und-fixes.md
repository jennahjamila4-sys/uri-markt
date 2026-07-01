# Selbstständiger Funktions-Audit des Marktplatz-Screens (nach Design-Umbau)

Nach Aufgabe B (Design) sind mehrere Interaktionen tot. DU (Claude Code) führst diesen Audit **selbstständig durch reines Lesen und Nachverfolgen des Codes** durch — der User soll NICHTS manuell testen. Du erstellst eine vollständige Verkabelungs-Karte aller Bedien-Elemente und schliesst jede gerissene Verbindung an der Wurzel wieder an.

## Leitprinzip (nicht verhandelbar)
- **Root-Cause, KEINE WORKAROUNDS.** Kein Erzwingen, kein Symptom-Pflaster.
- Design/Optik bleibt zu 100 % unangetastet — nur die Funktion wieder anschliessen.
- Eine Sache nach der anderen, jeweils kurz erklären WAS und WARUM.

## Methode: Verkabelung selbst verfolgen
Erstelle für jedes interaktive Element diese Kette und prüfe, dass jede Stufe existiert und auf das RICHTIGE Ziel zeigt:

  Element (Button/Link)  →  onClick/Handler  →  Store-State/Setter  →  Consumer (Modal/Panel), der denselben State liest  →  Consumer ist im gerenderten Baum gemountet

Für jede Stufe zusätzlich prüfen:
- Ist die Komponente eine Client-Komponente (`'use client'`), wo `onClick`/State nötig ist?
- Zeigt der Handler auf den korrekten Setter (Auth-Open ≠ Create-Open — nicht vertauscht)?
- Liest der Consumer exakt denselben State-Key (kein umbenannter/verwaister State nach dem Umbau)?
- Ist der Consumer überhaupt in `page.tsx`/Layout eingebunden?

Bekannte Symptome als Startpunkt (aber prüfe ALLE Elemente, nicht nur diese):
- „Anmelden" öffnet kein Login-Fenster (springt zurück).
- Goldener „+"-Button öffnet kein CreateModal.
- Onboarding wurde NIE gesehen.

## Onboarding — echte Ursache finden, kein Trick
Der User hat das Onboarding nie gesehen. Wahrscheinlichste Ursache: `OnboardingFlow` ist gar nicht eingehängt oder seine Trigger-Bedingung greift nicht. Verfolge:
- Wo/ob `OnboardingFlow` gerendert wird (page/layout).
- Trigger an `onboardingCompleted` (Zustand-Store, persistiert unter `uri-markt-v1`): wird der Wert korrekt gelesen, ist die Bedingung richtig herum?
- Beheben durch korrektes Einhängen + korrekte Bedingung. NICHT durch erzwungenes Dauer-Einblenden. Wenn ein bereits gesetzter `true`-Merker die einzige Ursache wäre, melde das — aber der User hat es nie gesehen, also liegt der Verdacht auf fehlendem Mount/Trigger.

## Vollständige Element-Liste (selbst verifizieren)
Header: Logo · „Anmelden" → Auth-Modal · eingeloggt: Profil statt „Anmelden" · Glocke → NotificationPanel (`unreadCount`).
BottomNav: Marktplatz-Link · „+" → CreateModal (`isCreateModalOpen`) · Profil-Link → `/profile`.
CreateModal: öffnet · Tabs Angebot/Gesuch funktionieren (Event = „Coming soon" ok) · Angebot-Formular (4 Schritte) abschickbar · Gesuch-Formular (3 Schritte) abschickbar.
Onboarding: Mount + Trigger korrekt.
Feed: Tabs schalten um · Kategorie-Filter · Kartenklick → ListingDetail · Infinite-Scroll · FOMO-Streifen · Boost-Karussell.
ListingDetail: öffnet · Kaufen-Button · Favorit · Teilen.
Auth-Ende-zu-Ende: Registrieren → Login → Logout spiegelt sich im Header.

## Verifikation & Abschluss
- Primär: statisches Code-Tracing (deckt diese Verkabelungs-Fehlerklasse vollständig ab).
- Zusätzlich: `npx tsc --noEmit` und `npm run build` müssen sauber sein.
- Liefere am Ende EINE Tabelle:
  Element → Handler → State-Key → Consumer gemountet? → Status (ok/defekt) → Ursache → Fix.
- **Kein Commit, kein Push.**
- Dev-Server neu starten, damit der User in 30 Sekunden final bestätigen kann.
