// Date helpers for date-bearing card fields (due_date, start_date, value_date).
//
// WHY: these fields are stored as full ISO timestamps (instants), but some code
// paths (drag/resize, date inputs) also pass and persist plain "YYYY-MM-DD"
// date-only strings. Both shapes must resolve to the same calendar date for the
// viewer, or the same card appears on different days depending on the surface.
//
// Two traps this module exists to avoid:
//   1. `iso.slice(0, 10)` yields the *UTC* date, which disagrees with local-time
//      rendering for anyone not at UTC.
//   2. `new Date("YYYY-MM-DD")` is parsed as UTC midnight, so converting it to
//      local time shifts it back a day for negative-offset timezones. A
//      date-only string must therefore be treated as a literal calendar date,
//      never round-tripped through a Date instant.

/** True for a bare "YYYY-MM-DD" string (no time component). */
function isDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * The local calendar date of a date field, as "YYYY-MM-DD".
 * - A date-only string is returned verbatim (it is already a calendar date).
 * - A full ISO timestamp is converted to the viewer's local calendar date.
 * Use this for grouping/keying dates (calendar cells, timeline lanes, badges).
 */
export function localDateKey(iso: string): string {
  if (isDateOnly(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${day}`;
}

/**
 * Parse a date field into a Date at local midnight of its calendar date.
 * Use this for day-arithmetic and positioning, where only the date part matters
 * and the time component must not shift the day.
 */
export function parseLocalDate(iso: string): Date {
  const key = localDateKey(iso);
  if (!key) return new Date(NaN);
  const [y, m, d] = key.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d));
}

/** Format a Date as "YYYY-MM-DD" using its local calendar date. */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${day}`;
}
