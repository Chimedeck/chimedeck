// ApiDocsPage — in-app interactive Swagger page with tabbed specs.
// Route: /developer/api-docs (private, within AppShell)
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

declare global {
  interface Window {
    SwaggerUIBundle?: (config: Record<string, unknown>) => unknown;
  }
}

const SWAGGER_CSS_ID = 'swagger-ui-dist-css';
const SWAGGER_JS_ID = 'swagger-ui-dist-js';

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

    if (window.SwaggerUIBundle) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(SWAGGER_JS_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Swagger UI script.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SWAGGER_JS_ID;
    script.src = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Swagger UI script.'));
    document.body.appendChild(script);
  });
}

const ApiDocsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'native' | 'trello'>('native');
  const [loadError, setLoadError] = useState<string | null>(null);

  const nativeSpecUrl = useMemo(() => '/api-docs/native-openapi.yaml', []);
  const trelloSpecUrl = useMemo(() => '/api-docs/trello-openapi.yaml', []);

  const activeSpecUrl = activeTab === 'native' ? nativeSpecUrl : trelloSpecUrl;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await ensureSwaggerAssets();
        if (cancelled) return;

        if (!window.SwaggerUIBundle) {
          setLoadError('Swagger UI did not initialize correctly.');
          return;
        }

        setLoadError(null);
        window.SwaggerUIBundle({
          url: activeSpecUrl,
          dom_id: '#swagger-ui-root',
          deepLinking: true,
          persistAuthorization: true,
          tryItOutEnabled: true,
          displayRequestDuration: true,
          docExpansion: 'list',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load Swagger UI.';
        setLoadError(message);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [activeSpecUrl]);

  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-base">
      <div className="border-b border-border bg-bg-base px-8 py-5">
        <button
          onClick={() => navigate(-1)}
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
      </div>

      <div className="px-8 pt-4">
        <div className="inline-flex rounded-lg border border-border bg-bg-surface p-1">
          <button
            type="button"
            onClick={() => setActiveTab('native')}
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
            onClick={() => setActiveTab('trello')}
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
  );
};

export default ApiDocsPage;
