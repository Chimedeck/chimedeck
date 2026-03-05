// PluginDashboardPage — board admin-only page for managing plugins.
// Route: /boards/:boardId/settings/plugins
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { selectAuthUser } from '~/extensions/Auth/duck/authDuck';
import { isPlatformAdmin } from '~/extensions/Auth/utils/isPlatformAdmin';
import { useBoardPlugins } from '../../hooks/useBoardPlugins';
import PluginList from '../../components/PluginList';
import PluginModal, { type PluginModalState } from '../../modals/PluginModal';
import RegisterPluginModal from '../../modals/RegisterPluginModal';
import ApiKeyRevealModal from '../../modals/ApiKeyRevealModal';
import {
  registerPluginThunk,
  clearRegisterState,
  fetchAvailablePluginsThunk,
  selectRegisterStatus,
  selectRegisterError,
  selectNewApiKey,
} from './PluginDashboardPage.duck';
import type { BoardPlugin, RegisterPluginBody } from '../../api';

const defaultSettingsModal: PluginModalState = {
  open: false,
  url: '',
  title: '',
  fullscreen: false,
  pluginId: '',
};

const PluginDashboardPage = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(selectAuthUser);
  const isAdmin = isPlatformAdmin(currentUser?.email);

  const { boardPlugins, availablePlugins, status, error, loadPlugins, enablePlugin, disablePlugin } =
    useBoardPlugins({ boardId: boardId ?? '' });

  const [settingsModal, setSettingsModal] = useState<PluginModalState>(defaultSettingsModal);
  const [registerOpen, setRegisterOpen] = useState(false);

  const registerStatus = useAppSelector(selectRegisterStatus);
  const registerError = useAppSelector(selectRegisterError);
  const newApiKey = useAppSelector(selectNewApiKey);

  useEffect(() => {
    if (boardId) loadPlugins();
  }, [boardId, loadPlugins]);

  // If the API returns a 403-style error, redirect back to board
  useEffect(() => {
    if (error && (error.includes('not-board-admin') || error.includes('403'))) {
      navigate(`/boards/${boardId}`);
    }
  }, [error, boardId, navigate]);

  // When registration succeeds, close the register modal
  useEffect(() => {
    if (registerStatus === 'success') {
      setRegisterOpen(false);
    }
  }, [registerStatus]);

  const handleSettings = useCallback((bp: BoardPlugin) => {
    let settingsUrl = bp.plugin.connectorUrl;
    try {
      const u = new URL(bp.plugin.connectorUrl);
      u.searchParams.set('context', 'show-settings');
      u.searchParams.set('boardId', boardId ?? '');
      u.searchParams.set('pluginId', bp.plugin.id);
      settingsUrl = u.toString();
    } catch {
      // fallback: use connectorUrl as-is
    }
    setSettingsModal({
      open: true,
      url: settingsUrl,
      title: `${bp.plugin.name} Settings`,
      fullscreen: false,
      pluginId: bp.plugin.id,
    });
  }, [boardId]);

  const handleCloseSettings = useCallback(() => {
    setSettingsModal((m) => ({ ...m, open: false }));
  }, []);

  const handleRegisterSubmit = useCallback((body: RegisterPluginBody) => {
    dispatch(registerPluginThunk(body));
  }, [dispatch]);

  const handleRegisterClose = useCallback(() => {
    setRegisterOpen(false);
    dispatch(clearRegisterState());
  }, [dispatch]);

  const handleApiKeyDismiss = useCallback(() => {
    dispatch(clearRegisterState());
    // Refresh available plugins after new plugin is registered
    if (boardId) dispatch(fetchAvailablePluginsThunk({ boardId }));
  }, [dispatch, boardId]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate(`/boards/${boardId}`)}
            className="text-slate-400 hover:text-slate-200 text-sm mb-1 flex items-center gap-1"
          >
            ← Back to board
          </button>
          <h1 className="text-xl font-semibold">Plugins</h1>
        </div>
        {isAdmin ? (
          <button
            onClick={() => setRegisterOpen(true)}
            className="text-sm bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-2"
          >
            + Add a Plugin
          </button>
        ) : (
          <div className="relative group">
            <button
              className="text-sm bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-2 opacity-50 cursor-not-allowed"
              disabled
              title="Coming soon"
            >
              + Add a Plugin
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs text-slate-300 whitespace-nowrap z-10">
              Marketplace coming soon
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-6">
        {status === 'loading' && (
          <p className="text-slate-400 text-sm">Loading plugins…</p>
        )}
        {status === 'error' && error && !error.includes('not-board-admin') && (
          <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-300 text-sm">
            {error}
          </div>
        )}
        {status !== 'loading' && (
          <PluginList
            boardPlugins={boardPlugins}
            availablePlugins={availablePlugins}
            onEnable={enablePlugin}
            onDisable={disablePlugin}
            onSettings={handleSettings}
          />
        )}
      </div>

      {/* Settings modal — opened by gear icon on active plugin cards */}
      <PluginModal modal={settingsModal} onClose={handleCloseSettings} />

      {/* Register Plugin modal — platform admins only */}
      <RegisterPluginModal
        open={registerOpen}
        isSubmitting={registerStatus === 'loading'}
        serverError={registerStatus === 'error' ? registerError : null}
        onClose={handleRegisterClose}
        onSubmit={handleRegisterSubmit}
      />

      {/* API Key reveal — shown once after successful registration */}
      {newApiKey && (
        <ApiKeyRevealModal apiKey={newApiKey} onClose={handleApiKeyDismiss} />
      )}
    </div>
  );
};

export default PluginDashboardPage;

