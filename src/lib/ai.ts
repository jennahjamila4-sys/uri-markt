/**
 * Zentrale KI-Konfiguration – Single Source of Truth für Claude-Modellnamen.
 *
 * Modellnamen NIE im Feature-Code hardcoden, sondern immer von hier importieren.
 * So muss bei einem Modellwechsel (Abkündigung, Upgrade) nur diese Datei angepasst
 * werden – nicht jede API-Route einzeln.
 *
 * Nur serverseitig verwenden (API Routes / Edge Functions) – der ANTHROPIC_API_KEY
 * darf nie ins Frontend.
 *
 * Gültige IDs (Stand 06.2026, Quelle: platform.claude.com):
 *   Opus:   claude-opus-4-8
 *   Sonnet: claude-sonnet-4-6   ← aktuell genutzt
 *   Haiku:  claude-haiku-4-5
 */

/** Standardmodell für KI-Features (Text-Booster, Smart-Match-Begründungen). */
export const CLAUDE_MODEL = 'claude-sonnet-4-6' as const

/** Modell für einfache, latenz-/kostensensitive Tasks (z.B. kurze Klassifikation). */
export const CLAUDE_MODEL_FAST = 'claude-haiku-4-5' as const
