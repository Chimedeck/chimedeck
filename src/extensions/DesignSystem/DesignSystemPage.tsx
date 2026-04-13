// DesignSystemPage — living design-system reference rendered inside AppShell.
// Each section has a stable anchor id for sticky side-nav deep-linking.
import {
  Section,
  CodeSnippet,
  ColorSwatch,
  TypographySample,
  BadgeSample,
  FormInputSample,
  SpinnerExample,
  ModalExample,
  AvatarExample,
  CardExample,
  CommentExample,
  ReactionExample,
  AttachmentExample,
  NotificationExample,
  TooltipExample,
  EmptyStateExample,
} from './components';
import Button from '~/common/components/Button';
import IconButton from '~/common/components/IconButton';
import { XMarkIcon, PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

/** Nav entries drive both the sticky sidebar list and section ids. */
const NAV_ITEMS = [
  { id: 'colors', label: 'Color Tokens' },
  { id: 'typography', label: 'Typography' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'icon-buttons', label: 'Icon Buttons' },
  { id: 'badges', label: 'Badges' },
  { id: 'forms', label: 'Form Inputs' },
  { id: 'spinners', label: 'Spinners' },
  { id: 'comments', label: 'Comments' },
  { id: 'reactions', label: 'Reactions' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'tooltips', label: 'Tooltips' },
  { id: 'empty-states', label: 'Empty States' },
  { id: 'modals', label: 'Modals' },
  { id: 'avatars', label: 'Avatars' },
  { id: 'cards', label: 'Cards' },
] as const;

export default function DesignSystemPage() {
  return (
    <div className="flex min-h-full">
      {/* Sticky side-nav — hidden on mobile, visible on lg+ */}
      <nav
        aria-label="Design system sections"
        className="hidden lg:block sticky top-0 self-start w-52 shrink-0 py-8 pl-6 pr-4 h-screen overflow-y-auto border-r border-border-subtle"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-4">
          Contents
        </p>
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ id, label }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="block text-sm text-text-secondary hover:text-text-primary py-0.5 transition-colors"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Main content area */}
      <main className="flex-1 min-w-0 px-6 lg:px-10 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Design System</h1>
        <p className="text-text-secondary mb-8">
          A living catalogue of UI tokens and components used across the app.
        </p>

        {/* ── Color Tokens ─────────────────────────────────────── */}
        <Section
          id="colors"
          title="Color Tokens"
          description="Semantic CSS variables for backgrounds, text, borders, and brand colours. Values shown are light-mode defaults."
        >
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Brand</p>
              <div className="flex flex-wrap gap-6">
                <ColorSwatch variable="--color-primary" label="primary" />
                <ColorSwatch variable="--color-primary-hover" label="primary-hover" />
                <ColorSwatch variable="--color-secondary" label="secondary" />
                <ColorSwatch variable="--color-accent" label="accent" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Status</p>
              <div className="flex flex-wrap gap-6">
                <ColorSwatch variable="--color-danger" label="danger" />
                <ColorSwatch variable="--color-success" label="success" />
                <ColorSwatch variable="--color-warning" label="warning" />
                <ColorSwatch variable="--color-info" label="info" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Backgrounds</p>
              <div className="flex flex-wrap gap-6">
                <ColorSwatch variable="--bg-base" label="bg-base" />
                <ColorSwatch variable="--bg-surface" label="bg-surface" />
                <ColorSwatch variable="--bg-overlay" label="bg-overlay" />
                <ColorSwatch variable="--bg-sunken" label="bg-sunken" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Text</p>
              <div className="flex flex-wrap gap-6">
                <ColorSwatch variable="--text-base" label="text-base" />
                <ColorSwatch variable="--text-muted" label="text-muted" />
                <ColorSwatch variable="--text-subtle" label="text-subtle" />
                <ColorSwatch variable="--text-link" label="text-link" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Borders</p>
              <div className="flex flex-wrap gap-6">
                <ColorSwatch variable="--border" label="border" />
                <ColorSwatch variable="--border-strong" label="border-strong" />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Typography ───────────────────────────────────────── */}
        <Section
          id="typography"
          title="Typography"
          description="Text scale used across the product."
        >
          <div className="divide-y divide-border-subtle">
            <TypographySample label="Display" className="text-3xl font-bold" />
            <TypographySample label="Heading 1" className="text-2xl font-semibold" />
            <TypographySample label="Heading 2" className="text-xl font-semibold" />
            <TypographySample label="Body" className="text-base" />
            <TypographySample label="Small" className="text-sm" />
            <TypographySample label="Caption" className="text-xs text-text-secondary" />
          </div>
        </Section>

        {/* ── Buttons ──────────────────────────────────────────── */}
        <Section
          id="buttons"
          title="Buttons"
          description="Primary, secondary, ghost, danger, success, and link variants in three sizes."
        >
          {/* Variants row */}
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">
              Variants
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="success">Success</Button>
              <Button variant="link">Link</Button>
            </div>
          </div>

          {/* Sizes row */}
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">
              Sizes
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="lg">Large</Button>
              <Button variant="primary" size="md">Medium</Button>
              <Button variant="primary" size="sm">Small</Button>
            </div>
          </div>

          {/* Disabled row */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">
              Disabled state
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" disabled>Primary</Button>
              <Button variant="secondary" disabled>Secondary</Button>
              <Button variant="ghost" disabled>Ghost</Button>
              <Button variant="danger" disabled>Danger</Button>
            </div>
          </div>

          <CodeSnippet
            code={`import Button from '~/common/components/Button';

<Button variant="primary">Save</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="danger" disabled>Delete</Button>`}
          />
        </Section>

        {/* ── Icon Buttons ──────────────────────────────────────── */}
        <Section
          id="icon-buttons"
          title="Icon Buttons"
          description="Square icon-only buttons — aria-label is required for accessibility."
        >
          {/* Variants */}
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">
              Variants
            </p>
            <div className="flex flex-wrap gap-3">
              <IconButton
                aria-label="Close (ghost)"
                icon={<XMarkIcon className="h-4 w-4" />}
                variant="ghost"
              />
              <IconButton
                aria-label="Edit (secondary)"
                icon={<PencilIcon className="h-4 w-4" />}
                variant="secondary"
              />
              <IconButton
                aria-label="Delete (danger)"
                icon={<TrashIcon className="h-4 w-4" />}
                variant="danger"
              />
              <IconButton
                aria-label="Add (primary)"
                icon={<PlusIcon className="h-4 w-4" />}
                variant="primary"
              />
            </div>
          </div>

          {/* Disabled */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">
              Disabled state
            </p>
            <div className="flex flex-wrap gap-3">
              <IconButton
                aria-label="Close (disabled)"
                icon={<XMarkIcon className="h-4 w-4" />}
                disabled
              />
            </div>
          </div>

          <CodeSnippet
            code={`import IconButton from '~/common/components/IconButton';
import { XMarkIcon } from '@heroicons/react/24/outline';

<IconButton
  aria-label="Close"
  icon={<XMarkIcon className="h-4 w-4" />}
  variant="ghost"
/>`}
          />
        </Section>

        {/* ── Badges ───────────────────────────────────────────── */}
        <Section
          id="badges"
          title="Badges"
          description="Inline status pills built from semantic CSS tokens. No dedicated Badge component — use the class pattern directly."
        >
          <div className="mb-6">
            <BadgeSample />
          </div>
          <CodeSnippet
            code={`{/* Badge — use inline span with token-based classes */}
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-success text-white">
  Success
</span>

<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-danger text-white">
  Danger
</span>`}
          />
        </Section>

        {/* ── Form Inputs ───────────────────────────────────────── */}
        <Section
          id="forms"
          title="Form Inputs"
          description="Text inputs, selects, checkboxes, and radios using shared Input component and token-styled native controls."
        >
          <div className="mb-6">
            <FormInputSample />
          </div>
          <CodeSnippet
            code={`import Input from '~/common/components/Input';

{/* Basic text input */}
<Input label="Title" placeholder="Enter value" />

{/* Error state */}
<Input label="Email" error="Invalid email address" />

{/* Disabled */}
<Input label="Read only" disabled defaultValue="Locked" />`}
          />
        </Section>

        {/* ── Spinners ─────────────────────────────────────────── */}
        <Section
          id="spinners"
          title="Spinners"
          description="Accessible loading indicators with three sizes. Uses role=status and aria-label from translations."
        >
          <div className="mb-6">
            <SpinnerExample />
          </div>
          <CodeSnippet
            code={`import Spinner from '~/common/components/Spinner';

<Spinner size="sm" />
<Spinner size="md" />
<Spinner size="lg" />`}
          />
        </Section>

        {/* ── Comments ─────────────────────────────────────────── */}
        <Section
          id="comments"
          title="Comments"
          description="Thread-style comment list with avatar, author, timestamp, and reply input stub."
        >
          <div className="mb-6">
            <CommentExample />
          </div>
          <CodeSnippet
            code={`{/* Comment item layout */}
<article className="flex gap-3" aria-label="Comment by Alice Brown">
  <div className="h-8 w-8 rounded-full bg-blue-500 …">AB</div>
  <div>
    <span className="text-sm font-semibold">Alice Brown</span>
    <span className="text-xs text-text-secondary">2h ago</span>
    <p className="text-sm">Comment body text…</p>
  </div>
</article>`}
          />
        </Section>

        {/* ── Reactions ────────────────────────────────────────── */}
        <Section
          id="reactions"
          title="Reactions"
          description="Emoji reaction pills with toggle state (aria-pressed). Click a pill to toggle."
        >
          <div className="mb-6">
            <ReactionExample />
          </div>
          <CodeSnippet
            code={`{/* Reaction pill — active when user has reacted */}
<button
  type="button"
  aria-label="thumbs up: 4 reactions"
  aria-pressed={reactedByMe}
  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border …"
>
  👍 <span>4</span>
</button>`}
          />
        </Section>

        {/* ── Attachments ──────────────────────────────────────── */}
        <Section
          id="attachments"
          title="Attachments"
          description="File attachment list with type icon, size, and upload status badge."
        >
          <div className="mb-6">
            <AttachmentExample />
          </div>
          <CodeSnippet
            code={`{/* Attachment list item */}
<li className="flex items-center gap-3 px-4 py-3 bg-bg-surface …">
  <PhotoIcon className="h-5 w-5 text-blue-400" />
  <div>
    <p className="text-sm font-medium">design-mockup.png</p>
    <p className="text-xs text-text-secondary">2.4 MB</p>
  </div>
  <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">Ready</span>
</li>`}
          />
        </Section>

        {/* ── Notifications ────────────────────────────────────── */}
        <Section
          id="notifications"
          title="Notifications"
          description="In-app notification feed with read/unread state and severity icons."
        >
          <div className="mb-6">
            <NotificationExample />
          </div>
          <CodeSnippet
            code={`{/* Notification item — unread has highlighted background */}
<li
  className={unread ? 'bg-bg-subtle' : 'bg-bg-surface'}
  aria-label={unread ? \`Unread: \${title}\` : title}
>
  <InformationCircleIcon className="h-5 w-5 text-info" />
  <div>
    <p className="text-sm font-medium">{title}</p>
    <p className="text-xs text-text-secondary">{body}</p>
  </div>
</li>`}
          />
        </Section>

        {/* ── Tooltips ─────────────────────────────────────────── */}
        <Section
          id="tooltips"
          title="Tooltips"
          description="CSS group-hover tooltip pattern for top, bottom, and right positions. Hover the buttons below."
        >
          <div className="mb-6">
            <TooltipExample />
          </div>
          <CodeSnippet
            code={`{/* CSS-only tooltip via Tailwind group-hover */}
<div className="relative inline-flex group">
  <button>Hover me</button>
  <span
    role="tooltip"
    className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2
               whitespace-nowrap rounded px-2 py-1 bg-gray-900 text-white text-xs
               opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity"
  >
    Tooltip text
  </span>
</div>`}
          />
        </Section>

        {/* ── Empty States ─────────────────────────────────────── */}
        <Section
          id="empty-states"
          title="Empty States"
          description="Centred placeholder layout with icon, heading, description, and optional action."
        >
          <div className="mb-6">
            <EmptyStateExample />
          </div>
          <CodeSnippet
            code={`{/* Empty state — dashed border container */}
<div className="flex flex-col items-center text-center px-6 py-10
                rounded-lg border border-dashed border-border bg-bg-subtle">
  <FolderOpenIcon className="h-6 w-6 text-text-secondary mb-4" />
  <h3 className="text-sm font-semibold text-text-primary mb-1">No cards yet</h3>
  <p className="text-xs text-text-secondary mb-4">Add your first card to get started.</p>
  <Button variant="primary" size="sm">Add card</Button>
</div>`}
          />
        </Section>

        {/* ── Modals ───────────────────────────────────────────── */}
        <Section
          id="modals"
          title="Modals"
          description="Fixed-overlay dialog with backdrop, header, body, and footer action row. Click 'Open Modal' to preview."
        >
          <div className="mb-6">
            <ModalExample />
          </div>
          <CodeSnippet
            code={`{/* Modal backdrop + panel */}
<div
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <div className="bg-bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
    <h3 id="modal-title">Modal Title</h3>
    <p>Modal body content.</p>
    <div className="flex justify-end gap-2">
      <Button variant="ghost">Cancel</Button>
      <Button variant="primary">Confirm</Button>
    </div>
  </div>
</div>`}
          />
        </Section>

        {/* ── Avatars ──────────────────────────────────────────── */}
        <Section
          id="avatars"
          title="Avatars"
          description="Initials-based user avatars in three sizes, plus stacked member row with overflow count."
        >
          <div className="mb-6">
            <AvatarExample />
          </div>
          <CodeSnippet
            code={`{/* Avatar — initials with semantic colour */}
<div
  aria-label="Alice Brown"
  className="h-9 w-9 rounded-full bg-blue-500 flex items-center
             justify-center text-white text-sm font-semibold"
>
  AB
</div>

{/* Stacked row with overflow */}
<div className="flex -space-x-2">
  {members.map((m) => <Avatar key={m.id} {...m} />)}
  <div className="h-9 w-9 rounded-full bg-bg-subtle … text-xs">+3</div>
</div>`}
          />
        </Section>

        {/* ── Cards ────────────────────────────────────────────── */}
        <Section
          id="cards"
          title="Cards"
          description="Board card surface with label chips, due date, comment/attachment counters, and assignee avatars."
        >
          <div className="mb-6">
            <CardExample />
          </div>
          <CodeSnippet
            code={`{/* Board card */}
<article
  className="bg-bg-surface rounded-lg border border-border p-3 shadow-sm hover:shadow-md …"
  aria-label={\`Card: \${title}\`}
>
  {/* Label colour chips */}
  <div className="flex gap-1 mb-2">
    <span className="h-1.5 w-8 rounded-full bg-blue-500" title="Design" />
  </div>
  <p className="text-sm font-medium">{title}</p>
  {/* Footer: due date · comments · attachments · assignees */}
</article>`}
          />
        </Section>
      </main>
    </div>
  );
}
