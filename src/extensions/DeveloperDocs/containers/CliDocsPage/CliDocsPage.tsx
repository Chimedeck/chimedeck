// CliDocsPage — developer reference for the ChimeDeck CLI.
// Route: /developer/cli (private, within AppShell)
import { useNavigate } from 'react-router-dom';
import { CommandLineIcon } from '@heroicons/react/24/outline';
import Button from '~/common/components/Button';
import {
  Section,
  H2,
  H3,
  P,
  Code,
  Pre,
  Divider,
  InfoCallout,
  Table,
  NavItem,
} from '~/extensions/DeveloperDocs/components/DocsPrimitives';

const CliDocsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-bg-base text-base">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-bg-base xl:block">
        <div className="sticky top-0 overflow-y-auto py-8 px-3">
          <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted">
            On this page
          </p>
          <nav className="space-y-0.5">
            <NavItem href="#overview" label="Overview" />
            <NavItem href="#authentication" label="Authentication" />
            <NavItem href="#global-options" label="Global Options" />
            <NavItem href="#commands" label="Commands" />
            <NavItem href="#state-transitions" label="State Transition Commands" />
            <NavItem href="#examples" label="Examples" />
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="border-b border-border bg-bg-base px-8 py-5">
          <Button
            variant="link"
            size="sm"
            onClick={() => { navigate(-1); }}
            className="mb-2"
          >
            ← Back
          </Button>
          <div className="flex items-center gap-3">
            <CommandLineIcon className="h-7 w-7 text-indigo-400" />
            <div>
              <h1 className="text-2xl font-bold text-base">CLI Developer Guide</h1>
              <p className="text-sm text-muted">
                Use the <Code>chimedeck</Code> command-line interface for API-backed workflows.
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-8 py-10 space-y-2">
          <Section id="overview">
            <InfoCallout className="mb-6">
              The CLI is a thin wrapper around ChimeDeck REST endpoints. It supports human-friendly output by default and raw JSON via <Code>--json</Code> for scripting.
            </InfoCallout>
            <P>
              Run commands as <Code>chimedeck [global options] &lt;command&gt; [command options]</Code>.
            </P>
          </Section>

          <Divider />

          <Section id="authentication">
            <H2>Authentication</H2>
            <P>
              All CLI commands require an API token. The CLI reads it from <Code>CHIMEDECK_TOKEN</Code> or from a per-command <Code>--token</Code> flag.
            </P>
            <Pre>{`export CHIMEDECK_TOKEN=hf_your_token_here
export CHIMEDECK_API_URL=http://localhost:3000`}</Pre>
          </Section>

          <Divider />

          <Section id="global-options">
            <H2>Global Options</H2>
            <Table
              headers={['Flag', 'Description']}
              rows={[
                { rowId: 'go-token', cells: [{ key: 'flag', content: <Code>--token &lt;value&gt;</Code> }, { key: 'desc', content: 'API token (overrides CHIMEDECK_TOKEN)' }] },
                { rowId: 'go-api', cells: [{ key: 'flag', content: <Code>--api-url &lt;value&gt;</Code> }, { key: 'desc', content: 'API base URL (overrides CHIMEDECK_API_URL)' }] },
                { rowId: 'go-json', cells: [{ key: 'flag', content: <Code>--json</Code> }, { key: 'desc', content: 'Output raw JSON' }] },
                { rowId: 'go-help', cells: [{ key: 'flag', content: <Code>--help</Code> }, { key: 'desc', content: 'Show usage' }] },
                { rowId: 'go-version', cells: [{ key: 'flag', content: <Code>--version</Code> }, { key: 'desc', content: 'Print CLI version' }] },
              ]}
            />
          </Section>

          <Divider />

          <Section id="commands">
            <H2>Commands</H2>
            <Table
              headers={['Command', 'Purpose']}
              rows={[
                { rowId: 'cmd-move', cells: [{ key: 'name', content: <Code>move-card</Code> }, { key: 'purpose', content: 'Move a card to another list' }] },
                { rowId: 'cmd-comment', cells: [{ key: 'name', content: <Code>comment</Code> }, { key: 'purpose', content: 'Add a comment to a card' }] },
                { rowId: 'cmd-create', cells: [{ key: 'name', content: <Code>create-card</Code> }, { key: 'purpose', content: 'Create a card in a list' }] },
                { rowId: 'cmd-edit', cells: [{ key: 'name', content: <Code>edit-description</Code> }, { key: 'purpose', content: 'Update card description' }] },
                { rowId: 'cmd-price', cells: [{ key: 'name', content: <Code>set-price</Code> }, { key: 'purpose', content: 'Set/clear card price' }] },
                { rowId: 'cmd-invite', cells: [{ key: 'name', content: <Code>invite</Code> }, { key: 'purpose', content: 'Invite a member to a board' }] },
                { rowId: 'cmd-search-cards', cells: [{ key: 'name', content: <Code>search-cards</Code> }, { key: 'purpose', content: 'Search workspace cards' }] },
                { rowId: 'cmd-search-board', cells: [{ key: 'name', content: <Code>search-board</Code> }, { key: 'purpose', content: 'Search within a board' }] },
                { rowId: 'cmd-get-card', cells: [{ key: 'name', content: <Code>get-card</Code> }, { key: 'purpose', content: 'Get full card details' }] },
                { rowId: 'cmd-get-state', cells: [{ key: 'name', content: <Code>get-state-transitions</Code> }, { key: 'purpose', content: 'Get state transition graph and enabled status' }] },
                { rowId: 'cmd-set-state', cells: [{ key: 'name', content: <Code>set-state-transitions</Code> }, { key: 'purpose', content: 'Set state transition graph and/or enabled flag' }] },
                { rowId: 'cmd-rules', cells: [{ key: 'name', content: <Code>get-state-transition-rules</Code> }, { key: 'purpose', content: 'Get enforceable transition rules' }] },
                { rowId: 'cmd-copy-state', cells: [{ key: 'name', content: <Code>copy-state-transitions</Code> }, { key: 'purpose', content: 'Copy transitions from one board to another' }] },
              ]}
            />
          </Section>

          <Divider />

          <Section id="state-transitions">
            <H2>State Transition Commands</H2>

            <H3>get-state-transitions</H3>
            <Pre>{`chimedeck get-state-transitions --board <boardId>`}</Pre>

            <H3>set-state-transitions</H3>
            <Pre>{`chimedeck set-state-transitions --board <boardId> --enabled true
chimedeck set-state-transitions --board <boardId> --graph-file ./state-graph.json
chimedeck set-state-transitions --board <boardId> --graph-json '{"nodes":[],"edges":[],"notes":[]}'`}</Pre>
            <P>
              For <Code>set-state-transitions</Code>, provide at least one of <Code>--enabled</Code>, <Code>--graph-json</Code>, or <Code>--graph-file</Code>.
            </P>

            <H3>get-state-transition-rules</H3>
            <Pre>{`chimedeck get-state-transition-rules --board <boardId>`}</Pre>

            <H3>copy-state-transitions</H3>
            <Pre>{`chimedeck copy-state-transitions --board <sourceBoardId> --target-board <targetBoardId> --copy-enabled true`}</Pre>
          </Section>

          <Divider />

          <Section id="examples">
            <H2>Examples</H2>
            <Pre>{`# Save rules payload for automation
chimedeck get-state-transition-rules --board board_123 --json > rules.json

# Copy transitions then verify target
chimedeck copy-state-transitions --board board_source --target-board board_target
chimedeck get-state-transitions --board board_target --json | jq '.data.enabled'`}</Pre>
          </Section>
        </div>
      </main>
    </div>
  );
};

export default CliDocsPage;
