// ApiDocsPage — in-app interactive Swagger page with tabbed specs.
// Route: /developer/api-docs (private, within AppShell)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

declare global {
  interface Window {
    SwaggerUIBundle?: (config: Record<string, unknown>) => unknown;
  }
}

const SWAGGER_CSS_ID = 'swagger-ui-dist-css';
const SWAGGER_JS_ID = 'swagger-ui-dist-js';
type SwaggerBundle = (config: Record<string, unknown>) => unknown;

interface ApiNavOperation {
  id: string;
  method: string;
  label: string;
}

interface ApiNavGroup {
  id: string;
  title: string;
  operations: ApiNavOperation[];
}

function toDomId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getElementText(root: ParentNode, selector: string): string {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) return '';
  const text = element.textContent;
  return (text || '').trim();
}

function parseOperation(op: HTMLElement, groupTitle: string, opIndex: number): ApiNavOperation {
  const methodText = getElementText(op, '.opblock-summary-method').toUpperCase() || 'GET';
  const description = getElementText(op, '.opblock-summary-description');
  const pathText = getElementText(op, '.opblock-summary-path');
  const labelText = description || pathText || 'Operation';
  const opId = `docs-op-${toDomId(groupTitle)}-${String(opIndex)}`;
  op.id = opId;

  return { id: opId, method: methodText, label: labelText };
}

function collectNavGroups(root: HTMLElement): ApiNavGroup[] {
  const sections = Array.from(root.querySelectorAll<HTMLElement>('.opblock-tag-section'));

  return sections.map((section, groupIndex) => {
    const fallbackTitle = `Group ${String(groupIndex + 1)}`;
    const tagText = getElementText(section, '.opblock-tag') || fallbackTitle;
    const groupId = `docs-group-${toDomId(tagText)}-${String(groupIndex)}`;
    section.id = groupId;

    const opBlocks = Array.from(section.querySelectorAll<HTMLElement>('.opblock'));
    const operations = opBlocks.map((op, opIndex) => parseOperation(op, tagText, opIndex));

    return { id: groupId, title: tagText, operations };
  });
}

function hasOperationId(groups: ApiNavGroup[], operationId: string): boolean {
  for (const group of groups) {
    for (const operation of group.operations) {
      if (operation.id === operationId) return true;
    }
  }
  return false;
}

function getSwaggerBundle(): SwaggerBundle | undefined {
  const host = globalThis as typeof globalThis & { SwaggerUIBundle?: SwaggerBundle };
  return host.SwaggerUIBundle;
}

function hasRenderedSwaggerSections(root: HTMLElement): boolean {
  return root.querySelector('.opblock-tag-section') !== null;
}

function startSwaggerNavSync(root: HTMLElement, rebuild: () => void): () => void {
  let rafId = 0;
  const scheduleRebuild = () => {
    if (rafId !== 0) return;
    rafId = globalThis.requestAnimationFrame(() => {
      rafId = 0;
      rebuild();
    });
  };

  const observer = new MutationObserver(() => {
    scheduleRebuild();
  });

  observer.observe(root, { childList: true, subtree: true });

  const intervalId = globalThis.setInterval(() => {
    if (hasRenderedSwaggerSections(root)) {
      scheduleRebuild();
      globalThis.clearInterval(intervalId);
    }
  }, 200);

  scheduleRebuild();

  return () => {
    observer.disconnect();
    globalThis.clearInterval(intervalId);
    if (rafId !== 0) {
      globalThis.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
}

function ensureSwaggerAssets(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingCss = document.getElementById(SWAGGER_CSS_ID);
    if (!existingCss) {
      const link = document.createElement('link');
      link.id = SWAGGER_CSS_ID;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css';
      document.head.appendChild(link);
    }

    if (getSwaggerBundle()) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(SWAGGER_JS_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        resolve();
      }, { once: true });
      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load Swagger UI script.'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SWAGGER_JS_ID;
    script.src = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js';
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Swagger UI script.'));
    };
    document.body.appendChild(script);
  });
}

const ApiDocsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'native' | 'trello'>('native');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navGroups, setNavGroups] = useState<ApiNavGroup[]>([]);
  const [activeNavId, setActiveNavId] = useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const nativeSpecUrl = useMemo(() => '/api-docs/native-openapi.yaml', []);
  const trelloSpecUrl = useMemo(() => '/api-docs/trello-openapi.yaml', []);

  const activeSpecUrl = activeTab === 'native' ? nativeSpecUrl : trelloSpecUrl;

  const rebuildNavFromSwagger = useCallback(() => {
    const root = document.getElementById('swagger-ui-root');
    if (!root) {
      setNavGroups([]);
      setActiveNavId('');
      return;
    }

    const groups = collectNavGroups(root);

    setNavGroups(groups);
    setActiveNavId((prev) => {
      if (prev && hasOperationId(groups, prev)) {
        return prev;
      }
      return groups[0]?.operations[0]?.id || '';
    });
  }, []);

  const goToOperation = useCallback((operationId: string) => {
    setActiveNavId(operationId);
    const target = document.getElementById(operationId);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const summary = target.querySelector<HTMLElement>('.opblock-summary');
    if (summary && !target.classList.contains('is-open')) {
      summary.click();
    }
  }, []);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, []);

  useEffect(() => {
    setCollapsedGroups((prev) => {
      const next: Record<string, boolean> = {};
      for (const group of navGroups) {
        next[group.id] = prev[group.id] ?? false;
      }
      return next;
    });
  }, [navGroups]);

  useEffect(() => {
    let cancelled = false;
    let stopNavSync: (() => void) | undefined;

    const run = async () => {
      try {
        await ensureSwaggerAssets();
        if (cancelled) return;

        const swaggerBundle = getSwaggerBundle();
        if (!swaggerBundle) {
          setLoadError('Swagger UI did not initialize correctly.');
          return;
        }

        setLoadError(null);
        swaggerBundle({
          url: activeSpecUrl,
          dom_id: '#swagger-ui-root',
          deepLinking: true,
          persistAuthorization: true,
          tryItOutEnabled: true,
          displayRequestDuration: true,
          docExpansion: 'list',
        });

        const root = document.querySelector('#swagger-ui-root');
        if (!(root instanceof HTMLElement)) return;
        stopNavSync = startSwaggerNavSync(root, rebuildNavFromSwagger);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load Swagger UI.';
        setLoadError(message);
      }
    };

    void run();

    return () => {
      cancelled = true;
      stopNavSync?.();
    };
  }, [activeSpecUrl, rebuildNavFromSwagger]);

  return (
    <div className="flex min-h-full bg-bg-base text-base">
      <aside className="hidden w-80 shrink-0 border-r border-border bg-bg-surface lg:block">
        <div className="sticky top-0 h-[calc(100vh-3.5rem)] overflow-y-auto p-4">
          <div className="mb-4 text-sm font-semibold text-base">REST API</div>
          <div className="space-y-4">
            {navGroups.length === 0 ? (
              <p className="text-sm text-muted">Loading endpoint menu...</p>
            ) : (
              navGroups.map((group) => (
                <section key={group.id}>
                  <button
                    type="button"
                    onClick={() => {
                      toggleGroup(group.id);
                    }}
                    className="mb-2 flex w-full items-center justify-between border-t border-border pt-4 text-left text-lg font-semibold text-subtle"
                  >
                    <span>{group.title}</span>
                    {collapsedGroups[group.id] ? (
                      <ChevronDownIcon className="h-4 w-4 text-muted" aria-hidden="true" />
                    ) : (
                      <ChevronUpIcon className="h-4 w-4 text-muted" aria-hidden="true" />
                    )}
                  </button>
                  {collapsedGroups[group.id] ? null : (
                    <div className="space-y-1">
                      {group.operations.map((operation) => {
                        const isActive = activeNavId === operation.id;
                        return (
                          <button
                            key={operation.id}
                            type="button"
                            onClick={() => {
                              goToOperation(operation.id);
                            }}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                              isActive
                                ? 'bg-bg-overlay text-base'
                                : 'text-muted hover:bg-bg-overlay hover:text-base'
                            }`}
                          >
                            <span className="inline-flex min-w-11 justify-center rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-700">
                              {operation.method}
                            </span>
                            <span className="truncate">{operation.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <div className="border-b border-border bg-bg-base px-8 py-5">
          <button
            onClick={() => {
              navigate(-1);
            }}
            className="mb-2 flex items-center gap-1 text-sm text-muted hover:text-subtle"
          >
            ← Back
          </button>
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="h-7 w-7 text-indigo-400" />
            <div>
              <h1 className="text-2xl font-bold text-base">API Docs</h1>
              <p className="text-sm text-muted">
                In-app Swagger UI with Authorize + Try it out.
              </p>
            </div>
          </div>

          <div className="mt-4 inline-flex rounded-lg border border-border bg-bg-surface p-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('native');
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                activeTab === 'native'
                  ? 'bg-indigo-600 text-white'
                  : 'text-muted hover:bg-bg-overlay hover:text-base'
              }`}
            >
              Native API
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('trello');
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                activeTab === 'trello'
                  ? 'bg-indigo-600 text-white'
                  : 'text-muted hover:bg-bg-overlay hover:text-base'
              }`}
            >
              Trello Compatible Adapter API
            </button>
          </div>
        </div>

        <div className="px-8 pt-3 text-xs text-muted">
          Use Authorize with your token, then click Try it out on any endpoint.
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8 pt-3">
          <div className="rounded-lg border border-border bg-bg-surface p-2">
            {loadError ? (
              <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
                {loadError}
              </div>
            ) : null}
            <div id="swagger-ui-root" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiDocsPage;
