// PluginDocsPage — developer reference for the plugin / SDK system.
// Route: /developer/plugins (private, within AppShell)
import { useNavigate } from 'react-router-dom';
import {
  CodeBracketIcon,
  PuzzlePieceIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

// ─── Small primitives ────────────────────────────────────────────────────────

const Section = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-20">
    {children}
  </section>
);

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-4 text-xl font-semibold text-white">{children}</h2>
);

const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-2 mt-5 text-base font-semibold text-slate-100">{children}</h3>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-3 text-sm leading-relaxed text-slate-300">{children}</p>
);

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-indigo-300">
    {children}
  </code>
);

const Pre = ({ children }: { children: React.ReactNode }) => (
  <pre className="my-3 overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 px-4 py-4 font-mono text-xs leading-relaxed text-slate-200">
    {children}
  </pre>
);

const Divider = () => <hr className="my-8 border-slate-700" />;

const Badge = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{children}</span>
);

interface TableCell {
  key: string;
  content: React.ReactNode;
}

interface TableRow {
  rowId: string;
  cells: TableCell[];
}

const Table = ({ headers, rows }: { headers: string[]; rows: TableRow[] }) => (
  <div className="my-4 overflow-x-auto rounded-lg border border-slate-700">
    <table className="w-full text-sm">
      <thead className="bg-slate-800">
        <tr>
          {headers.map((h) => (
            <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.rowId} className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'}>
            {row.cells.map((cell) => (
              <td key={cell.key} className="border-t border-slate-800 px-4 py-2 text-slate-300">
                {cell.content}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const NavItem = ({ href, label }: { href: string; label: string }) => (
  <a
    href={href}
    className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
  >
    <ChevronRightIcon className="h-3 w-3 shrink-0 text-slate-600" />
    {label}
  </a>
);

// ─── Page ──────────────────────────────────────────────────────────────────────

const PluginDocsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* ── Left TOC ─────────────────────────────────────── */}
      <aside className="hidden w-56 shrink-0 border-r border-slate-800 bg-slate-900 xl:block">
        <div className="sticky top-0 overflow-y-auto py-8 px-3">
          <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            On this page
          </p>
          <nav className="space-y-0.5">
            <NavItem href="#overview" label="Overview" />
            <NavItem href="#how-plugins-work" label="How plugins work" />
            <NavItem href="#install-plugin" label="Installing a plugin" />
            <NavItem href="#sdks" label="Available SDKs" />
            <NavItem href="#jh-instance" label="jhInstance SDK" />
            <NavItem href="#initialize" label="jhInstance.initialize" />
            <NavItem href="#capabilities" label="Capabilities" />
            <NavItem href="#frame-context" label="FrameContext (t)" />
            <NavItem href="#ui-actions" label="UI actions" />
            <NavItem href="#rest-api" label="REST API client" />
            <NavItem href="#pages" label="Plugin pages" />
            <NavItem href="#trello-compat" label="Trello compatibility" />
            <NavItem href="#example" label="Full example" />
          </nav>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="border-b border-slate-800 bg-slate-900 px-8 py-5">
          <button
            onClick={() => navigate(-1)}
            className="mb-2 flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
          >
            ← Back
          </button>
          <div className="flex items-center gap-3">
            <PuzzlePieceIcon className="h-7 w-7 text-indigo-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Plugin &amp; SDK Developer Guide</h1>
              <p className="text-sm text-slate-400">
                Build, register, and enable plugins on boards using the <Code>jhInstance</Code> SDK.
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-8 py-10 space-y-2">

          {/* ── Overview ───────────────────────────────────── */}
          <Section id="overview">
            <div className="mb-6 rounded-lg border border-indigo-700/40 bg-indigo-900/20 px-5 py-4">
              <p className="text-sm text-indigo-200">
                The plugin system lets first-party extensions add capabilities to boards — card
                buttons, badges, sections, settings modals, and more. Each plugin is a small
                web app that the platform loads into a hidden <Code>&lt;iframe&gt;</Code> and
                communicates with over <Code>postMessage</Code>.
              </p>
            </div>
          </Section>

          {/* ── How plugins work ───────────────────────────── */}
          <Section id="how-plugins-work">
            <H2>How plugins work</H2>
            <ol className="mb-4 space-y-2 text-sm text-slate-300">
              {[
                'The plugin is registered in the Plugin Registry with a connector URL and a manifest.',
                'A board admin enables the plugin from the board\'s Settings → Plugins page.',
                'When the board loads, a hidden <iframe> is mounted pointing at connector.html.',
                'connector.html loads the jhInstance SDK and calls jhInstance.initialize(capabilities, config).',
                'The SDK brokers all communication between the plugin iframe and the board UI via postMessage.',
              ].map((step, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={i} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: step }} />
                </li>
              ))}
            </ol>
          </Section>

          <Divider />

          {/* ── Installing a plugin ────────────────────────── */}
          <Section id="install-plugin">
            <H2>
              <WrenchScrewdriverIcon className="mr-2 inline h-5 w-5 text-indigo-400" />
              Installing a plugin
            </H2>

            <H3>Step 1 — Create the plugin files</H3>
            <P>
              A plugin is a self-contained web app. At minimum it needs a{' '}
              <Code>connector.html</Code>, a <Code>manifest.json</Code>, and a{' '}
              <Code>client.js</Code>. Host it anywhere that is reachable over HTTPS.
            </P>
            <Pre>{`my-plugin/
├── connector.html      ← required — hidden iframe entry point
├── manifest.json       ← plugin metadata + capabilities declaration
├── client.js           ← your capability logic
├── settings.html       ← optional — board settings modal
└── section.html        ← optional — card-back section`}</Pre>

            <H3>Step 2 — Write manifest.json</H3>
            <Pre>{`{
  "name": "My Plugin",
  "key": "<api_key issued by platform>",
  "description": "Short description shown in the marketplace.",
  "iconUrl": "https://example.com/icon.png",
  "url": "https://example.com/connector.html",
  "capabilities": {
    "card-buttons": {
      "name": "Card Buttons",
      "description": "Adds action buttons to the card front"
    },
    "card-badges": {
      "name": "Card Badges",
      "description": "Compact badges shown on the card"
    },
    "show-settings": {
      "name": "Settings",
      "description": "Board-level settings modal"
    }
  }
}`}</Pre>

            <H3>Step 3 — Register the plugin in the database</H3>
            <P>
              Insert a row into the <Code>plugins</Code> table. Use the Admin API or run the
              SQL directly in development:
            </P>
            <Pre>{`INSERT INTO plugins (
  id, name, slug, description,
  icon_url, connector_url, manifest_url,
  author, author_email, support_email,
  categories, capabilities,
  is_public, is_active, api_key,
  created_at, updated_at
) VALUES (
  gen_cuid(),           -- or any CUID2
  'My Plugin',
  'my-plugin',          -- unique, URL-safe slug
  'Short description',
  'https://example.com/icon.png',
  'https://example.com/connector.html',
  'https://example.com/manifest.json',
  'Your Name', 'you@example.com', 'support@example.com',
  ARRAY['category'],
  '{"card-buttons": {...}}',  -- mirror manifest capabilities
  TRUE,                 -- visible in marketplace
  TRUE,                 -- enabled
  '<secret-api-key>',
  NOW(), NOW()
);`}</Pre>

            <H3>Step 4 — Enable on a board</H3>
            <P>
              Navigate to a board → <strong>Settings</strong> → <strong>Plugins</strong> (board
              admin only). Find your plugin in the <em>Available plugins</em> list and click{' '}
              <strong>Enable</strong>. The platform will load the connector iframe immediately.
            </P>
            <div className="rounded-lg border border-amber-700/40 bg-amber-900/10 px-4 py-3 text-sm text-amber-200">
              <strong>Access control:</strong> Only board admins can enable and disable plugins.
              The server enforces this with a <Code>boardAdminGuard</Code> middleware. A 403
              response redirects the client back to the board.
            </div>
          </Section>

          <Divider />

          {/* ── Available SDKs ─────────────────────────────── */}
          <Section id="sdks">
            <H2>
              <CubeIcon className="mr-2 inline h-5 w-5 text-indigo-400" />
              Available SDKs
            </H2>
            <Table
              headers={['SDK', 'URL', 'Protocol', 'Description']}
              rows={[
                {
                  rowId: 'jh-instance',
                  cells: [
                    { key: 'sdk', content: <Code>jhInstance</Code> },
                    { key: 'url', content: <Code>/sdk/jh-instance.js</Code> },
                    { key: 'proto', content: <Badge color="bg-indigo-900/60 text-indigo-300">postMessage</Badge> },
                    { key: 'desc', content: 'Primary plugin SDK. Trello Power-Up compatible.' },
                  ],
                },
              ]}
            />
            <P>
              Currently one SDK is provided. <Code>jhInstance</Code> is the only interface
              plugins should use to communicate with the board. Future SDKs may be added for
              OAuth flows or webhooks.
            </P>
          </Section>

          <Divider />

          {/* ── jhInstance ─────────────────────────────────── */}
          <Section id="jh-instance">
            <H2>
              <CodeBracketIcon className="mr-2 inline h-5 w-5 text-indigo-400" />
              The <Code>jhInstance</Code> SDK
            </H2>
            <P>
              The platform serves the SDK at <Code>/sdk/jh-instance.js</Code>. Load it in your{' '}
              <Code>connector.html</Code> before your own scripts. It attaches the global
              <Code> window.jhInstance</Code>.
            </P>
            <Pre>{`<!-- connector.html -->
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"></head>
  <body>
    <!-- 1. Load the SDK from the platform origin -->
    <script src="https://<your-platform-domain>/sdk/jh-instance.js"></script>
    <!-- 2. Load your plugin logic -->
    <script src="/client.js"></script>
  </body>
</html>`}</Pre>
          </Section>

          {/* ── initialize ─────────────────────────────────── */}
          <Section id="initialize">
            <H3>jhInstance.initialize(capabilities, config)</H3>
            <P>
              Call this once in <Code>connector.html</Code> to register all capability handlers.
            </P>
            <Pre>{`// client.js
window.jhInstance.initialize(
  {
    'card-buttons': (t) => [
      {
        icon: '🔒',
        text: 'Escrow Pay',
        callback: (tc) => {
          tc.popup({
            title: 'Escrow Pay',
            url: '/payment.html',
          });
        },
      },
    ],

    'card-badges': (t) =>
      t.card('id', 'name').then((card) => [
        {
          title: 'Status',
          text: 'Pending',
          icon: '💰',
          color: 'yellow',
        },
      ]),

    'show-settings': (t) => ({
      title: 'My Plugin Settings',
      url: '/settings.html',
    }),
  },
  {
    appKey: '<api_key from manifest>',
    appName: 'My Plugin',
  },
);`}</Pre>
          </Section>

          {/* ── jhInstance.iframe ──────────────────────────── */}
          <Section id="initialize">
            <H3>jhInstance.iframe()</H3>
            <P>
              Used in non-connector pages (settings, modals, section pages) to get the{' '}
              <Code>t</Code> context that was passed when the host opened the page.
            </P>
            <Pre>{`// settings.html script
const t = window.jhInstance.iframe();

t.board('id', 'name').then((board) => {
  document.querySelector('#title').textContent = board.name;
});`}</Pre>
          </Section>

          <Divider />

          {/* ── Capabilities ───────────────────────────────── */}
          <Section id="capabilities">
            <H2>Capabilities</H2>
            <P>
              Capabilities are declared in <Code>manifest.json</Code> and implemented as
              handler functions passed to <Code>jhInstance.initialize</Code>. The platform
              invokes each handler at the appropriate render point.
            </P>
            <Table
              headers={['Capability', 'Invoked when', 'Return value']}
              rows={[
                {
                  rowId: 'cap-card-buttons',
                  cells: [
                    { key: 'name', content: <Code>card-buttons</Code> },
                    { key: 'when', content: 'Card front rendered' },
                    { key: 'ret', content: <Code>{`Array<{ icon, text, callback }>`}</Code> },
                  ],
                },
                {
                  rowId: 'cap-card-badges',
                  cells: [
                    { key: 'name', content: <Code>card-badges</Code> },
                    { key: 'when', content: 'Card front rendered' },
                    { key: 'ret', content: <Code>{`Array<{ title, text, icon, color }>`}</Code> },
                  ],
                },
                {
                  rowId: 'cap-card-detail-badges',
                  cells: [
                    { key: 'name', content: <Code>card-detail-badges</Code> },
                    { key: 'when', content: 'Card back opened' },
                    { key: 'ret', content: <Code>{`Array<{ title, text, icon, color }>`}</Code> },
                  ],
                },
                {
                  rowId: 'cap-show-settings',
                  cells: [
                    { key: 'name', content: <Code>show-settings</Code> },
                    { key: 'when', content: 'Board settings clicked' },
                    { key: 'ret', content: <Code>{`{ title, url }`}</Code> },
                  ],
                },
                {
                  rowId: 'cap-auth-status',
                  cells: [
                    { key: 'name', content: <Code>authorization-status</Code> },
                    { key: 'when', content: 'Frame init' },
                    { key: 'ret', content: <Code>{`{ authorized: boolean }`}</Code> },
                  ],
                },
                {
                  rowId: 'cap-show-auth',
                  cells: [
                    { key: 'name', content: <Code>show-authorization</Code> },
                    { key: 'when', content: 'User triggers auth' },
                    { key: 'ret', content: 'Opens authorization iframe / modal' },
                  ],
                },
                {
                  rowId: 'cap-section',
                  cells: [
                    { key: 'name', content: <Code>section</Code> },
                    { key: 'when', content: 'Card back opened' },
                    { key: 'ret', content: <Code>{`{ title, url }`}</Code> },
                  ],
                },
              ]}
            />
          </Section>

          <Divider />

          {/* ── FrameContext ────────────────────────────────── */}
          <Section id="frame-context">
            <H2>FrameContext (<Code>t</Code>)</H2>
            <P>
              Every capability handler receives a <Code>t</Code> object — an instance of{' '}
              <Code>FrameContext</Code>. It lets you read board/card data and trigger UI actions.
            </P>

            <H3>Data storage</H3>
            <Table
              headers={['Method', 'Description']}
              rows={[
                {
                  rowId: 'ds-get',
                  cells: [
                    { key: 'method', content: <Code>{`t.get(scope, visibility, key)`}</Code> },
                    { key: 'desc', content: 'Read a stored value. Scope: card | list | board | member. Visibility: private | shared.' },
                  ],
                },
                {
                  rowId: 'ds-set',
                  cells: [
                    { key: 'method', content: <Code>{`t.set(scope, visibility, key, value)`}</Code> },
                    { key: 'desc', content: 'Write a value to persistent plugin storage.' },
                  ],
                },
              ]}
            />
            <Pre>{`// Read a value stored for the current card
const price = await t.get('card', 'shared', 'escrow_amount');

// Write a value
await t.set('card', 'shared', 'escrow_amount', 5000);`}</Pre>

            <H3>Context reads</H3>
            <Table
              headers={['Method', 'Fields available']}
              rows={[
                {
                  rowId: 'ctx-card',
                  cells: [
                    { key: 'method', content: <Code>{`t.card(...fields)`}</Code> },
                    { key: 'fields', content: 'id, name, desc, amount, currency, dueDate, labels, members, …' },
                  ],
                },
                {
                  rowId: 'ctx-list',
                  cells: [
                    { key: 'method', content: <Code>{`t.list(...fields)`}</Code> },
                    { key: 'fields', content: 'id, name, pos' },
                  ],
                },
                {
                  rowId: 'ctx-board',
                  cells: [
                    { key: 'method', content: <Code>{`t.board(...fields)`}</Code> },
                    { key: 'fields', content: 'id, name, members' },
                  ],
                },
                {
                  rowId: 'ctx-member',
                  cells: [
                    { key: 'method', content: <Code>{`t.member(...fields)`}</Code> },
                    { key: 'fields', content: 'id, name, email' },
                  ],
                },
              ]}
            />
            <Pre>{`const card = await t.card('id', 'name', 'amount', 'currency');
// card.amount is in major currency units (e.g. 150.00 for $150)
// card.currency is a lowercase ISO code (e.g. 'usd')
console.log(card.name, card.amount, card.currency); // "Fix login bug" 150 "usd"`}</Pre>
          </Section>

          <Divider />

          {/* ── UI actions ─────────────────────────────────── */}
          <Section id="ui-actions">
            <H2>UI actions</H2>
            <Table
              headers={['Method', 'Description']}
              rows={[
                {
                  rowId: 'ui-popup',
                  cells: [
                    { key: 'method', content: <Code>{`t.popup({ title, url, args? })`}</Code> },
                    { key: 'desc', content: 'Open a small popup window loaded with the given URL.' },
                  ],
                },
                {
                  rowId: 'ui-modal',
                  cells: [
                    { key: 'method', content: <Code>{`t.modal({ url, title?, fullscreen?, accentColor? })`}</Code> },
                    { key: 'desc', content: 'Open a full-screen (or standard) modal.' },
                  ],
                },
                {
                  rowId: 'ui-close-popup',
                  cells: [
                    { key: 'method', content: <Code>{`t.closePopup()`}</Code> },
                    { key: 'desc', content: 'Close the currently open popup from within the popup page.' },
                  ],
                },
                {
                  rowId: 'ui-close-modal',
                  cells: [
                    { key: 'method', content: <Code>{`t.closeModal()`}</Code> },
                    { key: 'desc', content: 'Close the currently open modal from within the modal page.' },
                  ],
                },
                {
                  rowId: 'ui-size-to',
                  cells: [
                    { key: 'method', content: <Code>{`t.sizeTo(element)`}</Code> },
                    { key: 'desc', content: 'Resize the popup/modal to fit an element (pass DOM element or selector).' },
                  ],
                },
              ]}
            />
            <Pre>{`// Open a payment popup when a card button is clicked
'card-buttons': (t) => [{
  icon: '💳',
  text: 'Pay',
  callback: (tc) => {
    tc.popup({
      title: 'Make Payment',
      url: '/payment.html',
      args: { amount: 1000 },
    });
  },
}]`}</Pre>
          </Section>

          <Divider />

          {/* ── REST API client ────────────────────────────── */}
          <Section id="rest-api">
            <H2>REST API client</H2>
            <P>
              Accessed via <Code>t.getRestApi()</Code>. Provides a thin wrapper for
              authorization flows and authenticated requests to the platform API.
            </P>
            <Table
              headers={['Method', 'Description']}
              rows={[
                {
                  rowId: 'api-is-authorized',
                  cells: [
                    { key: 'method', content: <Code>api.isAuthorized()</Code> },
                    { key: 'desc', content: 'Returns true if the current user has authorized this plugin.' },
                  ],
                },
                {
                  rowId: 'api-authorize',
                  cells: [
                    { key: 'method', content: <Code>{`api.authorize({ scope? })`}</Code> },
                    { key: 'desc', content: 'Trigger the authorization flow (opens show-authorization capability).' },
                  ],
                },
                {
                  rowId: 'api-get-token',
                  cells: [
                    { key: 'method', content: <Code>api.getToken()</Code> },
                    { key: 'desc', content: 'Get the stored access token for the current user (null if not authorized).' },
                  ],
                },
                {
                  rowId: 'api-request',
                  cells: [
                    { key: 'method', content: <Code>{`api.request(path, options?)`}</Code> },
                    { key: 'desc', content: 'Make an authenticated HTTP request to the platform API.' },
                  ],
                },
              ]}
            />
            <Pre>{`const api = t.getRestApi();

const authorized = await api.isAuthorized();
if (!authorized) {
  await api.authorize();
}

const token = await api.getToken();
const res = await api.request('/api/v1/some-endpoint');`}</Pre>
          </Section>

          <Divider />

          {/* ── Plugin pages ───────────────────────────────── */}
          <Section id="pages">
            <H2>Plugin pages</H2>
            <P>
              In addition to <Code>connector.html</Code>, a plugin can ship extra HTML pages
              that the SDK opens in popups or modals.
            </P>
            <Table
              headers={['File', 'Required', 'Purpose']}
              rows={[
                {
                  rowId: 'page-connector',
                  cells: [
                    { key: 'file', content: <Code>connector.html</Code> },
                    { key: 'req', content: <Badge color="bg-red-900/50 text-red-300">Required</Badge> },
                    { key: 'purpose', content: 'Hidden iframe. Registers all capabilities via jhInstance.initialize.' },
                  ],
                },
                {
                  rowId: 'page-settings',
                  cells: [
                    { key: 'file', content: <Code>settings.html</Code> },
                    { key: 'req', content: <Badge color="bg-slate-700 text-slate-300">Optional</Badge> },
                    { key: 'purpose', content: 'Board-level settings UI loaded by show-settings capability.' },
                  ],
                },
                {
                  rowId: 'page-modal',
                  cells: [
                    { key: 'file', content: <Code>modal.html</Code> },
                    { key: 'req', content: <Badge color="bg-slate-700 text-slate-300">Optional</Badge> },
                    { key: 'purpose', content: 'Generic fullscreen modal for complex flows.' },
                  ],
                },
                {
                  rowId: 'page-section',
                  cells: [
                    { key: 'file', content: <Code>section.html</Code> },
                    { key: 'req', content: <Badge color="bg-slate-700 text-slate-300">Optional</Badge> },
                    { key: 'purpose', content: 'Custom section rendered on the card back (section capability).' },
                  ],
                },
                {
                  rowId: 'page-authorize',
                  cells: [
                    { key: 'file', content: <Code>api-client-authorize.html</Code> },
                    { key: 'req', content: <Badge color="bg-slate-700 text-slate-300">Optional</Badge> },
                    { key: 'purpose', content: 'Embedded Stripe Checkout page. Reads card amount/currency via t.card(), creates a checkout session, and mounts the Stripe embedded checkout UI.' },
                  ],
                },
                {
                  rowId: 'page-payment-success',
                  cells: [
                    { key: 'file', content: <Code>payment-success.html</Code> },
                    { key: 'req', content: <Badge color="bg-slate-700 text-slate-300">Optional</Badge> },
                    { key: 'purpose', content: 'Stripe return_url page. Verifies the checkout session, writes paymentStatus via t.set(), then calls t.closeModal().' },
                  ],
                },
              ]}
            />
            <P>
              Every non-connector page should call <Code>const t = window.jhInstance.iframe()</Code>{' '}
              at startup to receive the context args passed by the host.
            </P>
            <P>
              <strong>Stripe redirect pages</strong> (e.g. <Code>payment-success.html</Code>) are
              opened directly by Stripe as a <Code>return_url</Code> — not via the plugin bridge —
              so no postMessage args are delivered. Construct <Code>FrameContext</Code> manually
              using the card ID baked into the return URL at session-creation time:
            </P>
            <Pre>{`// payment-success.html — Stripe lands here after checkout
const params = new URLSearchParams(window.location.search);

// Host bakes cardId as ?card={"id":"<cardId>"} in the Stripe return_url.
// Fallback: legacy ?cardId=<cardId> flat string.
let cardId = null;
const cardParam = params.get('card');
if (cardParam) {
  try { cardId = JSON.parse(cardParam)?.id ?? null; } catch {}
}
if (!cardId) cardId = params.get('cardId') ?? null;

const t = cardId
  ? new window.jhInstance.FrameContext({ card: { id: cardId } })
  : window.jhInstance.iframe();

// t.set() / t.closeModal() now resolve against the correct card
await t.set('card', 'private', 'paymentStatus', 'success');
setTimeout(() => t.closeModal(), 5000);`}</Pre>
          </Section>

          <Divider />

          {/* ── Trello compat ──────────────────────────────── */}
          <Section id="trello-compat">
            <H2>Trello Power-Up compatibility</H2>
            <P>
              The <Code>jhInstance</Code> API surface is intentionally compatible with the
              Trello Power-Up <Code>TrelloPowerUp</Code> global. Existing Power-Up{' '}
              <Code>client.js</Code> files can be alias-imported with a one-liner:
            </P>
            <Pre>{`// At the top of your existing Trello client.js
window.TrelloPowerUp = window.jhInstance;

// All existing TrelloPowerUp.initialize(...) calls now work unchanged`}</Pre>
            <div className="mt-2 rounded-lg border border-amber-700/40 bg-amber-900/10 px-4 py-3 text-sm text-amber-200">
              Not all Trello Power-Up features are supported. Hooks and UI injection points map
              to our capability names. Test each capability after migration.
            </div>
          </Section>

          <Divider />

          {/* ── Full example ───────────────────────────────── */}
          <Section id="example">
            <H2>Full minimal example</H2>
            <H3>connector.html</H3>
            <Pre>{`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"></head>
  <body>
    <script src="https://<platform-domain>/sdk/jh-instance.js"></script>
    <script src="/client.js"></script>
  </body>
</html>`}</Pre>
            <H3>client.js</H3>
            <Pre>{`window.jhInstance.initialize(
  {
    // Add a button to every card
    'card-buttons': (t) => [
      {
        icon: '⭐',
        text: 'Star card',
        callback: async (tc) => {
          const card = await tc.card('id');
          await tc.set('card', 'shared', 'starred', true);
          tc.closePopup();
        },
      },
    ],

    // Show a badge when a card is starred
    'card-badges': async (t) => {
      const starred = await t.get('card', 'shared', 'starred');
      if (!starred) return [];
      return [{ title: 'Starred', icon: '⭐', color: 'yellow' }];
    },
  },
  { appKey: 'my-api-key', appName: 'Star Plugin' },
);`}</Pre>
            <H3>manifest.json</H3>
            <Pre>{`{
  "name": "Star Plugin",
  "key": "my-api-key",
  "description": "Star important cards.",
  "iconUrl": "https://example.com/star.png",
  "url": "https://example.com/connector.html",
  "capabilities": {
    "card-buttons": { "name": "Card Buttons", "description": "Star button" },
    "card-badges":  { "name": "Card Badges",  "description": "Star badge"  }
  }
}`}</Pre>
          </Section>

          <div className="pb-12" />
        </div>
      </main>
    </div>
  );
};

export default PluginDocsPage;
