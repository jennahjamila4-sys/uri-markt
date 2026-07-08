# ERGÄNZUNG FÜR CLAUDE.md — Abschnitt "Fehlervermeidung & Debugging-Regeln"
> Diese Regeln in CLAUDE.md unter "Kritische Regeln" einfügen.
> Hintergrund: Auth-Bug 02.07.2026 (42501 permission denied auf profiles) —
> drei Theorien wurden gefixt bevor gemessen wurde. Die Live-Messung fand die
> Ursache in Minuten. Diese Regeln verhindern die Wiederholung.

---

## 🔬 DEBUGGING-REGELN (VERBINDLICH)

### Regel D1: Messen vor Fixen
Bei jedem Bug ZUERST die exakte Fehlermeldung beschaffen (Fehlercode,
Log-Zeile, Debug-Ausgabe). KEIN Fix auf Basis von "wahrscheinlich" oder
"vermutlich". Wenn keine Fehlermeldung sichtbar ist: temporäre Diagnose
einbauen (console.error, Debug-Panel, whoami-Route), messen, dann fixen.
Temporäre Diagnose nach bestandenem Test wieder entfernen.

### Regel D2: Grant/RLS-Check nach jedem DB-Schritt
Nach JEDER Migration, jedem SQL-Lauf und jedem DB-Schema-Schritt sofort
prüfen (Lesabfrage, Sekunden):

```sql
SELECT table_name, grantee, string_agg(privilege_type, ', ') AS privs
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;
```

Erwartung: JEDE App-Tabelle hat mindestens SELECT für anon und
authenticated (gemäss RLS-Konzept). Fehlt etwas → STOPP, JJ melden,
Ursache klären BEVOR weitergearbeitet wird.

### Regel D3: Ein Fix — ein Test — dann weiter
Niemals mehrere Fixes stapeln. Nach jedem einzelnen Fix: JJ testet im
Browser, meldet Ergebnis, erst dann der nächste Schritt. So ist immer klar,
welcher Schritt was verändert hat.

### Regel D4: Smoke-Test vor jedem Commit
Vor jedem Commit diese 5 Klick-Tests von JJ bestätigen lassen:
1. Login → Header oben rechts zeigt Profil-Icon (nicht "Anmelden")
2. "+" → Inserat-Formular öffnet sich
3. "Profil" (Bottom-Nav) → Dashboard öffnet sich (kein Rücksprung zum Feed)
4. F5 / Seite neu laden → eingeloggt bleiben
5. "Kaufen" auf fremdem Inserat → Kauf-Formular öffnet sich

### Regel D5: Ursache dokumentieren, nicht nur den Fix
Jeder Bugfix-Commit bzw. jede Übergabe-Datei enthält: (a) Symptom,
(b) bewiesene Ursache, (c) Fix, (d) offene Folgefragen.

---

## ⚠️ OFFENER PUNKT AUS 02.07.2026 (noch zu klären)

Es ist NICHT geklärt, welcher DB-Schritt am 02.07.2026 die GRANTs für
anon/authenticated auf `profiles` entfernt hat. Bevor weitere Migrationen
laufen: die an diesem Tag ausgeführten SQL-Schritte durchgehen und den
Verursacher identifizieren — sonst kann derselbe Schritt die GRANTs
erneut entfernen. (Kandidaten: alles, was an diesem Tag via SQL-Editor
oder Migration auf profiles/Policies angewendet wurde.)
