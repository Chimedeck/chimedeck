// Date helpers for date-bearing card fields (due_date, start_date, value_date).
//
// WHY: these fields are stored as full ISO timestamps (instants). Different
// surfaces must interpret them the same way — in the viewer's local timezone —
// or the same card appears on different days depending on which view you open.
// Slicing the raw ISO string (`iso.slice(0, 10)`) yields the *UTC* date, which
// disagrees with local-time rendering for anyone not at UTC.

/**
 * The local calendar date of an ISO timestamp, as "YYYY-MM-DD".
 * Use this for grouping/keying dates (calendar cells, timeline lanes, badges).
 */
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${day}`;
}

/**
 * Parse an ISO timestamp into a Date at local midnight of its local calendar
 * date. Use this for day-arithmetic and positioning, where only the date part
 * matters and the time component must not shift the day.
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
