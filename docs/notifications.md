# Notifications
> Status: 🔄 In Arbeit (In-App + Realtime fertig, Push/E-Mail Phase 3)
> Zuletzt aktualisiert: 28.06.2026
> Abhängigkeiten: auth-onboarding, deal-flow

## Übersicht
In-App-Benachrichtigungen in Echtzeit via Supabase Realtime. Erstellung
ausschliesslich serverseitig über RPC `send_notification` (umgeht RLS-Insert).
Anzeige im Slide-in-Panel; Live-Toast bei neuem Eintreffen.

## Datenmodell
Die Tabelle `notifications` speichert Titel/Message/Listing in einem
`payload`-JSON-Feld:
- `user_id`, `type` (z.B. `tx_pending`, `tx_confirmed`, `tx_completed`,
  `tx_rejected`, `no_show`), `read`, `created_at`
- `payload`: `{ title, message, listing_id }`

## Dateien
- `src/hooks/useNotifications.ts` – initial laden + Realtime-Subscription + Toast
  (Browser-Client wird erst im `useEffect` erzeugt)
- `src/components/layout/NotificationPanel.tsx` – Slide-in von rechts,
  „Alle als gelesen", Klick navigiert zum Inserat
- `src/components/layout/Header.tsx` – Glocke mit Unread-Badge öffnet Panel
- `src/components/layout/AppChrome.tsx` – mountet Hook + Panel app-weit
- Store: `notifications`, `unreadCount`, `isNotificationPanelOpen` (`appStore.ts`)

## Sicherheit
- Insert nur via RPC `send_notification` (SECURITY DEFINER).
- RLS: User sieht/aktualisiert nur eigene Notifications (`user_id = auth.uid()`).

## Bekannte Einschränkungen / TODOs
- [ ] Web-Push (Service Worker) – Phase 3
- [ ] E-Mail-Benachrichtigungen via Resend – Phase 3
- [ ] „read"-Status pro Notification beim Klick (aktuell nur „alle gelesen")
