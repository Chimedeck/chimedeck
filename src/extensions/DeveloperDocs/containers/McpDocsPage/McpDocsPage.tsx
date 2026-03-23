// McpDocsPage — developer reference for the Horiflow MCP server.
// Route: /developer/mcp (private, within AppShell)
import { useNavigate } from 'react-router-dom';
import {
  CommandLineIcon,
  ChevronRightIcon,
  KeyIcon,
  BoltIcon,
  ServerStackIcon,
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

const McpDocsPage = () => {
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
            <NavItem href="#authentication" label="Authentication" />
            <NavItem href="#connecting" label="Connecting" />
            <NavItem href="#endpoint-reference" label="Endpoint Reference" />
            <NavItem href="#available-tools" label="Available Tools" />
            <NavItem href="#tool-details" label="Tool Details" />
            <NavItem href="#tool-move-card" label="move_card" />
            <NavItem href="#tool-write-comment" label="write_comment" />
            <NavItem href="#tool-create-card" label="create_card" />
            <NavItem href="#tool-edit-card-description" label="edit_card_description" />
            <NavItem href="#tool-set-card-price" label="set_card_price" />
            <NavItem href="#tool-invite-to-board" label="invite_to_board" />
            <NavItem href="#tool-search-cards" label="search_cards" />
            <NavItem href="#tool-search-board" label="search_board" />
            <NavItem href="#tool-get-card" label="get_card" />
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
            <CommandLineIcon className="h-7 w-7 text-indigo-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">MCP Server Developer Guide</h1>
              <p className="text-sm text-slate-400">
                Connect AI assistants to Horiflow using the{' '}
                <Code>Model Context Protocol</Code> (MCP).
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-8 py-10 space-y-2">

          {/* ── Overview ───────────────────────────────────── */}
          <Section id="overview">
            <div className="mb-6 rounded-lg border border-indigo-700/40 bg-indigo-900/20 px-5 py-4">
              <p className="text-sm text-indigo-200">
                The Horiflow MCP server lets AI assistants — Claude, Cursor, and any
                MCP-compatible client — take actions inside Horiflow on your behalf. It bridges
                MCP tool calls to Horiflow's REST API using your personal API token.
              </p>
            </div>
            <P>
              The server supports two transport modes:
            </P>
            <ol className="mb-4 space-y-2 text-sm text-slate-300">
              {[
                '<strong>stdio</strong> — a local Bun subprocess that communicates over stdin/stdout. Best for Claude Desktop and Cursor.',
                '<strong>Remote HTTP</strong> — a persistent HTTP endpoint (<code class="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-indigo-300">/api/mcp</code>) served on the same port as Horiflow. Best for remote agents, CI, and web-based AI assistants.',
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

          {/* ── Authentication ─────────────────────────────── */}
          <Section id="authentication">
            <H2>
              <KeyIcon className="mr-2 inline h-5 w-5 text-indigo-400" />
              Authentication
            </H2>
            <P>
              All MCP access requires a personal API token. Tokens are prefixed with{' '}
              <Code>hf_</Code> and are generated in User Settings.
            </P>

            <H3>Generate a token</H3>
            <ol className="mb-4 space-y-2 text-sm text-slate-300">
              {[
                'Open Horiflow in your browser and sign in.',
                'Go to <strong>User Settings → API Tokens</strong>.',
                'Click <strong>Generate new token</strong> and copy the value.',
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
            <div className="rounded-lg border border-amber-700/40 bg-amber-900/10 px-4 py-3 text-sm text-amber-200">
              <strong>Keep your token secret.</strong> Treat it like a password. Anyone who has
              it can perform any action on your behalf.
            </div>

            <H3>Using the token</H3>
            <Table
              headers={['Transport', 'How to supply the token']}
              rows={[
                {
                  rowId: 'auth-stdio',
                  cells: [
                    { key: 'transport', content: <Badge color="bg-slate-700 text-slate-200">stdio</Badge> },
                    { key: 'how', content: <><Code>HORIFLOW_TOKEN</Code> environment variable</> },
                  ],
                },
                {
                  rowId: 'auth-http',
                  cells: [
                    { key: 'transport', content: <Badge color="bg-indigo-900/60 text-indigo-300">HTTP</Badge> },
                    { key: 'how', content: <><Code>Authorization: Bearer hf_your_token_here</Code> request header</> },
                  ],
                },
              ]}
            />
          </Section>

          <Divider />

          {/* ── Connecting ─────────────────────────────────── */}
          <Section id="connecting">
            <H2>
              <BoltIcon className="mr-2 inline h-5 w-5 text-indigo-400" />
              Connecting
            </H2>

            <H3>Claude Desktop</H3>
            <P>
              Edit <Code>~/.claude/claude_desktop_config.json</Code> (create it if it does not
              exist) and add the <Code>horiflow</Code> entry under <Code>mcpServers</Code>:
            </P>
            <Pre>{`{
  "mcpServers": {
    "horiflow": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/server/extensions/mcp/index.ts"],
      "env": {
        "HORIFLOW_TOKEN": "hf_your_token_here",
        "HORIFLOW_API_URL": "http://localhost:3000"
      }
    }
  }
}`}</Pre>
            <P>
              Replace <Code>/absolute/path/to</Code> with the actual path to this repository.
              Restart Claude Desktop to pick up the change.
            </P>

            <H3>Cursor</H3>
            <P>
              Create or edit <Code>.cursor/mcp.json</Code> in your home directory (or at the
              project root for project-scoped config):
            </P>
            <Pre>{`{
  "mcpServers": {
    "horiflow": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/server/extensions/mcp/index.ts"],
      "env": {
        "HORIFLOW_TOKEN": "hf_your_token_here",
        "HORIFLOW_API_URL": "http://localhost:3000"
      }
    }
  }
}`}</Pre>
            <P>Reload Cursor after saving the file.</P>

            <H3>Environment variables</H3>
            <Table
              headers={['Variable', 'Required', 'Default', 'Description']}
              rows={[
                {
                  rowId: 'env-token',
                  cells: [
                    { key: 'var', content: <Code>HORIFLOW_TOKEN</Code> },
                    { key: 'req', content: <Badge color="bg-green-900/60 text-green-300">Yes</Badge> },
                    { key: 'def', content: '—' },
                    { key: 'desc', content: 'API token generated in User Settings' },
                  ],
                },
                {
                  rowId: 'env-url',
                  cells: [
                    { key: 'var', content: <Code>HORIFLOW_API_URL</Code> },
                    { key: 'req', content: <Badge color="bg-slate-700 text-slate-300">No</Badge> },
                    { key: 'def', content: <Code>http://localhost:3000</Code> },
                    { key: 'desc', content: 'Base URL of the Horiflow API' },
                  ],
                },
              ]}
            />
          </Section>

          <Divider />

          {/* ── Endpoint Reference ─────────────────────────── */}
          <Section id="endpoint-reference">
            <H2>
              <ServerStackIcon className="mr-2 inline h-5 w-5 text-indigo-400" />
              Endpoint Reference (Remote HTTP)
            </H2>
            <P>
              The HTTP MCP endpoint is served at <Code>/api/mcp</Code> on the same port as
              Horiflow (default <Code>3000</Code>). No additional ports or env vars are required.
            </P>

            <H3>Session lifecycle</H3>
            <ol className="mb-4 space-y-2 text-sm text-slate-300">
              {[
                '<strong>Initialize</strong> — <code class="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-indigo-300">POST /api/mcp</code> (no <code class="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-indigo-300">mcp-session-id</code> header) creates a new isolated session. The response returns an <code class="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-indigo-300">mcp-session-id</code> header.',
                '<strong>Interact</strong> — subsequent <code class="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-indigo-300">POST</code> requests (tool calls / notifications) or <code class="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-indigo-300">GET</code> requests (SSE stream) must include the <code class="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-indigo-300">mcp-session-id</code> header.',
                '<strong>Terminate</strong> — <code class="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-indigo-300">DELETE /api/mcp</code> with the session ID tears down the session immediately.',
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
            <P>Sessions expire automatically after <strong>30 minutes</strong> of inactivity.</P>

            <H3>curl examples</H3>
            <P>1. Initialize a session:</P>
            <Pre>{`curl -i -X POST http://localhost:3000/api/mcp \\
  -H "Authorization: Bearer hf_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "my-agent", "version": "1.0.0" }
    }
  }'

# Response headers will include:
# mcp-session-id: <uuid>`}</Pre>

            <P>2. Call a tool:</P>
            <Pre>{`SESSION_ID="<uuid-from-step-1>"

curl -X POST http://localhost:3000/api/mcp \\
  -H "Authorization: Bearer hf_your_token_here" \\
  -H "Content-Type: application/json" \\
  -H "mcp-session-id: $SESSION_ID" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "write_comment",
      "arguments": { "cardId": "123", "text": "Done!" }
    }
  }'`}</Pre>

            <P>3. Open an SSE stream:</P>
            <Pre>{`curl -N -X GET http://localhost:3000/api/mcp \\
  -H "Authorization: Bearer hf_your_token_here" \\
  -H "mcp-session-id: $SESSION_ID"`}</Pre>

            <P>4. Terminate a session:</P>
            <Pre>{`curl -X DELETE http://localhost:3000/api/mcp \\
  -H "Authorization: Bearer hf_your_token_here" \\
  -H "mcp-session-id: $SESSION_ID"
# Returns 204 No Content`}</Pre>

            <H3>Error responses</H3>
            <Table
              headers={['Status', 'name', 'Meaning']}
              rows={[
                {
                  rowId: 'err-400',
                  cells: [
                    { key: 'status', content: <Badge color="bg-amber-900/60 text-amber-300">400</Badge> },
                    { key: 'name', content: <Code>bad-request</Code> },
                    { key: 'meaning', content: 'mcp-session-id header missing on a non-initialize request' },
                  ],
                },
                {
                  rowId: 'err-401',
                  cells: [
                    { key: 'status', content: <Badge color="bg-red-900/60 text-red-300">401</Badge> },
                    { key: 'name', content: <Code>unauthorized</Code> },
                    { key: 'meaning', content: 'Token absent or invalid' },
                  ],
                },
                {
                  rowId: 'err-403',
                  cells: [
                    { key: 'status', content: <Badge color="bg-red-900/60 text-red-300">403</Badge> },
                    { key: 'name', content: <Code>forbidden</Code> },
                    { key: 'meaning', content: 'Token belongs to a different user than the session owner' },
                  ],
                },
                {
                  rowId: 'err-404',
                  cells: [
                    { key: 'status', content: <Badge color="bg-slate-700 text-slate-300">404</Badge> },
                    { key: 'name', content: <Code>session-not-found</Code> },
                    { key: 'meaning', content: 'Session expired or never existed — re-initialize' },
                  ],
                },
              ]}
            />
          </Section>

          <Divider />

          {/* ── Available Tools ────────────────────────────── */}
          <Section id="available-tools">
            <H2>Available Tools</H2>
            <P>
              Horiflow exposes 9 MCP tools. Each tool maps to a specific REST API endpoint.
            </P>
            <Table
              headers={['Tool', 'Description', 'Endpoint']}
              rows={[
                {
                  rowId: 'tool-move-card',
                  cells: [
                    { key: 'tool', content: <Code>move_card</Code> },
                    { key: 'desc', content: 'Move a card to a different list, optionally at a specific position' },
                    { key: 'endpoint', content: <Code>PATCH /api/v1/cards/:cardId/move</Code> },
                  ],
                },
                {
                  rowId: 'tool-write-comment',
                  cells: [
                    { key: 'tool', content: <Code>write_comment</Code> },
                    { key: 'desc', content: 'Post a comment on a card' },
                    { key: 'endpoint', content: <Code>POST /api/v1/cards/:cardId/comments</Code> },
                  ],
                },
                {
                  rowId: 'tool-create-card',
                  cells: [
                    { key: 'tool', content: <Code>create_card</Code> },
                    { key: 'desc', content: 'Create a new card in a list' },
                    { key: 'endpoint', content: <Code>POST /api/v1/lists/:listId/cards</Code> },
                  ],
                },
                {
                  rowId: 'tool-edit-card-description',
                  cells: [
                    { key: 'tool', content: <Code>edit_card_description</Code> },
                    { key: 'desc', content: 'Update the description of a card' },
                    { key: 'endpoint', content: <Code>PATCH /api/v1/cards/:cardId/description</Code> },
                  ],
                },
                {
                  rowId: 'tool-set-card-price',
                  cells: [
                    { key: 'tool', content: <Code>set_card_price</Code> },
                    { key: 'desc', content: 'Set or clear the price on a card' },
                    { key: 'endpoint', content: <Code>PATCH /api/v1/cards/:cardId/money</Code> },
                  ],
                },
                {
                  rowId: 'tool-invite-to-board',
                  cells: [
                    { key: 'tool', content: <Code>invite_to_board</Code> },
                    { key: 'desc', content: 'Invite a user to a board by email (requires board admin)' },
                    { key: 'endpoint', content: <Code>POST /api/v1/boards/:boardId/members</Code> },
                  ],
                },
                {
                  rowId: 'tool-search-cards',
                  cells: [
                    { key: 'tool', content: <Code>search_cards</Code> },
                    { key: 'desc', content: 'Full-text search over cards within a workspace' },
                    { key: 'endpoint', content: <Code>GET /api/v1/workspaces/:workspaceId/search</Code> },
                  ],
                },
                {
                  rowId: 'tool-search-board',
                  cells: [
                    { key: 'tool', content: <Code>search_board</Code> },
                    { key: 'desc', content: 'Full-text search over cards and lists scoped to a single board' },
                    { key: 'endpoint', content: <Code>GET /api/v1/boards/:boardId/search</Code> },
                  ],
                },
                {
                  rowId: 'tool-get-card',
                  cells: [
                    { key: 'tool', content: <Code>get_card</Code> },
                    { key: 'desc', content: 'Retrieve the full details of a single card by its ID' },
                    { key: 'endpoint', content: <Code>GET /api/v1/cards/:cardId</Code> },
                  ],
                },
              ]}
            />
          </Section>

          <Divider />

          {/* ── Tool Details ───────────────────────────────── */}
          <Section id="tool-details">
            <H2>Tool Details</H2>
            <P>
              Each tool accepts a JSON object of parameters. Required fields are marked with ✅.
            </P>
          </Section>

          {/* move_card */}
          <Section id="tool-move-card">
            <H3>move_card</H3>
            <P>Move a card to a different list. Optionally specify a zero-based position within the target list.</P>
            <Table
              headers={['Parameter', 'Type', 'Required', 'Description']}
              rows={[
                {
                  rowId: 'mc-cardId',
                  cells: [
                    { key: 'param', content: <Code>cardId</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'ID of the card to move' },
                  ],
                },
                {
                  rowId: 'mc-targetListId',
                  cells: [
                    { key: 'param', content: <Code>targetListId</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'ID of the destination list' },
                  ],
                },
                {
                  rowId: 'mc-position',
                  cells: [
                    { key: 'param', content: <Code>position</Code> },
                    { key: 'type', content: 'number' },
                    { key: 'req', content: 'No' },
                    { key: 'desc', content: 'Zero-based position within the target list' },
                  ],
                },
              ]}
            />
          </Section>

          {/* write_comment */}
          <Section id="tool-write-comment">
            <H3>write_comment</H3>
            <P>Post a comment on a card.</P>
            <Table
              headers={['Parameter', 'Type', 'Required', 'Description']}
              rows={[
                {
                  rowId: 'wc-cardId',
                  cells: [
                    { key: 'param', content: <Code>cardId</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'ID of the card to comment on' },
                  ],
                },
                {
                  rowId: 'wc-text',
                  cells: [
                    { key: 'param', content: <Code>text</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'Comment body text' },
                  ],
                },
              ]}
            />
          </Section>

          {/* create_card */}
          <Section id="tool-create-card">
            <H3>create_card</H3>
            <P>Create a new card in a list.</P>
            <Table
              headers={['Parameter', 'Type', 'Required', 'Description']}
              rows={[
                {
                  rowId: 'cc-listId',
                  cells: [
                    { key: 'param', content: <Code>listId</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'ID of the list to create the card in' },
                  ],
                },
                {
                  rowId: 'cc-title',
                  cells: [
                    { key: 'param', content: <Code>title</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'Title of the new card' },
                  ],
                },
                {
                  rowId: 'cc-description',
                  cells: [
                    { key: 'param', content: <Code>description</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: 'No' },
                    { key: 'desc', content: 'Optional card description' },
                  ],
                },
              ]}
            />
          </Section>

          {/* edit_card_description */}
          <Section id="tool-edit-card-description">
            <H3>edit_card_description</H3>
            <P>Update the description of an existing card.</P>
            <Table
              headers={['Parameter', 'Type', 'Required', 'Description']}
              rows={[
                {
                  rowId: 'ecd-cardId',
                  cells: [
                    { key: 'param', content: <Code>cardId</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'ID of the card to update' },
                  ],
                },
                {
                  rowId: 'ecd-description',
                  cells: [
                    { key: 'param', content: <Code>description</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'New description text' },
                  ],
                },
              ]}
            />
          </Section>

          {/* set_card_price */}
          <Section id="tool-set-card-price">
            <H3>set_card_price</H3>
            <P>Set or clear the price on a card. Pass <Code>null</Code> for <Code>amount</Code> to remove the price.</P>
            <Table
              headers={['Parameter', 'Type', 'Required', 'Description']}
              rows={[
                {
                  rowId: 'scp-cardId',
                  cells: [
                    { key: 'param', content: <Code>cardId</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'ID of the card' },
                  ],
                },
                {
                  rowId: 'scp-amount',
                  cells: [
                    { key: 'param', content: <Code>amount</Code> },
                    { key: 'type', content: 'number | null' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'Price amount, or null to clear the price' },
                  ],
                },
                {
                  rowId: 'scp-currency',
                  cells: [
                    { key: 'param', content: <Code>currency</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: 'No' },
                    { key: 'desc', content: 'ISO 4217 currency code (e.g. USD)' },
                  ],
                },
                {
                  rowId: 'scp-label',
                  cells: [
                    { key: 'param', content: <Code>label</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: 'No' },
                    { key: 'desc', content: 'Display label for the price' },
                  ],
                },
              ]}
            />
          </Section>

          {/* invite_to_board */}
          <Section id="tool-invite-to-board">
            <H3>invite_to_board</H3>
            <P>Invite a user to a board by email. Requires the token holder to be a board admin.</P>
            <div className="rounded-lg border border-amber-700/40 bg-amber-900/10 px-4 py-3 text-sm text-amber-200 mb-3">
              <strong>Access control:</strong> If the token holder is not a board admin, the
              tool returns a structured error (<Code>current-user-is-not-admin</Code>) instead
              of crashing.
            </div>
            <Table
              headers={['Parameter', 'Type', 'Required', 'Description']}
              rows={[
                {
                  rowId: 'itb-boardId',
                  cells: [
                    { key: 'param', content: <Code>boardId</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'ID of the board' },
                  ],
                },
                {
                  rowId: 'itb-email',
                  cells: [
                    { key: 'param', content: <Code>email</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'Email address of the user to invite' },
                  ],
                },
                {
                  rowId: 'itb-role',
                  cells: [
                    { key: 'param', content: <Code>role</Code> },
                    { key: 'type', content: '"member" | "observer"' },
                    { key: 'req', content: 'No' },
                    { key: 'desc', content: 'Role to assign (defaults to "member")' },
                  ],
                },
              ]}
            />
          </Section>

          {/* search_cards */}
          <Section id="tool-search-cards">
            <H3>search_cards</H3>
            <P>Full-text search over all cards within a workspace. Returns matching cards with title, list, and board context.</P>
            <Table
              headers={['Parameter', 'Type', 'Required', 'Description']}
              rows={[
                {
                  rowId: 'sc-workspaceId',
                  cells: [
                    { key: 'param', content: <Code>workspaceId</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'ID of the workspace to search within' },
                  ],
                },
                {
                  rowId: 'sc-q',
                  cells: [
                    { key: 'param', content: <Code>q</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'Full-text search query' },
                  ],
                },
                {
                  rowId: 'sc-limit',
                  cells: [
                    { key: 'param', content: <Code>limit</Code> },
                    { key: 'type', content: 'number' },
                    { key: 'req', content: 'No' },
                    { key: 'desc', content: 'Maximum number of results to return (default: 20)' },
                  ],
                },
              ]}
            />
          </Section>

          {/* search_board */}
          <Section id="tool-search-board">
            <H3>search_board</H3>
            <P>Full-text search over cards and lists scoped to a single board.</P>
            <Table
              headers={['Parameter', 'Type', 'Required', 'Description']}
              rows={[
                {
                  rowId: 'sb-boardId',
                  cells: [
                    { key: 'param', content: <Code>boardId</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'ID of the board to search within' },
                  ],
                },
                {
                  rowId: 'sb-q',
                  cells: [
                    { key: 'param', content: <Code>q</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'Full-text search query' },
                  ],
                },
                {
                  rowId: 'sb-limit',
                  cells: [
                    { key: 'param', content: <Code>limit</Code> },
                    { key: 'type', content: 'number' },
                    { key: 'req', content: 'No' },
                    { key: 'desc', content: 'Maximum number of results to return' },
                  ],
                },
              ]}
            />
          </Section>

          {/* get_card */}
          <Section id="tool-get-card">
            <H3>get_card</H3>
            <P>Retrieve the full details of a single card by its ID, including title, description, list, price, labels, and members.</P>
            <Table
              headers={['Parameter', 'Type', 'Required', 'Description']}
              rows={[
                {
                  rowId: 'gc-cardId',
                  cells: [
                    { key: 'param', content: <Code>cardId</Code> },
                    { key: 'type', content: 'string' },
                    { key: 'req', content: '✅' },
                    { key: 'desc', content: 'ID of the card to retrieve' },
                  ],
                },
              ]}
            />
          </Section>

        </div>
      </main>
    </div>
  );
};

export default McpDocsPage;
