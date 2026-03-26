// IconPicker — grid of 24 selectable Heroicons (outline) for automation buttons.
import {
  BoltIcon,
  PlayIcon,
  ArrowRightIcon,
  CheckIcon,
  StarIcon,
  FlagIcon,
  TagIcon,
  UserPlusIcon,
  ClockIcon,
  CalendarIcon,
  ArchiveBoxIcon,
  ArrowUturnRightIcon,
  ChatBubbleLeftIcon,
  PaperClipIcon,
  PencilSquareIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FireIcon,
  HandThumbUpIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import type { FC, SVGProps, ComponentType } from 'react';

// Heroicons are ForwardRefExoticComponents — use a permissive local alias.
type HeroIcon = ComponentType<SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>;

export const BUTTON_ICONS = [
  'BoltIcon', 'PlayIcon', 'ArrowRightIcon', 'CheckIcon', 'StarIcon',
  'FlagIcon', 'TagIcon', 'UserPlusIcon', 'ClockIcon', 'CalendarIcon',
  'ArchiveBoxIcon', 'ArrowUturnRightIcon', 'ChatBubbleLeftIcon',
  'PaperClipIcon', 'PencilSquareIcon', 'DocumentDuplicateIcon',
  'CheckCircleIcon', 'ExclamationTriangleIcon', 'FireIcon',
  'HandThumbUpIcon', 'RocketLaunchIcon', 'ShieldCheckIcon',
  'SparklesIcon', 'LightBulbIcon',
] as const;

export type ButtonIconName = typeof BUTTON_ICONS[number];

const ICON_MAP: Record<ButtonIconName, HeroIcon> = {
  BoltIcon,
  PlayIcon,
  ArrowRightIcon,
  CheckIcon,
  StarIcon,
  FlagIcon,
  TagIcon,
  UserPlusIcon,
  ClockIcon,
  CalendarIcon,
  ArchiveBoxIcon,
  ArrowUturnRightIcon,
  ChatBubbleLeftIcon,
  PaperClipIcon,
  PencilSquareIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FireIcon,
  HandThumbUpIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  LightBulbIcon,
};

/** Renders a Heroicon by its registered name, falling back to PlayIcon. */
export const ButtonIcon: FC<{ name: string | null; className?: string }> = ({ name, className = 'h-4 w-4' }) => {
  const resolved = (name && name in ICON_MAP ? name : 'PlayIcon') as ButtonIconName;
  const Icon = ICON_MAP[resolved] as FC<{ className?: string }>;
  return <Icon className={className} aria-hidden="true" />;
};

interface Props {
  value: ButtonIconName | null;
  onChange: (icon: ButtonIconName) => void;
}

/** Grid of 24 icon buttons — clicking one selects it. */
const IconPicker: FC<Props> = ({ value, onChange }) => {
  return (
    <div className="grid grid-cols-8 gap-1.5 p-2 bg-bg-surface rounded-lg border border-border">
      {BUTTON_ICONS.map((name) => {
        const Icon = ICON_MAP[name] as FC<{ className?: string }>;
        const selected = value === name;
        return (
          <button
            key={name}
            type="button"
            title={name.replace('Icon', '')}
            aria-pressed={selected}
            onClick={() => onChange(name)}
            className={[
              'flex items-center justify-center rounded-md p-1.5 transition-colors',
              selected
                ? 'bg-primary text-white ring-2 ring-primary/50' // [theme-exception] text-white on selected primary icon
                : 'text-muted hover:bg-bg-overlay hover:text-subtle',
            ].join(' ')}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
};

export default IconPicker;
