# Offene Befunde (nicht sofort fixen — kein Scope-Creep)

> Während der autonomen Blöcke gefundene Lücken, die NICHT zum aktuellen Block
> gehören. Werden im passenden Block oder nach Rücksprache mit JJ abgearbeitet.

## Aus Block 2 (Status-Ordnung Feed, 09.07.2026)

- **Öffentliches Profil zeigt keine „Abgeschlossen"-Inserate.**
  `src/app/profile/[username]/page.tsx` lädt nur `.eq('status', 'active')`.
  Das Soll-Verhalten aus Block 2 nennt für das Verkäufer-Profil „Abgeschlossen"
  (sold). Aktuell tauchen verkaufte Inserate auf dem öffentlichen Profil gar nicht
  auf. Nicht Teil der Feed-Messpunkte/Abschlusskriterien von Block 2 → hier notiert.
  Fix-Kandidat: eigener Abschnitt „Abgeschlossen" auf dem öffentlichen Profil
  (Design + `PublicListingGrid` um Status-Anzeige erweitern).

- **TikTokScroll: toter Sold-Badge-Code.** `TikTokScroll.tsx` rendert noch ein
  VERKAUFT-Badge für `status === 'sold'`. Da sold nun schon in der Query aus dem
  Feed ausgeschlossen wird, ist dieser Zweig nicht mehr erreichbar (harmlos,
  defensiv). Kann bei Gelegenheit entfernt werden.
