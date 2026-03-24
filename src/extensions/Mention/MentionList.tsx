// Floating dropdown rendered inside the Tiptap suggestion popup.
// Receives suggestion items + command from the Tiptap suggestion plugin and
// exposes onKeyDown via forwardRef so the suggestion plugin can delegate
// arrow/enter/escape keys to this component.
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import MentionChipRow from '~/common/components/MentionInput/MentionChip';
import translations from './translations/en.json';

export interface MentionSuggestion {
  id: string;
  nickname: string;
  name: string;
  avatar_url: string | null;
}

interface Props {
  items: MentionSuggestion[];
  command: (attrs: { id: string; label: string }) => void;
}

export interface MentionListHandle {
  onKeyDown: (args: { event: KeyboardEvent }) => boolean;
}

const MentionList = forwardRef<MentionListHandle, Props>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection whenever the suggestion list changes
  useEffect(() => setSelectedIndex(0), [items]);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) {
      command({ id: item.id, label: item.nickname });
    }
  };

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) return null;

  return (
    <ul
      aria-label={translations['Mention.ariaList']}
      className="z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl min-w-[220px] max-h-[260px] overflow-y-auto"
    >
      {items.map((item, i) => (
        <li key={item.id}>
          <MentionChipRow
            nickname={item.nickname}
            name={item.name}
            avatarUrl={item.avatar_url}
            highlighted={i === selectedIndex}
            onSelect={() => selectItem(i)}
            onMouseEnter={() => setSelectedIndex(i)}
          />
        </li>
      ))}
    </ul>
  );
});

MentionList.displayName = 'MentionList';

export default MentionList;
