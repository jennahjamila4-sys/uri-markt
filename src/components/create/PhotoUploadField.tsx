'use client'

/**
 * Foto-Upload-Trigger mit vollständig eigener, deutscher Beschriftung.
 *
 * ROOT-CAUSE-FIX (Block 13): Der native `<input type="file">` rendert seinen
 * Button-Text ("Datei auswählen / Keine Datei ausgewählt") vom BROWSER aus in
 * der OS-Locale — auf einem arabischen System erscheint dort arabische Schrift,
 * per HTML/CSS NICHT setzbar. Hier wird die native Chrome deshalb nicht
 * versteckt-mit-Text-drin, sondern durch eine EIGENE Fläche ersetzt: der native
 * Input liegt `sr-only` (unsichtbar, aber fokussierbar & a11y-korrekt) im
 * `<label>`, das Klick/Fokus an ihn weiterreicht. Alle sichtbaren Strings
 * gehören uns → immer Deutsch, keine Fremd-Locale mehr. Kein CSS-Verstecken von
 * Inhalten (Regel 3), sondern Austausch nicht steuerbarer Native-Chrome.
 */
type PhotoUploadFieldProps = {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  isUploading: boolean
  count: number
  max?: number
  /** Kurze Überschrift über der Fläche, z.B. „Foto (optional)". */
  label: string
  /** Hilfstext, z.B. „Mit Foto verkaufst du deutlich schneller." */
  hint?: string
  id?: string
}

export function PhotoUploadField({
  onChange,
  isUploading,
  count,
  max = 5,
  label,
  hint,
  id = 'photo-upload',
}: PhotoUploadFieldProps) {
  const full = count >= max
  const disabled = isUploading || full

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-display font-bold text-white">
          {label}
        </label>
        <span
          className={`text-xs tabular-nums ${
            full ? 'text-gold' : 'text-white/40'
          }`}
        >
          {count} / {max}
        </span>
      </div>
      {hint && <p className="mt-0.5 text-xs text-white/40">{hint}</p>}

      <label
        htmlFor={id}
        data-testid="photo-upload-trigger"
        aria-disabled={disabled}
        className={`group relative mt-2 flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border border-dashed p-4 transition-all duration-200 ${
          disabled
            ? 'cursor-not-allowed border-glass-border bg-obsidian-4/40 opacity-60'
            : 'glass-card border-gold/40 hover:border-gold hover:shadow-gold hover:-translate-y-0.5'
        }`}
      >
        {/* Gold-Sweep beim Hover — reine Optik über der Logik */}
        {!disabled && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-gold/10 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          />
        )}

        {/* Icon-Kreis */}
        <span
          aria-hidden
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl transition-transform ${
            disabled
              ? 'bg-obsidian-4'
              : 'bg-gold-dim group-hover:scale-110 group-active:scale-95'
          }`}
        >
          {isUploading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          ) : full ? (
            '✅'
          ) : (
            '📷'
          )}
        </span>

        <span className="relative min-w-0">
          <span className="block font-display font-bold text-white">
            {isUploading
              ? 'Wird hochgeladen …'
              : full
                ? 'Maximum erreicht'
                : count > 0
                  ? 'Weiteres Foto hinzufügen'
                  : 'Fotos auswählen'}
          </span>
          <span className="mt-0.5 block text-xs text-white/50">
            {isUploading
              ? 'Einen Moment, dein Bild wird gespeichert.'
              : full
                ? `Du hast das Maximum von ${max} Fotos erreicht.`
                : 'JPG, PNG oder WebP — direkt vom Handy oder Rechner.'}
          </span>
        </span>

        {/* Der native Input: unsichtbar, aber fokussierbar (a11y). Seine
            locale-abhängige Browser-Chrome ist damit nie sichtbar. */}
        <input
          id={id}
          data-testid="photo-upload-input"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
        />
      </label>
    </div>
  )
}
