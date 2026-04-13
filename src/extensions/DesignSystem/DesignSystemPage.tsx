// DesignSystemPage — living design-system reference rendered inside AppShell.
// Each section has a stable anchor id for sticky side-nav deep-linking.
import {
  Section,
  CodeSnippet,
  ColorSwatch,
  TypographySample,
  BadgeSample,
  FormInputSample,
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
  { id: 'toasts', label: 'Toasts' },
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

        {/* ── Spinners (stub) ──────────────────────────────────── */}
        <Section
          id="spinners"
          title="Spinners"
          description="Loading indicators."
        >
          <CodeSnippet code={`import Spinner from '~/common/components/Spinner';\n\n<Spinner />`} />
        </Section>

        {/* ── Toasts (stub) ────────────────────────────────────── */}
        <Section id="toasts" title="Toasts" description="Transient feedback messages.">
          <p className="text-sm text-text-secondary italic">Coming in Iteration 11.</p>
        </Section>

        {/* ── Modals (stub) ────────────────────────────────────── */}
        <Section id="modals" title="Modals" description="Dialog overlays.">
          <p className="text-sm text-text-secondary italic">Coming in Iteration 11.</p>
        </Section>

        {/* ── Avatars (stub) ───────────────────────────────────── */}
        <Section id="avatars" title="Avatars" description="User profile pictures and initials.">
          <p className="text-sm text-text-secondary italic">Coming in Iteration 11.</p>
        </Section>

        {/* ── Cards (stub) ─────────────────────────────────────── */}
        <Section id="cards" title="Cards" description="Board and task card surfaces.">
          <p className="text-sm text-text-secondary italic">Coming in Iteration 11.</p>
        </Section>
      </main>
    </div>
  );
}
