// AddServiceModal — modal for adding a new health check service.
// Supports two modes:
//   preset: user picks from a pre-configured list
//   custom: user provides a name and URL manually
// State is fully reset when the modal closes or the mode switches.

import { useState, useEffect, type FormEvent } from 'react';
import translations from '../translations/en.json';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  selectHealthCheckPresets,
  selectHealthCheckPresetsStatus,
  fetchPresetsThunk,
  addHealthCheckThunk,
} from '../containers/HealthCheckTab/HealthCheckTab.duck';
import Button from '../../../common/components/Button';
import type { HealthCheckPreset } from '../api';

type Mode = 'preset' | 'custom';

interface Props {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
}

function buildInitialCustomState() {
  return { name: '', url: '', expectedStatus: '' };
}

/** AddServiceModal renders a dialog to add a preset or custom health-check service. */
export function AddServiceModal({ boardId, isOpen, onClose }: Props) {
  const dispatch = useAppDispatch();
  const presets = useAppSelector(selectHealthCheckPresets);
  const presetsStatus = useAppSelector(selectHealthCheckPresetsStatus);

  const [mode, setMode] = useState<Mode>('preset');
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('');
  const [custom, setCustom] = useState(buildInitialCustomState());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load presets once when the modal opens (if not already loaded).
  useEffect(() => {
    if (isOpen && presetsStatus === 'idle') {
      dispatch(fetchPresetsThunk());
    }
  }, [isOpen, presetsStatus, dispatch]);

  // Reset all local state when the modal opens or closes.
  useEffect(() => {
    if (!isOpen) {
      setMode('preset');
      setSelectedPresetKey('');
      setCustom(buildInitialCustomState());
      setSubmitting(false);
      setError(null);
    }
  }, [isOpen]);

  // Clear inputs and error when the user switches modes.
  function handleModeSwitch(next: Mode) {
    setMode(next);
    setSelectedPresetKey('');
    setCustom(buildInitialCustomState());
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'preset') {
      if (!selectedPresetKey) {
        setError(translations['AddServiceModal.errorSelectPreset']);
        return;
      }
      const preset = presets.find((p: HealthCheckPreset) => p.key === selectedPresetKey);
      if (!preset) {
        setError(translations['AddServiceModal.errorPresetNotFound']);
        return;
      }
      setSubmitting(true);
      try {
        await dispatch(
          addHealthCheckThunk({
            boardId,
            name: preset.name,
            url: preset.url,
            type: 'preset',
            presetKey: preset.key,
            expectedStatus: preset.expectedStatus ?? null,
          }),
        ).unwrap();
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || translations['AddServiceModal.errorAddFailed']);
      } finally {
        setSubmitting(false);
      }
    } else {
      const name = custom.name.trim();
      const url = custom.url.trim();
      if (!name) {
        setError(translations['AddServiceModal.errorNameRequired']);
        return;
      }
      if (!url) {
        setError(translations['AddServiceModal.errorUrlRequired']);
        return;
      }
      // Basic client-side scheme check; the server validates fully.
      if (!url.startsWith('https://') && !url.startsWith('http://')) {
        setError(translations['AddServiceModal.errorUrlScheme']);
        return;
      }
      // Validate optional expected status code.
      let expectedStatus: number | null = null;
      if (custom.expectedStatus.trim() !== '') {
        const code = Number.parseInt(custom.expectedStatus.trim(), 10);
        if (Number.isNaN(code) || code < 100 || code > 599) {
          setError(translations['AddServiceModal.errorExpectedStatusInvalid']);
          return;
        }
        expectedStatus = code;
      }
      setSubmitting(true);
      try {
        await dispatch(
          addHealthCheckThunk({ boardId, name, url, type: 'custom', expectedStatus }),
        ).unwrap();
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || translations['AddServiceModal.errorAddFailed']);
      } finally {
        setSubmitting(false);
      }
    }
  }

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-service-modal-title"
      onClick={(e) => {
        // Close when clicking outside the panel.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-xl bg-bg-surface border border-border shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2
            id="add-service-modal-title"
            className="text-base font-semibold text-base"
          >
            {translations['AddServiceModal.title']}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={translations['AddServiceModal.closeAriaLabel']}
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-5" role="group" aria-label="Service type">
          <button
            type="button"
            onClick={() => handleModeSwitch('preset')}
            className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
              mode === 'preset'
                ? 'bg-primary text-inverse'
                : 'bg-bg-overlay text-subtle hover:bg-bg-sunken'
            }`}
            aria-pressed={mode === 'preset'}
          >
            {translations['AddServiceModal.tabPreset']}
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('custom')}
            className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
              mode === 'custom'
                ? 'bg-primary text-inverse'
                : 'bg-bg-overlay text-subtle hover:bg-bg-sunken'
            }`}
            aria-pressed={mode === 'custom'}
          >
            {translations['AddServiceModal.tabCustom']}
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {mode === 'preset' ? (
            <div className="mb-4">
              <label
                htmlFor="preset-select"
                className="block text-sm font-medium text-subtle mb-1.5"
              >
                {translations['AddServiceModal.presetSelectLabel']}
              </label>
              {presetsStatus === 'loading' && (
                <p className="text-sm text-muted">{translations['AddServiceModal.presetLoading']}</p>
              )}
              {presetsStatus === 'failed' && (
                <p className="text-sm text-danger">{translations['AddServiceModal.presetLoadFailed']}</p>
              )}
              {(presetsStatus === 'succeeded' || presets.length > 0) && (
                <select
                  id="preset-select"
                  value={selectedPresetKey}
                  onChange={(e) => setSelectedPresetKey(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-md bg-bg-overlay border border-border text-base text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                >
                  <option value="">{translations['AddServiceModal.presetSelectPlaceholder']}</option>
                  {Array.from(new Set(presets.map((p: HealthCheckPreset) => p.category))).map((cat) => (
                    <optgroup key={cat} label={cat.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}>
                      {presets.filter((p: HealthCheckPreset) => p.category === cat).map((p: HealthCheckPreset) => (
                        <option key={p.key} value={p.key}>{p.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
              {/* Description for selected preset */}
              {selectedPresetKey && (() => {
                const p = presets.find((x: HealthCheckPreset) => x.key === selectedPresetKey);
                return p?.description ? (
                  <p className="mt-1.5 text-xs text-muted">{p.description}</p>
                ) : null;
              })()}
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label
                  htmlFor="custom-name"
                  className="block text-sm font-medium text-subtle mb-1.5"
                >
                  {translations['AddServiceModal.customNameLabel']}
                </label>
                <input
                  id="custom-name"
                  type="text"
                  value={custom.name}
                  onChange={(e) => setCustom((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={translations['AddServiceModal.customNamePlaceholder']}
                  disabled={submitting}
                  maxLength={100}
                  className="w-full rounded-md bg-bg-overlay border border-border text-base text-sm px-3 py-2 placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
              </div>
              <div className="mb-4">
                <label
                  htmlFor="custom-url"
                  className="block text-sm font-medium text-subtle mb-1.5"
                >
                  {translations['AddServiceModal.customUrlLabel']}
                </label>
                <input
                  id="custom-url"
                  type="url"
                  value={custom.url}
                  onChange={(e) => setCustom((prev) => ({ ...prev, url: e.target.value }))}
                  placeholder={translations['AddServiceModal.customUrlPlaceholder']}
                  disabled={submitting}
                  className="w-full rounded-md bg-bg-overlay border border-border text-base text-sm px-3 py-2 placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
              </div>
              <div className="mb-4">
                <label
                  htmlFor="custom-expected-status"
                  className="block text-sm font-medium text-subtle mb-1.5"
                >
                  {translations['AddServiceModal.customExpectedStatusLabel']}
                  <span className="ml-1 text-xs font-normal text-subtle">({translations['AddServiceModal.customExpectedStatusOptional']})</span>
                </label>
                <input
                  id="custom-expected-status"
                  type="number"
                  min={100}
                  max={599}
                  value={custom.expectedStatus}
                  onChange={(e) => setCustom((prev) => ({ ...prev, expectedStatus: e.target.value }))}
                  placeholder={translations['AddServiceModal.customExpectedStatusPlaceholder']}
                  disabled={submitting}
                  className="w-full rounded-md bg-bg-overlay border border-border text-base text-sm px-3 py-2 placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-subtle">{translations['AddServiceModal.customExpectedStatusHint']}</p>
              </div>
            </>
          )}

          {/* Inline error */}
          {error && (
            <p
              role="alert"
              className="mb-4 text-sm text-danger bg-danger/10 border border-danger/50 rounded-md px-3 py-2"
            >
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={submitting}
            >
              {translations['AddServiceModal.cancelButton']}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting || presetsStatus === 'loading'}
            >
              {submitting ? translations['AddServiceModal.addingButton'] : translations['AddServiceModal.addButton']}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
