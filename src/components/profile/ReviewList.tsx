import Image from 'next/image'

/**
 * Eine einzelne Bewertung, wie sie öffentlich angezeigt wird.
 * `reviewer` ist null, wenn der bewertende Nutzer sein Konto gelöscht hat
 * (reviews.reviewer_id → ON DELETE SET NULL). Dann rendern wir „Gelöschter Nutzer".
 */
export interface ReviewListItem {
  id: string
  rating: number | null
  comment: string | null
  created_at: string | null
  reviewer: { username: string; avatar_url: string | null } | null
}

interface Props {
  reviews: ReviewListItem[]
  /** Optionaler Titel; wenn weggelassen, wird keine Überschrift gerendert. */
  title?: string
}

/** dd.MM.yyyy (Schweizer Format, Europe/Zurich). */
function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function Stars({ rating }: { rating: number | null }) {
  const r = Math.max(0, Math.min(5, Math.round(rating ?? 0)))
  return (
    <span className="text-gold" aria-label={`${r} von 5 Sternen`}>
      {'★'.repeat(r)}
      <span className="text-white/20">{'★'.repeat(5 - r)}</span>
    </span>
  )
}

/**
 * Öffentliche Bewertungsliste mit sauberem Leerzustand (keine erfundenen Zahlen).
 * Serverfähig (keine Hooks).
 */
export function ReviewList({ reviews, title }: Props) {
  return (
    <div className="space-y-3">
      {title && (
        <h2 className="font-display text-xl font-bold text-white">{title}</h2>
      )}

      {reviews.length === 0 ? (
        <div
          className="rounded-2xl border border-glass-border bg-obsidian-3 p-6 text-center"
          data-testid="reviews-empty"
        >
          <div className="text-3xl">🌱</div>
          <p className="mt-2 font-display font-bold text-white">
            Noch keine Bewertungen
          </p>
          <p className="mt-1 text-sm text-white/60">
            Sobald der erste Deal abgeschlossen ist, erscheinen hier die Bewertungen.
          </p>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="reviews-list">
          {reviews.map((r) => {
            const name = r.reviewer?.username ?? 'Gelöschter Nutzer'
            const deleted = !r.reviewer
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-glass-border bg-obsidian-3 p-4"
                data-testid="review-item"
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-9 w-9 overflow-hidden rounded-full bg-obsidian-4">
                    {r.reviewer?.avatar_url ? (
                      <Image
                        src={r.reviewer.avatar_url}
                        alt={name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm">
                        👤
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate font-body font-semibold ${
                        deleted ? 'italic text-white/50' : 'text-white'
                      }`}
                    >
                      {name}
                    </div>
                    <div className="text-xs text-white/50">
                      {formatDate(r.created_at)}
                    </div>
                  </div>
                  <Stars rating={r.rating} />
                </div>
                {r.comment && (
                  <p className="mt-2 whitespace-pre-line text-sm text-white/80">
                    {r.comment}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
