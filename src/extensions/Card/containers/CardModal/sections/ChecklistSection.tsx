// ChecklistSection (modal section wrapper) — wraps ChecklistSection component.
import type { Checklist } from '../../../api';
import { ChecklistSection as ChecklistWidget } from '../../../components/ChecklistSection';

interface Props {
  checklist: Checklist;
  boardMembers: Array<{ id: string; email: string; name: string | null; avatar_url?: string | null }>;
  onRename: (title: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onItemAdd: (title: string) => Promise<void>;
  onItemToggle: (itemId: string, checked: boolean) => Promise<void>;
  onItemRename: (itemId: string, title: string) => Promise<void>;
  onItemDelete: (itemId: string) => Promise<void>;
  onItemAssign: (itemId: string, memberId: string | null) => Promise<void>;
  onItemDueDateChange: (itemId: string, dueDate: string | null) => Promise<void>;
  onItemConvertToCard: (itemId: string) => Promise<void>;
  disabled?: boolean;
}

export const ChecklistSection = (props: Props) => <ChecklistWidget {...props} />;
