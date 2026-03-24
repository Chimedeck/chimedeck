// AddServiceModal — modal for adding a new health check service.
// Supports two modes:
//   preset: user picks from a pre-configured list
//   custom: user provides a name and URL manually
// State is fully reset when the modal closes or the mode switches.

import { useState, useEffect, type FormEvent } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  selectHealthCheckPresets,
  selectHealthCheckPresetsStatus,
  fetchPresetsThunk,
  addHealthCheckThunk,
} from '../containers/HealthCheckTab/HealthCheckTab.duck';
import type { HealthCheckPreset } from '../api';

type Mode = 'preset' | 'custom';

interface Props {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
}

function buildInitialCustomState() {
  return { name: '', url: '' };
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
        setError('Please select a service from the list.');
        return;
      }
      const preset = presets.find((p: HealthCheckPreset) => p.key === selectedPresetKey);
      if (!preset) {
        setError('Selected preset not found. Please refresh and try again.');
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
          }),
        ).unwrap();
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Failed to add service. Please try again.');
      } finally {
        setSubmitting(false);
      }
    } else {
      const name = custom.name.trim();
      const url = custom.url.trim();
      if (!name) {
        setError('Name is required.');
        return;
      }
      if (!url) {
        setError('URL is required.');
        return;
      }
      // Basic client-side scheme check; the server validates fully.
      if (!url.startsWith('https://') && !url.startsWith('http://')) {
        setError('URL must start with https:// or http://');
        return;
      }
      setSubmitting(true);
      try {
        await dispatch(
          addHealthCheckThunk({ boardId, name, url, type: 'custom' }),
        ).unwrap();
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Failed to add service. Please try again.');
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
      <div className="relative w-full max-w-md rounded-xl bg-slate-800 border border-slate-700 shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2
            id="add-service-modal-title"
            className="text-base font-semibold text-slate-100"
          >
            Add Health Check Service
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-5" role="group" aria-label="Service type">
          <button
            type="button"
            onClick={() => handleModeSwitch('preset')}
            className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              mode === 'preset'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            aria-pressed={mode === 'preset'}
          >
            Preset Service
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('custom')}
            className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              mode === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            aria-pressed={mode === 'custom'}
          >
            Custom URL
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {mode === 'preset' ? (
            <div className="mb-4">
              <label
                htmlFor="preset-select"
                className="block text-sm font-medium text-slate-300 mb-1.5"
              >
                Select a preset service
              </label>
              {presetsStatus === 'loading' && (
                <p className="text-sm text-slate-400">Loading presets…</p>
              )}
              {presetsStatus === 'failed' && (
                <p className="text-sm text-red-400">Failed to load presets. Please close and try again.</p>
              )}
              {(presetsStatus === 'succeeded' || presets.length > 0) && (
                <select
                  id="preset-select"
                  value={selectedPresetKey}
                  onChange={(e) => setSelectedPresetKey(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-md bg-slate-700 border border-slate-600 text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">— Choose a service —</option>
                  {presets.map((p: HealthCheckPreset) => (
                    <option key={p.key} value={p.key}>
                      {p.name}
                      {p.category ? ` (${p.category})` : ''}
                    </option>
                  ))}
                </select>
              )}
              {/* Description for selected preset */}
              {selectedPresetKey && (() => {
                const p = presets.find((x: HealthCheckPreset) => x.key === selectedPresetKey);
                return p?.description ? (
                  <p className="mt-1.5 text-xs text-slate-400">{p.description}</p>
                ) : null;
              })()}
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label
                  htmlFor="custom-name"
                  className="block text-sm font-medium text-slate-300 mb-1.5"
                >
                  Service name
                </label>
                <input
                  id="custom-name"
                  type="text"
                  value={custom.name}
                  onChange={(e) => setCustom((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. My API"
                  disabled={submitting}
                  maxLength={100}
                  className="w-full rounded-md bg-slate-700 border border-slate-600 text-slate-100 text-sm px-3 py-2 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <div className="mb-4">
                <label
                  htmlFor="custom-url"
                  className="block text-sm font-medium text-slate-300 mb-1.5"
                >
                  URL
                </label>
                <input
                  id="custom-url"
                  type="url"
                  value={custom.url}
                  onChange={(e) => setCustom((prev) => ({ ...prev, url: e.target.value }))}
                  placeholder="https://example.com/health"
                  disabled={submitting}
                  className="w-full rounded-md bg-slate-700 border border-slate-600 text-slate-100 text-sm px-3 py-2 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </>
          )}

          {/* Inline error */}
          {error && (
            <p
              role="alert"
              className="mb-4 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md px-3 py-2"
            >
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || presetsStatus === 'loading'}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Adding…' : 'Add Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
