// AvatarExample — shows initials-based and placeholder avatar patterns.
// No image URLs — fully static and dependency-free.

const COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-pink-500',
];

interface AvatarProps {
  initials: string;
  colorIndex?: number;
  size?: 'sm' | 'md' | 'lg';
  label: string;
}

function Avatar({ initials, colorIndex = 0, size = 'md', label }: AvatarProps) {
  const sizeClass = size === 'sm' ? 'h-7 w-7 text-xs' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-sm';
  return (
    <div
      aria-label={label}
      title={label}
      className={`${sizeClass} ${COLORS[colorIndex % COLORS.length] ?? ''} rounded-full flex items-center justify-center text-white font-semibold select-none`}
    >
      {initials}
    </div>
  );
}

const STUB_USERS = [
  { initials: 'AB', name: 'Alice Brown' },
  { initials: 'CJ', name: 'Carlos Jiménez' },
  { initials: 'DK', name: 'Diana Kim' },
  { initials: 'EF', name: 'Ethan Foster' },
  { initials: 'FG', name: 'Fatima Gonzalez' },
];

export default function AvatarExample() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Sizes</p>
        <div className="flex items-center gap-4">
          <Avatar initials="AB" colorIndex={0} size="sm" label="Alice Brown (sm)" />
          <Avatar initials="AB" colorIndex={0} size="md" label="Alice Brown (md)" />
          <Avatar initials="AB" colorIndex={0} size="lg" label="Alice Brown (lg)" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Members row</p>
        <div className="flex -space-x-2">
          {STUB_USERS.map((u, i) => (
            <Avatar key={u.name} initials={u.initials} colorIndex={i} label={u.name} />
          ))}
          <div
            aria-label="3 more members"
            className="h-9 w-9 rounded-full bg-bg-subtle border border-border flex items-center justify-center text-xs text-text-secondary font-semibold"
          >
            +3
          </div>
        </div>
      </div>
    </div>
  );
}
