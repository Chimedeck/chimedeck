export interface LabelPresetColor {
  name: string;
  hex: string;
}

export const LABEL_PRESET_COLORS: LabelPresetColor[] = [
  { name: 'Dark green', hex: '#1f6835' },
  { name: 'Dark yellow', hex: '#7d5a00' },
  { name: 'Dark orange', hex: '#9e3a00' },
  { name: 'Dark red', hex: '#7c1d22' },
  { name: 'Dark purple', hex: '#4a1060' },
  { name: 'Dark slate', hex: '#1d3557' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Subtle lime', hex: '#84cc16' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Sky', hex: '#38bdf8' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Light gray', hex: '#94a3b8' },
  { name: 'Dark gray', hex: '#475569' },
  { name: 'Slate', hex: '#64748b' },
  { name: 'None', hex: '' },
];

export const DEFAULT_LABEL_COLOR = '#22c55e';