// ChecklistSection (modal section wrapper) — wraps ChecklistSection component.
import type { ChecklistItem } from '../../api';
import { ChecklistSection as ChecklistWidget } from '../../components/ChecklistSection';

interface Props {
  items: ChecklistItem[];
  onAdd: (title: string) => Promise<void>;
  onToggle: (itemId: string, checked: boolean) => Promise<void>;
  onRename: (itemId: string, title: string) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  disabled?: boolean;
}

export const ChecklistSection = (props: Props) => <ChecklistWidget {...props} />;
