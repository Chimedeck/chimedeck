// Lexicographic fractional indexing — generates a string strictly between two positions.
// Alphabet: printable ASCII 0x21 ('!') through 0x7D ('}'); '~' is the HIGH_SENTINEL.
// Per technical-decisions.md §7.
export { firstPosition, LOW_SENTINEL, HIGH_SENTINEL } from './initial';

const MIN_CODE = 0x21; // '!'
const MAX_CODE = 0x7d; // '}'  (0x7E '~' is reserved as HIGH_SENTINEL)

/**
 * Returns a string strictly between `a` and `b` in lexicographic order.
 * Sentinels: `a = ""` (LOW_SENTINEL, lowest), `b = "~"` (HIGH_SENTINEL, highest).
 */
export function between(a: string, b: string): string {
  if (a >= b && b !== '') {
    throw new Error(`between: a (${a}) must be < b (${b})`);
  }

  // Walk character by character, finding the first position to split
  const maxLen = Math.max(a.length, b.length) + 1;

  for (let i = 0; i <= maxLen; i++) {
    const ac = i < a.length ? a.charCodeAt(i) : MIN_CODE - 1;
    // HIGH_SENTINEL after its length is treated as MAX_CODE+1
    const bc =
      b === '~'
        ? MAX_CODE + 1
        : i < b.length
          ? b.charCodeAt(i)
          : MIN_CODE - 1;

    const gap = bc - ac;

    if (gap > 1) {
      // There is room to insert a midpoint character at position i
      const midCode = ac + Math.floor(gap / 2);
      return a.slice(0, i) + String.fromCharCode(midCode);
    }

    if (gap === 1) {
      // No room at position i — append a mid-range character after the a-prefix
      const mid = Math.floor((MIN_CODE + MAX_CODE) / 2);
      return a.slice(0, i + 1) + String.fromCharCode(mid);
    }

    // gap === 0 or gap < 0 → keep scanning deeper
  }

  // Fallback: should not reach here with valid inputs
  const mid = Math.floor((MIN_CODE + MAX_CODE) / 2);
  return a + String.fromCharCode(mid);
}

/**
 * Generates N evenly spaced lexicographic positions for a full reorder.
 * Positions are well-separated to allow future insertions between any two.
 */
export function generatePositions(count: number): string[] {
  if (count === 0) return [];
  const positions: string[] = [];
  const range = MAX_CODE - MIN_CODE + 1; // number of single-char values

  for (let i = 0; i < count; i++) {
    if (count <= range) {
      // All fit in single-char positions; spread evenly
      const step = Math.floor(range / (count + 1));
      positions.push(String.fromCharCode(MIN_CODE + step * (i + 1)));
    } else {
      // Two-char positions: hi digit + lo digit
      const total = range * range;
      const step = Math.floor(total / (count + 1));
      const val = step * (i + 1);
      const hi = Math.floor(val / range);
      const lo = val % range;
      positions.push(
        String.fromCharCode(MIN_CODE + hi) + String.fromCharCode(MIN_CODE + lo),
      );
    }
  }
  return positions;
}
