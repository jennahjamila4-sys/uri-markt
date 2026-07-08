# Fix Kauf-Ablauf — `create_buy_intent` sauber nachbauen (KEIN Workaround)

## Kern
`create_buy_intent` fehlt in der Live-DB → „Kaufen" ist tot. **NICHT** als Client-Insert umbauen (der Käufer darf per RLS das Inserat nicht reservieren, und er dürfte niemals Betrag/Provision selbst setzen). Stattdessen: die Funktion **korrekt in der DB anlegen** (SECURITY DEFINER), als versionierte Migration, und via **Supabase MCP** einspielen. Du hast MCP-Zugang (project_id `lhqsuelguwfdflapzdhk`).

## Schritt 1 — Migration schreiben
Datei: `supabase/migrations/<timestamp>_create_buy_intent.sql`

Funktion `create_buy_intent(...)`:
- **Signatur an `createBuyIntentAction` anpassen** — sieh nach, welche Parameter der Code übergibt (listing_id, payment_method, buyer_contact), und gleiche beide Seiten an.
- **SECURITY DEFINER** (nötig, damit die Reservierung trotz Käufer-RLS läuft).
- `buyer_id := auth.uid()` **innerhalb** der Funktion — NIEMALS vom Client.
- Listing serverseitig in der Funktion laden. Prüfen: `status = 'active'`, Käufer ≠ Verkäufer.
- Käufer-Check: `can_buy = true`, nicht gebannt.
- `amount := listing.price`. `commission := listing.price * 0.1`.
  - **Einheit NICHT raten.** Vorher die Live-Definition von `process_transaction_commission` ansehen und exakt dieselbe Einheit für `commission` verwenden, die diese Funktion ausliest. Bestätigt ist: CHF 100 Verkauf → 10 Taler (1000 Rappen) Abzug beim Verkäufer. Die neue Funktion muss dazu passen.
- Transaktion `INSERT` mit `status = 'pending'`.
- Listing **atomar** auf `status = 'reserved'` setzen (im selben Funktionsaufruf).
- Verkäufer benachrichtigen via `send_notification` — **Live-Signatur prüfen** (recipient_id/title/message/type/…); die Repo-SQL dazu ist veraltet, nicht ihr glauben.
- `RETURN` die `transaction_id` (Form an den Code anpassen).

## Schritt 2 — Einspielen
- Via Supabase MCP `apply_migration` (project_id `lhqsuelguwfdflapzdhk`).
- Falls `apply_migration` nicht durchgeht: das SQL ausgeben, JJ führt es im Supabase-Dashboard (SQL-Editor) aus. Nicht als Client-Workaround ausweichen.

## Schritt 3 — Verifizieren
- Bestätigen, dass `create_buy_intent` jetzt live existiert (RPC-Liste erneut abfragen).
- `createBuyIntentAction` gegen die neue Signatur abgleichen: Betrag/Provision kommen jetzt aus der Funktion, **nicht** mehr vom Client.
- BUG 6(a): den falschen Käufer-Text („+10% Provision in Talern bei Kauf") korrigieren — Käufer zahlt nur den Preis, 10% trägt der Verkäufer.

## Schritt 4 — Drift beseitigen
- Veraltete `sql/003` (falsche `send_notification`-Signatur, falsche Provisions-Einheit) mit der Live-Wahrheit abgleichen oder klar als veraltet markieren, damit die Repo-SQL nicht wieder in die Irre führt.

## Abschluss
- `npx tsc --noEmit` + `npm run build` grün.
- Testkauf durchspielen (deine Testkonten): Kaufen → Transaktion `pending` + Inserat `reserved` + Verkäufer-Notification. Verkäufer bestätigt → 10% in Talern abgezogen.
- Commit (`fix: create_buy_intent RPC + Kauf-Ablauf`). **KEIN Push.**
