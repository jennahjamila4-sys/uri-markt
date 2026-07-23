/**
 * Zentrale Consent-Definition (AGB + Datenschutz).
 *
 * `CONSENT_VERSION` ist die EINZIGE Wahrheit für die Version, die bei einer
 * Registrierung akzeptiert wird. Sie wandert bei `signUp` in die
 * `raw_user_meta_data` (`consent_version`); der DB-Trigger `handle_new_user()`
 * liest sie dort aus und schreibt je eine Zeile `agb` + `datenschutz` nach
 * `user_consents` (serverseitig, nie vom Client).
 *
 * Bei einer inhaltlichen Änderung von AGB/Datenschutz wird HIER die Version
 * hochgezogen (Datum der Freigabe, ISO `YYYY-MM-DD`) — dann ist im
 * `user_consents`-Verlauf nachweisbar, welcher Nutzer welchen Stand akzeptiert
 * hat.
 */
export const CONSENT_VERSION = '2026-07-23'
