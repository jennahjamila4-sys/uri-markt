# Deal-Flow
> Status: ✅ Fertig
> Zuletzt aktualisiert: 28.06.2026
> Abhängigkeiten: create-listing, wallet, gamification, notifications

## Übersicht
Herzstück des Marktplatzes: vom Kaufinteresse bis zur Übergabe. Kontaktdaten
werden erst nach Verkäufer-Bestätigung freigeschaltet – ausschliesslich über
RLS, niemals via CSS/JS-Verstecken.

Ablauf:
1. **Kaufabsicht** (Käufer) → `createBuyIntentAction` → RPC `create_buy_intent`
   erstellt `transactions`-Zeile (`status='pending'`), reserviert das Inserat.
2. **Bestätigung** (Verkäufer) → `confirmSaleAction` → RPC
   `process_transaction_commission` zieht 10 % Provision in Talern ab,
   `status='confirmed'`. Erst jetzt liefert RLS die Kontaktdaten.
3. **Übergabe** (Verkäufer) → `completeTransactionAction` → `status='completed'`,
   Inserat `sold` + `fomo_expires_at` (+24h), XP für beide, Bewertungs-Prompt.
4. **Ablehnen** → `rejectTransactionAction` (`status='cancelled'`, Inserat wieder
   `active`).
5. **No-Show** → `reportNoShowAction` → RPC `escalate_no_show` (Provision zurück,
   Strike für Käufer).

## Dateien
- `src/app/actions/transactions.ts` – alle Server-Actions (createBuyIntent,
  confirmSale, reject, complete, reportNoShow, submitReview, submitComment)
- `src/components/listing/DealFlow.tsx` – Käufer-Sicht (Kaufen-Button + Bottom-Sheet)
- `src/components/listing/SellerDashboard.tsx` – Verkäufer-Sicht (Bestätigen/
  Ablehnen/Übergabe/No-Show + ReviewModal nach Abschluss)
- `src/components/listing/ContactSection.tsx` – Kontaktdaten (nur via RLS)
- `src/lib/validations/transaction.ts` – `BuyIntentSchema`

## Datenbank
- Tabelle `transactions` (buyer_id, seller_id, amount, commission, status,
  buyer_contact, seller_contact, payment_method, *_at-Felder)
- RPCs: `create_buy_intent`, `process_transaction_commission`,
  `escalate_no_show`, `send_notification`, `award_xp`

## Sicherheit
- `user_id`/`seller_id` ausschliesslich serverseitig via `auth.getUser()`.
- Provision NUR via RPC `process_transaction_commission` (SECURITY DEFINER).
- Kontaktdaten via RLS auf `transactions` (buyer/seller + `status='confirmed'`),
   contactSection rendert nur, was der Server liefert.

## Bekannte Einschränkungen / TODOs
- [ ] Käufer-seitige Übergabe-Bestätigung (aktuell bestätigt der Verkäufer)
- [ ] Wallet-Aufladen-CTA bei zu wenig Talern (Phase 3/4)
