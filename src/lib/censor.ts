// lib/censor.ts
// Censors sensitive information in user-generated content

const FORBIDDEN_PATTERNS = [
  // Schweizer Telefonnummern (+41, 0041, 041)
  /(\+41|0041|041)[\s\-]?[\d\s\-]{7,}/g,
  // Telefonnummern ohne Vorwahl (0XXXXXXXXX)
  /\b0\d{9}\b/g,
  // E-Mail Adressen
  /[\w.\-+]+@[\w.\-]+\.[a-z]{2,}/gi,
  // WhatsApp Links
  /wa\.me\/\d+/gi,
  // Telegram Links
  /t\.me\/\w+/gi,
  // Alle URLs
  /https?:\/\/[^\s]+/gi,
  // TWINT QR codes
  /twint:\/\/[^\s]+/gi,
]

export function censorText(text: string): string {
  if (!text) return text

  return FORBIDDEN_PATTERNS.reduce(
    (t, pattern) => t.replace(pattern, '***'),
    text
  )
}

/**
 * Check if text contains censored content
 * Useful for warnings to user before submit
 */
export function hasCensoredContent(text: string): boolean {
  return FORBIDDEN_PATTERNS.some(pattern => pattern.test(text))
}
