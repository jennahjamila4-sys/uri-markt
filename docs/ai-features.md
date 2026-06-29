# KI-Features
> Status: ⏳ Ausstehend
> Zuletzt aktualisiert: 30.06.2026
> Abhängigkeiten: create-listing

## Modellname (zentral)
Der Claude-Modellname wird NIE im Feature-Code hardcoded, sondern immer aus
`src/lib/ai.ts` importiert:

```ts
import { CLAUDE_MODEL } from '@/lib/ai'
```

- `CLAUDE_MODEL` = `'claude-sonnet-4-6'` (Standard: Text-Booster, Matching-Begründungen)
- `CLAUDE_MODEL_FAST` = `'claude-haiku-4-5'` (einfache/günstige Tasks)

Bei einem Modellwechsel (Abkündigung, Upgrade) nur diese eine Datei anpassen.
Nur serverseitig nutzen (API Routes) – `ANTHROPIC_API_KEY` nie im Frontend.
