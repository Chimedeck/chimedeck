// DesignSystemPage — scaffold for the living design-system reference.
// The page renders inside AppShell (via <Outlet />) so it inherits the
// sidebar + topbar chrome automatically.  Each section of the catalogue
// is backed by a stable anchor id so the sticky side-nav can deep-link.
import { Section, CodeSnippet, ColorSwatch, TypographySample } from './components';

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
          description="Semantic CSS variables for backgrounds, text, borders, and brand colours."
        >
          <div className="flex flex-wrap gap-6">
            <ColorSwatch variable="--color-bg-base" label="bg-base" />
            <ColorSwatch variable="--color-bg-subtle" label="bg-subtle" />
            <ColorSwatch variable="--color-text-primary" label="text-primary" />
            <ColorSwatch variable="--color-text-secondary" label="text-secondary" />
            <ColorSwatch variable="--color-border-subtle" label="border-subtle" />
            <ColorSwatch variable="--color-brand-primary" label="brand-primary" />
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

        {/* ── Buttons (stub — content in Iteration 10) ─────────── */}
        <Section
          id="buttons"
          title="Buttons"
          description="Primary, secondary, ghost, danger, and link variants."
        >
          <CodeSnippet code={`import { Button } from '~/common/components';\n\n<Button variant="primary">Save</Button>`} />
        </Section>

        {/* ── Icon Buttons (stub) ───────────────────────────────── */}
        <Section
          id="icon-buttons"
          title="Icon Buttons"
          description="Square icon-only action buttons with mandatory aria-label."
        >
          <CodeSnippet code={`import { IconButton } from '~/common/components';\n\n<IconButton aria-label="Close"><XMarkIcon /></IconButton>`} />
        </Section>

        {/* ── Badges (stub) ────────────────────────────────────── */}
        <Section
          id="badges"
          title="Badges"
          description="Status and label pills."
        >
          <p className="text-sm text-text-secondary italic">Coming in Iteration 10.</p>
        </Section>

        {/* ── Form Inputs (stub) ───────────────────────────────── */}
        <Section
          id="forms"
          title="Form Inputs"
          description="Text inputs, selects, and checkboxes."
        >
          <CodeSnippet code={`import Input from '~/common/components/Input';\n\n<Input placeholder="Enter value" />`} />
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
