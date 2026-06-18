// Fractional-indexing position utilities for checklist item ordering.
// Shared between ChecklistSection (drag-and-drop reordering) and
// CardModal container (optimistic item-add position computation).

export const LOW_SENTINEL = '';
export const HIGH_SENTINEL = '~';
export const BASE = 95;
export const NUMERIC_POSITION_PATTERN = /^-?\d+(?:\.\d+)?$/;

export const toDigit = (char: string): number => (char.codePointAt(0) ?? 32) - 32;
export const toChar = (digit: number): string => String.fromCodePoint(digit + 32);

export const toDigits = (value: string): number[] => Array.from(value).map(toDigit);
export const fromDigits = (digits: number[]): string => digits.map(toChar).join('');

export const compareDigits = (left: number[], right: number[]): number => {
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftDigit = left[index] ?? 0;
    const rightDigit = right[index] ?? BASE - 1;
    if (leftDigit < rightDigit) return -1;
    if (leftDigit > rightDigit) return 1;
  }
  return 0;
};

/**
 * Compute a fractional-index position string that lies between `left` and `right`.
 * Use LOW_SENTINEL ('') for "before first item" and HIGH_SENTINEL ('~') for "after last item".
 */
export const betweenPositions = (left: string, right: string): string => {
  if (left === right) return `${left}O`;

  const leftDigits = left === LOW_SENTINEL ? [] : toDigits(left);
  const rightDigits = right === HIGH_SENTINEL ? [] : toDigits(right);

  if (
    left !== LOW_SENTINEL &&
    right !== HIGH_SENTINEL &&
    compareDigits(leftDigits, rightDigits) >= 0
  ) {
    return `${left}O`;
  }

  const output: number[] = [];
  let index = 0;

  for (;;) {
    const leftDigit = leftDigits[index] ?? 0;
    const rightDigit = rightDigits[index] ?? BASE - 1;

    if (rightDigit - leftDigit > 1) {
      output.push(Math.floor((leftDigit + rightDigit) / 2));
      break;
    }

    output.push(leftDigit);
    index += 1;
  }

  return fromDigits(output);
};

/**
 * Compare two position strings for sorting.
 * Handles both legacy numeric positions and fractional-index positions.
 */
export const compareChecklistItemPosition = (left: string, right: string): number => {
  if (left === right) return 0;
  if (NUMERIC_POSITION_PATTERN.test(left) && NUMERIC_POSITION_PATTERN.test(right)) {
    const delta = Number(left) - Number(right);
    if (delta !== 0) return delta;
  }
  return left < right ? -1 : 1;
};
