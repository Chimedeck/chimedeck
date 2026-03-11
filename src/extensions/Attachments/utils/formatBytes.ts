// Formats a byte count into a human-readable decimal string.
// e.g. formatBytes(48200) → "48.2 KB", formatBytes(12500000) → "12.5 MB"
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
const THRESHOLD = 1000;

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  let value = bytes;
  let unitIndex = 0;

  while (value >= THRESHOLD && unitIndex < UNITS.length - 1) {
    value /= THRESHOLD;
    unitIndex++;
  }

  // Show up to 1 decimal place, trimming trailing zeros
  const formatted = unitIndex === 0 ? String(value) : value.toFixed(1).replace(/\.0$/, '');
  return `${formatted} ${UNITS[unitIndex]}`;
}
