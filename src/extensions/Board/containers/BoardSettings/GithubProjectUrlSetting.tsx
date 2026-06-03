// GithubProjectUrlSetting — inline GitHub Project URL field with validation and save flow.
// Uses optimistic UI: updates state immediately, rolls back on API failure.
import { useState, useEffect } from 'react';
import { LinkIcon } from '@heroicons/react/24/outline';
import { apiClient } from '~/common/api/client';
import {
  getBoardIntegrations,
  patchBoardIntegrations,
  type BoardIntegrations,
} from '../../api';
import translations from '../../translations/en.json';

interface Props {
  boardId: string;
  /** true when the user cannot edit this setting (e.g., guest or non-admin). */
  disabled?: boolean;
}

const GITHUB_PROJECT_URL_REGEX = /^https:\/\/github\.com\/(?:orgs|users)\/[a-zA-Z0-9-]+\/projects\/\d+\/?$/;

const validateGithubProjectUrl = (url: string): boolean => {
  if (!url) return true; // Allow empty (clearing the setting)
  return GITHUB_PROJECT_URL_REGEX.test(url);
};

const normalizeUrl = (url: string): string => {
  if (!url) return '';
  // Remove trailing slash if present
  return url.replace(/\/$/, '');
};

const GithubProjectUrlSetting = ({ boardId, disabled = false }: Props) => {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
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

  const handleChange = (nextUrl: string) => {
    setUrl(nextUrl);
    setIsValidationError(false);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (url && !validateGithubProjectUrl(url)) {
      setIsValidationError(true);
    }
  };

  const handleSave = async () => {
    if (!boardId || disabled) return;

    const trimmed = url.trim();
    if (trimmed && !validateGithubProjectUrl(trimmed)) {
      setIsValidationError(true);
      return;
    }

    setSaving(true);
    setError(null);
    const normalized = normalizeUrl(trimmed);
    const prevUrl = url;

    try {
      await patchBoardIntegrations({
        api: apiClient as { patch: <T>(url: string, data: unknown) => Promise<T> },
        boardId,
        settings: {
          github_project_url: normalized || null,
        },
      });
      setUrl(normalized);
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
        <p className="text-xs text-muted">{translations['BoardSettings.githubProjectUrlHelper']}</p>
      )}

      {/* Input */}
      <div className="relative">
        <input
          type="url"
          placeholder={translations['BoardSettings.githubProjectUrlPlaceholder']}
          value={url}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            setIsValidationError(false);
          }}
          onBlur={handleBlur}
          disabled={disabled || saving || loading}
          className={`w-full px-3 py-2 rounded border text-sm transition-colors ${
            disabled || saving ? 'bg-bg-overlay cursor-not-allowed opacity-50 border-border' : 'bg-bg-base border-border hover:border-subtle focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 focus:border-indigo-500'
          } ${isValidationError ? 'border-danger text-danger' : 'text-base'}`}
          aria-label={translations['BoardSettings.githubProjectUrlLabel']}
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
          onClick={handleSave}
          disabled={Boolean(saving || loading || !url || (url && !isFocused && !isValidationError))}
          className="mt-2 px-3 py-1.5 rounded text-xs font-medium bg-primary text-white hover:bg-primary/90 disabled:bg-bg-overlay disabled:text-muted disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      )}
    </div>
  );
};

export default GithubProjectUrlSetting;
