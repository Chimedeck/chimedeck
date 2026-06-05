// GithubProjectUrlSetting — inline GitHub URL field with validation and save flow.
// Uses optimistic UI: updates state immediately, rolls back on API failure.
//
// URL parsing/validation lives in `mods/githubProjectUrl.ts` (client-side mirror
// of `server/extensions/board/mods/githubProjectUrl.ts`) so the rules can be
// unit-tested in isolation and shared with future consumers.
import { useState, useEffect, useMemo } from 'react';
import { LinkIcon } from '@heroicons/react/24/outline';
import { apiClient } from '~/common/api/client';
import {
  getBoardIntegrations,
  patchBoardIntegrations,
} from '../../api';
import {
  parseGithubProjectUrl,
  normalizeGithubProjectUrl,
} from '../../mods/githubProjectUrl';
import translations from '../../translations/en.json';

interface Props {
  boardId: string;
  /** true when the user cannot edit this setting (e.g., guest or non-admin). */
  disabled?: boolean;
}

const GithubProjectUrlSetting = ({ boardId, disabled = false }: Props) => {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidationError, setIsValidationError] = useState(false);

  // Load initial value
  useEffect(() => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    getBoardIntegrations({
      api: apiClient as { get: <T>(url: string) => Promise<T> },
      boardId,
    })
      .then((res) => {
        setUrl(res.data.github_project_url || '');
      })
      .catch(() => {
        setError(translations['BoardSettings.githubProjectUrlLoadError']);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [boardId]);

  // [why] Re-parse on every keystroke so the parsed owner/repo is always
  // shown for visual feedback ("we understood the URL as org/repo").
  const parsed = useMemo(() => parseGithubProjectUrl(url), [url]);
  const isValid = url.trim().length === 0 || parsed !== null;

  const handleChange = (nextUrl: string) => {
    setUrl(nextUrl);
    setIsValidationError(false);
  };

  const handleBlur = () => {
    if (url.trim() && parsed === null) {
      setIsValidationError(true);
    }
  };

  const handleSave = async () => {
    if (!boardId || disabled) return;

    const trimmed = url.trim();
    const reference = parseGithubProjectUrl(trimmed);
    if (trimmed && !reference) {
      setIsValidationError(true);
      return;
    }

    // Server accepts `null` to clear the setting; for valid URLs we always
    // send the canonical form produced by the normaliser.
    const payload = reference ? normalizeGithubProjectUrl(trimmed) : null;
    const prevUrl = url;

    setSaving(true);
    setError(null);
    try {
      await patchBoardIntegrations({
        api: apiClient as { patch: <T>(url: string, data: unknown) => Promise<T> },
        boardId,
        settings: {
          github_project_url: payload,
        },
      });
      // [why] Set the input back to the canonical form (e.g. the trailing
      // `.git` is dropped) so the field stays in sync with the persisted value.
      setUrl(payload ?? '');
      setIsValidationError(false);
    } catch {
      setUrl(prevUrl);
      setError(translations['BoardSettings.githubProjectUrlSaveError']);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    if (disabled) return;
    setUrl('');
    setIsValidationError(false);
    setError(null);
    setSaving(true);
    patchBoardIntegrations({
      api: apiClient as { patch: <T>(url: string, data: unknown) => Promise<T> },
      boardId,
      settings: { github_project_url: null },
    })
      .catch(() => {
        setError(translations['BoardSettings.githubProjectUrlSaveError']);
      })
      .finally(() => {
        setSaving(false);
      });
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-subtle">
          <LinkIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>{translations['BoardSettings.githubProjectUrlLabel']}</span>
        </div>
        <div className="h-8 bg-bg-overlay rounded animate-pulse" />
      </div>
    );
  }

  // [why] Save is enabled when: not currently saving, the field has a
  // non-empty value that parses successfully, and no validation error is
  // shown.  Previously this button stayed disabled for any non-empty value
  // after blur, which made repo clone URLs impossible to save.
  // [why] The `loading` branch returns above, so by the time we render the
  // input `loading` is always `false` — it is intentionally not included here.
  const isSaveDisabled =
    saving
    || url.trim().length === 0
    || !isValid
    || isValidationError;

  return (
    <div className="space-y-2">
      {/* Label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-subtle">
          <LinkIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>{translations['BoardSettings.githubProjectUrlLabel']}</span>
        </div>
      </div>

      {/* Disabled notice for non-admins */}
      {disabled && (
        <p className="text-xs text-muted italic">{translations['BoardSettings.githubProjectUrlUnauthorized']}</p>
      )}

      {/* Helper text */}
      {!disabled && (
        <div className="space-y-1" data-testid="github-project-url-helper">
          <p className="text-xs text-muted">
            {translations['BoardSettings.githubProjectUrlHelper']}
          </p>
          <p className="text-xs text-muted">
            <span className="text-subtle">
              {translations['BoardSettings.githubProjectUrlHelperExamples']}
            </span>{' '}
            <span className="font-mono block break-all">
              {translations['BoardSettings.githubProjectUrlPlaceholder']}
            </span>
          </p>
          <p className="text-xs text-muted">
            {translations['BoardSettings.githubProjectUrlHelperExamplesHint']}
          </p>
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <input
          type="text"
          inputMode="url"
          // [why] We accept SSH clone URLs (`git@github.com:…`) in addition to
          // HTTPS, and the HTML5 `type="url"` validator rejects them.  Our own
          // parser (`parseGithubProjectUrl`) runs on every keystroke and on save.
          placeholder={translations['BoardSettings.githubProjectUrlPlaceholder']}
          value={url}
          onChange={(e) => {
            handleChange(e.target.value);
          }}
          onFocus={() => {
            setIsValidationError(false);
          }}
          onBlur={handleBlur}
          // [why] `disabled` includes `loading` defensively even though the
          // component returns the skeleton above while loading — guards
          // against future refactors that render the input during load.
          disabled={disabled || saving || loading}
          className={`w-full px-3 py-2 rounded border text-sm transition-colors ${
            disabled || saving ? 'bg-bg-overlay cursor-not-allowed opacity-50 border-border' : 'bg-bg-base border-border hover:border-subtle focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 focus:border-indigo-500'
          } ${isValidationError ? 'border-danger text-danger' : 'text-base'}`}
          aria-label={translations['BoardSettings.githubProjectUrlLabel']}
          aria-invalid={isValidationError}
        />
        {url && !disabled && !saving && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted hover:text-base transition-colors text-xs font-medium"
            aria-label="Clear URL"
          >
            Clear
          </button>
        )}
      </div>

      {/* Parsed-owner/repo chip — only when the URL is valid AND non-empty. */}
      {parsed && url.trim() && !isValidationError && (() => {
        const isProjectScope =
          parsed.scope === 'org' || parsed.scope === 'user' || parsed.scope === 'repo';
        const ownerRepo = parsed.repository
          ? `${parsed.owner}/${parsed.repository}`
          : parsed.owner;
        const label = isProjectScope
          ? `${ownerRepo} · project #${String(parsed.projectNumber)}`
          : ownerRepo;
        return (
          <p className="text-xs text-subtle" data-testid="github-project-url-parsed">
            <span className="text-muted">{translations['BoardSettings.githubProjectUrlDetectedLabel']}</span>{' '}
            <span className="font-mono" data-testid="github-project-url-parsed-value">
              {label}
            </span>
          </p>
        );
      })()}

      {/* Validation error */}
      {isValidationError && (
        <p className="text-xs text-danger">{translations['BoardSettings.githubProjectUrlInvalid']}</p>
      )}

      {/* Save error */}
      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}

      {/* Save button */}
      {!disabled && (
        <button
          type="button"
          // [why] `handleSave` is async (returns a Promise).  React's
          // `onClick` expects a void return, so we wrap to keep the
          // no-misused-promises lint rule happy.
          onClick={() => {
            void handleSave();
          }}
          disabled={isSaveDisabled}
          data-testid="github-project-url-save"
          className="mt-2 px-3 py-1.5 rounded text-xs font-medium bg-primary text-white hover:bg-primary/90 disabled:bg-bg-overlay disabled:text-muted disabled:cursor-not-allowed transition-colors"
        >
          {saving
            ? translations['BoardSettings.githubProjectUrlSavingLabel']
            : translations['BoardSettings.githubProjectUrlSaveLabel']}
        </button>
      )}
    </div>
  );
};

export default GithubProjectUrlSetting;
