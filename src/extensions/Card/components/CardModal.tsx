// CardModal — full detail Radix Dialog modal for viewing and editing a card.
// URL-driven: ?card=:id opens the modal; closing clears the query param.
// Two-column layout: left = content, right = ActivityFeed (ResizablePanels).
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { Card, Label, CardMember, Checklist } from '../api';
import CardTitle from './CardTitle';
import CardDescriptionTiptap from './CardDescriptionTiptap';
import CardChecklist from './CardChecklist';
import CardMetaStrip from './CardMetaStrip';
import CardModalBottomBar from './CardModalBottomBar';
import ResizablePanels from './ResizablePanels';
import ActivityFeed from '../containers/CardModal/ActivityFeed';
import CardDetailPluginBadges from '../../Plugins/uiInjections/CardDetailPluginBadges';
import CardPluginSection from '../../Plugins/uiInjections/CardPluginSection';
import CustomFieldsSection from '../../CustomFields/CustomFieldsSection';
import { AttachmentPanel } from '../../Attachments/components/AttachmentPanel';
import { useAttachmentUpload } from '../../Attachments/hooks/useAttachmentUpload';

import type { ActivityData } from '../slices/cardDetailSlice';
import type { CommentData } from '../api/cardDetail';

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
  checklists: Checklist[];
  comments: CommentData[];
  activities: ActivityData[];
  currentUserId: string;
  onClose: () => void;
  onTitleSave: (title: string) => void;
  onDescriptionSave: (description: string) => void;
  onStartDateChange: (date: string | null) => void;
  onDueDateChange: (date: string | null) => void;
  onDueCompleteChange: (done: boolean) => void;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
  onCopyLink: () => void;
  onCopyCard: () => void;
  onCreateChecklist: (title?: string) => Promise<void>;
  onRenameChecklist: (checklistId: string, title: string) => Promise<void>;
  onDeleteChecklist: (checklistId: string) => Promise<void>;
  onItemAdd: (checklistId: string, title: string) => Promise<void>;
  onItemToggle: (checklistId: string, itemId: string, checked: boolean) => Promise<void>;
  onItemRename: (checklistId: string, itemId: string, title: string) => Promise<void>;
  onItemDelete: (checklistId: string, itemId: string) => Promise<void>;
  onLabelAttach: (labelId: string) => Promise<void>;
  onLabelDetach: (labelId: string) => Promise<void>;
  onLabelCreate: (name: string, color: string) => Promise<void>;
  onLabelUpdate: (labelId: string, name: string, color: string) => Promise<void>;
  onMemberAssign: (userId: string) => Promise<void>;
  onMemberRemove: (userId: string) => Promise<void>;
  onAddComment: (content: string) => Promise<void>;
  onEditComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onMoneySave: (amount: string | null, currency: string) => Promise<void>;
  onCoverColorChange: (color: string | null) => void;
  onCoverSizeChange: (size: 'SMALL' | 'FULL') => void;
  onCoverAttachmentChange: (attachmentId: string | null) => void;
  /** True when the current user is a VIEWER guest — hides write-action controls. */
  isViewerGuest?: boolean;
}

const COVER_COLORS = [
  '#22C55E',
  '#EAB308',
  '#EA580C',
  '#EF4444',
  '#A855F7',
  '#2563EB',
  '#0891B2',
  '#4D7C0F',
  '#DB2777',
  '#6B7280',
];

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
  checklists,
  comments,
  activities,
  currentUserId,
  onClose,
  onTitleSave,
  onDescriptionSave,
  onStartDateChange,
  onDueDateChange,
  onDueCompleteChange,
  onArchive,
  onDelete,
  onCopyLink,
  onCopyCard,
  onCreateChecklist,
  onRenameChecklist,
  onDeleteChecklist,
  onItemAdd,
  onItemToggle,
  onItemRename,
  onItemDelete,
  onLabelAttach,
  onLabelDetach,
  onLabelCreate,
  onLabelUpdate,
  onMemberAssign,
  onMemberRemove,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onMoneySave,
  onCoverColorChange,
  onCoverSizeChange,
  onCoverAttachmentChange,
  isViewerGuest = false,
}: Props) => {
  const isReadOnly = card.archived;
  const canEditCover = !isReadOnly && !isViewerGuest;
  // Activity panel visibility — toggled from the bottom bar
  const [activityVisible, setActivityVisible] = useState(true);
  const [coverMenuOpen, setCoverMenuOpen] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const coverMenuRef = useRef<HTMLDivElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  // [why] Shared ref so AttachmentPanel's Comment action can insert markdown into the
  // CommentEditor in ActivityFeed without prop-drilling through intermediate components.
  const insertMarkdownRef = useRef<((md: string) => void) | null>(null);

  const { uploads: coverUploads, upload: uploadCover } = useAttachmentUpload({
    cardId: card.id,
    onSuccess: (attachment) => {
      onCoverAttachmentChange(attachment.id);
      setCoverUploadError(null);
    },
    onError: (_clientId, message) => {
      setCoverUploadError(message);
    },
  });

  const coverUploading = coverUploads.some((entry) =>
    entry.phase === 'requesting-url' || entry.phase === 'uploading' || entry.phase === 'confirming',
  );

  useEffect(() => {
    if (!coverMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCoverMenuOpen(false);
    };
    const onMouseDown = (event: MouseEvent) => {
      if (coverMenuRef.current && !coverMenuRef.current.contains(event.target as Node)) {
        setCoverMenuOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [coverMenuOpen]);

  const hasCover = Boolean(card.cover_image_url || card.cover_color);

  const handlePickCoverFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCoverUploadError('Only image files can be used as a card cover.');
      event.target.value = '';
      return;
    }
    setCoverUploadError(null);
    uploadCover([file]);
    event.target.value = '';
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />

        {/* Panel */}
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 pb-8"
          aria-label={`Card: ${card.title}`}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          {/* Visually-hidden title for screen-reader accessibility (Radix requirement) */}
          <Dialog.Title className="sr-only">Card: {card.title}</Dialog.Title>
          <div className="bg-bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-5xl mx-auto flex flex-col max-h-[calc(100vh-5rem)]">
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePickCoverFile}
            />

            {hasCover && (
              <div
                className={`w-full overflow-hidden rounded-t-2xl ${(card.cover_size ?? 'SMALL') === 'FULL' ? 'h-44' : 'h-28'}`}
                style={card.cover_image_url
                  ? undefined
                  : { backgroundColor: card.cover_color ?? '#334155' }}
              >
                {card.cover_image_url
                  ? (
                    <img
                      src={card.cover_image_url}
                      alt="Card cover"
                      className="h-full w-full bg-slate-900/60 object-contain" // [theme-exception] dark overlay for media lightbox
                      loading="eager"
                      draggable={false}
                    />
                    )
                  : <span className="sr-only">Card cover color</span>}
              </div>
            )}

            {/* Header */}
            <div className="flex items-start gap-2 p-5 pb-2">
              <div className="flex-1 min-w-0">
                <CardTitle
                  title={card.title}
                  onSave={onTitleSave}
                  disabled={isReadOnly}
                />
                <p className="mt-1 text-xs text-subtle px-2">
                  in list <span className="text-muted font-medium">{listTitle}</span>{' '}
                  · {boardTitle}
                </p>
              </div>
              <div className="relative" ref={coverMenuRef}>
                <button
                  type="button"
                  className="rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-bg-overlay hover:text-base transition-colors disabled:opacity-40"
                  onClick={() => setCoverMenuOpen((openState) => !openState)}
                  disabled={!canEditCover}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <PhotoIcon className="h-4 w-4" aria-hidden="true" />
                    Cover
                  </span>
                </button>

                {coverMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-bg-surface p-3 shadow-xl">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      Size
                    </p>
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onCoverSizeChange('SMALL')}
                        className={`rounded-md border p-2 text-left text-xs transition-colors ${(card.cover_size ?? 'SMALL') === 'SMALL'
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'border-border text-muted hover:bg-bg-overlay'}`}
                      >
                        Compact
                      </button>
                      <button
                        type="button"
                        onClick={() => onCoverSizeChange('FULL')}
                        className={`rounded-md border p-2 text-left text-xs transition-colors ${(card.cover_size ?? 'SMALL') === 'FULL'
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'border-border text-muted hover:bg-bg-overlay'}`}
                      >
                        Large
                      </button>
                    </div>

                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      Colors
                    </p>
                    <div className="mb-3 grid grid-cols-5 gap-2">
                      {COVER_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => onCoverColorChange(color)}
                          className={`h-7 w-full rounded ${card.cover_color === color ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''}`}
                          style={{ backgroundColor: color }}
                          aria-label={`Set card cover color ${color}`}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={coverUploading}
                      className="mb-2 w-full rounded-md border border-border-strong px-3 py-2 text-xs font-medium text-base transition-colors hover:bg-bg-overlay disabled:opacity-50 dark:hover:bg-slate-800"
                    >
                      {coverUploading ? 'Uploading cover...' : 'Upload a cover image'}
                    </button>

                    {(card.cover_attachment_id || card.cover_color) && (
                      <button
                        type="button"
                        onClick={() => {
                          onCoverAttachmentChange(null);
                          onCoverColorChange(null);
                        }}
                        className="w-full rounded-md px-3 py-1.5 text-xs text-danger transition-colors hover:bg-red-50 dark:hover:bg-red-900/30"
                      >
                        Remove cover
                      </button>
                    )}

                    {coverUploadError && (
                      <p className="mt-2 text-xs text-danger">{coverUploadError}</p>
                    )}
                  </div>
                )}
              </div>
              <Dialog.Close
                className="rounded-lg p-2 text-subtle hover:bg-bg-overlay hover:text-base transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Metadata strip — labels, members, dates */}
            <div className="px-5 pb-2">
              <CardMetaStrip
                labels={labels}
                allLabels={allLabels}
                members={members}
                boardMembers={boardMembers}
                cardId={card.id}
                currentUserId={currentUserId}
                amount={card.amount ?? null}
                currency={card.currency ?? null}
                startDate={card.start_date}
                dueDate={card.due_date}
                dueComplete={card.due_complete}
                disabled={isReadOnly}
                onLabelAttach={onLabelAttach}
                onLabelDetach={onLabelDetach}
                onLabelCreate={onLabelCreate}
                onLabelUpdate={onLabelUpdate}
                onMemberAssign={onMemberAssign}
                onMemberRemove={onMemberRemove}
                onMoneySave={onMoneySave}
                onStartDateChange={onStartDateChange}
                onDueDateChange={onDueDateChange}
                onDueCompleteChange={onDueCompleteChange}
              />
            </div>

            {isReadOnly && (
              <div className="mx-5 mb-2 rounded-lg bg-yellow-900/30 border border-yellow-700/50 px-3 py-2 text-sm text-yellow-400">
                This card is archived.
              </div>
            )}

            {/* Body: ResizablePanels when activity visible, single column otherwise */}
            {activityVisible ? (
              <ResizablePanels
                className="flex-1 min-h-0"
                left={
                  <div className="h-full min-h-0 p-5 pt-3 pr-3 space-y-6">
                    <CardDescriptionTiptap
                      boardId={boardId}
                      cardId={card.id}
                      description={card.description ?? ''}
                      onSave={onDescriptionSave}
                      disabled={isReadOnly}
                    />

                    <CustomFieldsSection
                      boardId={boardId}
                      cardId={card.id}
                      disabled={isReadOnly}
                    />

                    <CardChecklist
                      checklists={checklists}
                      onCreateChecklist={onCreateChecklist}
                      onRenameChecklist={onRenameChecklist}
                      onDeleteChecklist={onDeleteChecklist}
                      onItemAdd={onItemAdd}
                      onItemToggle={onItemToggle}
                      onItemRename={onItemRename}
                      onItemDelete={onItemDelete}
                      disabled={isReadOnly}
                    />

                    <CardPluginSection
                      cardId={card.id}
                      listId={card.list_id}
                      boardId={boardId}
                    />

                    <AttachmentPanel cardId={card.id} canWrite={!isViewerGuest} insertMarkdownRef={insertMarkdownRef} />

                    {/* Plugin detail badges */}
                    <div className="flex flex-wrap gap-3">
                      <CardDetailPluginBadges
                        cardId={card.id}
                        listId={card.list_id}
                        boardId={boardId}
                        cardTitle={card.title}
                        listTitle={listTitle}
                        boardTitle={boardTitle}
                      />
                    </div>
                  </div>
                }
                right={
                  <div className="h-full min-h-0 p-5 pt-3 pl-3 border-l border-gray-100">
                    <ActivityFeed
                      boardId={boardId}
                      cardId={card.id}
                      comments={comments}
                      activities={activities}
                      currentUserId={currentUserId}
                      boardMembers={boardMembers}
                      onAddComment={onAddComment}
                      onEditComment={onEditComment}
                      onDeleteComment={onDeleteComment}
                      canAddComment={!isViewerGuest}
                      insertMarkdownRef={insertMarkdownRef}
                    />
                  </div>
                }
              />
            ) : (
              <div className="flex-1 min-h-0 p-5 pt-3 overflow-y-auto">
                <div className="space-y-6">
                  <CardDescriptionTiptap
                    boardId={boardId}
                    cardId={card.id}
                    description={card.description ?? ''}
                    onSave={onDescriptionSave}
                    disabled={isReadOnly}
                  />

                  <CustomFieldsSection
                    boardId={boardId}
                    cardId={card.id}
                    disabled={isReadOnly}
                  />

                  <CardChecklist
                    checklists={checklists}
                    onCreateChecklist={onCreateChecklist}
                    onRenameChecklist={onRenameChecklist}
                    onDeleteChecklist={onDeleteChecklist}
                    onItemAdd={onItemAdd}
                    onItemToggle={onItemToggle}
                    onItemRename={onItemRename}
                    onItemDelete={onItemDelete}
                    disabled={isReadOnly}
                  />

                  <CardPluginSection
                    cardId={card.id}
                    listId={card.list_id}
                    boardId={boardId}
                  />

                  <AttachmentPanel cardId={card.id} canWrite={!isViewerGuest} insertMarkdownRef={insertMarkdownRef} />

                  {/* Plugin detail badges */}
                  <div className="flex flex-wrap gap-3">
                    <CardDetailPluginBadges
                      cardId={card.id}
                      listId={card.list_id}
                      boardId={boardId}
                      cardTitle={card.title}
                      listTitle={listTitle}
                      boardTitle={boardTitle}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Sticky bottom action bar */}
            <CardModalBottomBar
              boardId={boardId}
              cardId={card.id}
              listId={card.list_id}
              cardTitle={card.title}
              listTitle={listTitle}
              boardTitle={boardTitle}
              cardAmount={card.amount ?? null}
              cardCurrency={card.currency ?? null}
              archived={card.archived}
              disabled={isReadOnly}
              activityVisible={activityVisible}
              onToggleActivity={() => setActivityVisible((v) => !v)}
              onArchive={onArchive}
              onDelete={onDelete}
              onCopyLink={onCopyLink}
              onCopyCard={onCopyCard}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default CardModal;
