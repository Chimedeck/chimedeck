// CardModal — full detail Radix Dialog modal for viewing and editing a card.
// URL-driven: ?card=:id opens the modal; closing clears the query param.
import * as Dialog from '@radix-ui/react-dialog';
import type { Card, Label, CardMember, ChecklistItem } from '../api';
import CardTitle from './CardTitle';
import CardDescription from './CardDescription';
import CardChecklist from './CardChecklist';
import CardLabels from './CardLabels';
import CardMembers from './CardMembers';
import CardDueDate from './CardDueDate';
import CardActionMenu from './CardActionMenu';
import CardSidebarSection from './CardSidebarSection';
import CommentThread from '~/extensions/Comment/components/CommentThread';
import type { Comment } from '~/extensions/Comment/components/CommentItem';

interface BoardMember {
  id: string;
  email: string;
  name: string | null;
}

interface Props {
  boardId: string;
  open: boolean;
  card: Card;
  listTitle: string;
  boardTitle: string;
  labels: Label[];
  allLabels: Label[];
  members: CardMember[];
  boardMembers: BoardMember[];
  checklistItems: ChecklistItem[];
  comments: Comment[];
  currentUserId: string;
  onClose: () => void;
  onTitleSave: (title: string) => void;
  onDescriptionSave: (description: string) => void;
  onDueDateChange: (date: string | null) => void;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
  onCopyLink: () => void;
  onChecklistAdd: (title: string) => Promise<void>;
  onChecklistToggle: (itemId: string, checked: boolean) => Promise<void>;
  onChecklistRename: (itemId: string, title: string) => Promise<void>;
  onChecklistDelete: (itemId: string) => Promise<void>;
  onLabelAttach: (labelId: string) => Promise<void>;
  onLabelDetach: (labelId: string) => Promise<void>;
  onLabelCreate: (name: string, color: string) => Promise<void>;
  onMemberAssign: (userId: string) => Promise<void>;
  onMemberRemove: (userId: string) => Promise<void>;
  onAddComment: (content: string) => Promise<void>;
  onEditComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
}

const CardModal = ({
  boardId,
  open,
  card,
  listTitle,
  boardTitle,
  labels,
  allLabels,
  members,
  boardMembers,
  checklistItems,
  comments,
  currentUserId,
  onClose,
  onTitleSave,
  onDescriptionSave,
  onDueDateChange,
  onArchive,
  onDelete,
  onCopyLink,
  onChecklistAdd,
  onChecklistToggle,
  onChecklistRename,
  onChecklistDelete,
  onLabelAttach,
  onLabelDetach,
  onLabelCreate,
  onMemberAssign,
  onMemberRemove,
  onAddComment,
  onEditComment,
  onDeleteComment,
}: Props) => {
  const isReadOnly = card.archived;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />

        {/* Panel */}
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 pb-8 overflow-y-auto"
          aria-label={`Card: ${card.title}`}
        >
          {/* Visually-hidden title for screen-reader accessibility (Radix requirement) */}
          <Dialog.Title className="sr-only">Card: {card.title}</Dialog.Title>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl mx-auto flex flex-col">
            {/* Header */}
            <div className="flex items-start gap-2 p-5 pb-2">
              <div className="flex-1 min-w-0">
                <CardTitle
                  title={card.title}
                  onSave={onTitleSave}
                  disabled={isReadOnly}
                />
                <p className="mt-1 text-xs text-slate-500 px-2">
                  in list <span className="text-slate-400 font-medium">{listTitle}</span>{' '}
                  · {boardTitle}
                </p>
              </div>
              <Dialog.Close
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors flex-shrink-0"
                aria-label="Close"
              >
                ✕
              </Dialog.Close>
            </div>

            {isReadOnly && (
              <div className="mx-5 mb-2 rounded-lg bg-yellow-900/30 border border-yellow-700/50 px-3 py-2 text-sm text-yellow-400">
                This card is archived.
              </div>
            )}

            {/* Body: main + sidebar */}
            <div className="flex flex-col md:flex-row gap-4 p-5 pt-3">
              {/* Main column */}
              <div className="flex-1 min-w-0 space-y-6">
                <CardDescription
                  boardId={boardId}
                  description={card.description ?? ''}
                  onSave={onDescriptionSave}
                  disabled={isReadOnly}
                />

                <CardChecklist
                  items={checklistItems}
                  onAdd={onChecklistAdd}
                  onToggle={onChecklistToggle}
                  onRename={onChecklistRename}
                  onDelete={onChecklistDelete}
                  disabled={isReadOnly}
                />

                <CommentThread
                  boardId={boardId}
                  comments={comments}
                  currentUserId={currentUserId}
                  onAddComment={onAddComment}
                  onEditComment={onEditComment}
                  onDeleteComment={onDeleteComment}
                />
              </div>

              {/* Sidebar */}
              <aside className="w-full md:w-52 flex-shrink-0 space-y-5">
                <CardSidebarSection title="Members">
                  <CardMembers
                    members={members}
                    boardMembers={boardMembers}
                    onAssign={onMemberAssign}
                    onRemove={onMemberRemove}
                    disabled={isReadOnly}
                  />
                </CardSidebarSection>

                <CardSidebarSection title="Labels">
                  <CardLabels
                    assignedLabels={labels}
                    allLabels={allLabels}
                    onAttach={onLabelAttach}
                    onDetach={onLabelDetach}
                    onCreateAndAttach={onLabelCreate}
                    disabled={isReadOnly}
                  />
                </CardSidebarSection>

                <CardSidebarSection title="Due Date">
                  <CardDueDate
                    dueDate={card.due_date}
                    onChange={onDueDateChange}
                    disabled={isReadOnly}
                  />
                </CardSidebarSection>

                <CardSidebarSection title="Actions">
                  <CardActionMenu
                    cardId={card.id}
                    archived={card.archived}
                    onArchive={onArchive}
                    onDelete={onDelete}
                    onCopyLink={onCopyLink}
                  />
                </CardSidebarSection>
              </aside>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default CardModal;
