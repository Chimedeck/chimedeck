// Fractional indexing — initial position for the first list in a board.
// Using base62 midpoint: 'n' is roughly the middle of base62 alphabet.

export const LOW_SENTINEL = '';
export const HIGH_SENTINEL = '~';

/** Returns the starting position for the very first item in an empty sequence. */
export function firstPosition(): string {
  return 'n'; // midpoint of printable ASCII range used by between()
}
