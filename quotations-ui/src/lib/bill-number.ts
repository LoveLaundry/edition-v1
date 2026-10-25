/**
 * Bill-number prefix helpers (client mirror of `bill_service.hotel_code`).
 *
 * Bill numbers are stored with the hotel-code prefix (`RH-1001`) so the same
 * number can be reused across hotels while staying unique within one hotel.
 * When a document is printed the operator may choose to drop the prefix; the
 * stored value is never rewritten.
 */

const PREFIX_PATTERN = /^([A-Z]{2,5})-(.+)$/

/**
 * Format a stored bill number for display or printing.
 *
 * @param stored value as persisted (may or may not carry a prefix)
 * @param includePrefix `true` keeps the stored value, `false` strips a leading
 *   `{CODE}-` prefix when present
 */
export function formatBillNumber(
  stored: string | null | undefined,
  includePrefix: boolean,
): string {
  const value = (stored ?? '').trim()
  if (!value) return ''
  if (includePrefix) return value
  const match = PREFIX_PATTERN.exec(value)
  return match ? match[2] : value
}
