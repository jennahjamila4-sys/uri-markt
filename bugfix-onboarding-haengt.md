# Bugfix – Onboarding lässt sich nicht durchklicken / nicht beenden

Das Onboarding erscheint jetzt korrekt (gut, der Mount-Fix hat gegriffen). ABER: Man bleibt darin hängen und kommt nicht durch bzw. nicht raus.

Symptom: Nach der ersten/einer Seite geht es nicht weiter, und/oder der Ablauf lässt sich nicht abschliessen und schliessen.

## Leitprinzip
Root-Cause, KEINE Workarounds. Kein Überspringen-erzwingen als Pflaster. Optik bleibt unangetastet. Eine Sache nach der anderen, jeweils WAS und WARUM erklären.

## Bitte selbst im Code verfolgen und beheben
1. **Schritt-Navigation:** Hat jeder Screen einen funktionierenden „Weiter"-Knopf, der den Schritt-Index erhöht? Prüfe, ob ein `onClick`/Handler fehlt oder ins Leere zeigt (so wie vorhin bei Anmelden/„+").
2. **Abschluss:** Ruft der letzte Knopf („Los geht's!") wirklich `setOnboardingCompleted(true)` auf UND wird das Overlay danach ausgehängt/geschlossen? Hängt die Sichtbarkeit des Overlays korrekt an `onboardingCompleted`?
3. **Nicht-eingeloggt-Pfad:** Screen 2 („Profil vervollständigen") ist laut Plan „nur wenn eingeloggt". Prüfe, ob ein nicht eingeloggter Besucher hier blockiert wird (kein Weiter möglich, Pflichtfeld, leerer Zustand). Der Ablauf muss auch OHNE Login bis zum Ende durchlaufbar sein.
4. **Skip/Überspringen:** Gibt es einen sichtbaren „Später/Überspringen"-Weg? Falls die Referenz/der Plan einen vorsieht, muss er funktionieren und das Onboarding sauber beenden.

## Verifikation & Abschluss
- `npx tsc --noEmit` und `npm run build` sauber.
- Sag mir je Screen kurz: Weiter-Knopf ok? + welcher Draht gefehlt hat.
- **Kein Commit, kein Push.**
- Dev-Server neu starten, damit ich es im Inkognito-Fenster bis zum Ende durchklicken kann.
