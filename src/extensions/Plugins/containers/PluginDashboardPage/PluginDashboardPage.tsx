// PluginDashboardPage — board settings page for managing plugins.
// All board members (MEMBER+) can enable/disable plugins.
// Registering new plugins in the registry requires platform-admin access.
// Route: /boards/:boardId/settings/plugins
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { selectAuthUser } from '~/extensions/Auth/duck/authDuck';
import { isPlatformAdmin } from '~/extensions/Auth/utils/isPlatformAdmin';
import { useBoardPlugins } from '../../hooks/useBoardPlugins';
import PluginList from '../../components/PluginList';
import PluginSearchBar from '../../components/PluginSearchBar';
import PluginModal, { type PluginModalState } from '../../modals/PluginModal';
import RegisterPluginModal from '../../modals/RegisterPluginModal';
import ApiKeyRevealModal from '../../modals/ApiKeyRevealModal';
import EditPluginModal from '../../modals/EditPluginModal';
import ToastRegion from '~/common/components/ToastRegion';
import type { ToastItem } from '~/common/components/Toast';
import {
  registerPluginThunk,
  clearRegisterState,
  updatePluginThunk,
  clearUpdateState,
  fetchAvailablePluginsThunk,
  fetchCategoriesThunk,
  setSearchQuery,
  setSelectedCategory,
  clearSearch,
  selectRegisterStatus,
  selectRegisterError,
  selectNewApiKey,
  selectSearchQuery,
  selectSelectedCategory,
  selectCategories,
  selectUpdateStatus,
  selectUpdateError,
} from './PluginDashboardPage.duck';
import type { BoardPlugin, Plugin, RegisterPluginBody, UpdatePluginBody } from '../../api';

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

  const { boardPlugins, availablePlugins, status, error, loadPlugins, enablePlugin: enablePluginRaw, disablePlugin } =
    useBoardPlugins({ boardId: boardId ?? '' });

  const [settingsModal, setSettingsModal] = useState<PluginModalState>(defaultSettingsModal);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editPlugin, setEditPlugin] = useState<Plugin | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, variant: ToastItem['variant'] = 'info') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  // Wrap enablePlugin to surface 403/permission errors as toasts
  const enablePlugin = useCallback(
    async (plugin: Parameters<typeof enablePluginRaw>[0]) => {
      const result = await enablePluginRaw(plugin);
      if (result?.error) {
        if (result.error === 'not-board-member' || result.error === 'not-board-admin' || result.error.includes('403')) {
          addToast('You do not have permission to enable plugins on this board.', 'error');
        } else {
          addToast('Failed to enable plugin. Please try again.', 'error');
        }
      }
    },
    [enablePluginRaw, addToast],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const registerStatus = useAppSelector(selectRegisterStatus);
  const registerError = useAppSelector(selectRegisterError);
  const newApiKey = useAppSelector(selectNewApiKey);
  const searchQuery = useAppSelector(selectSearchQuery);
  const selectedCategory = useAppSelector(selectSelectedCategory);
  const categories = useAppSelector(selectCategories);
  const updateStatus = useAppSelector(selectUpdateStatus);
  const updateError = useAppSelector(selectUpdateError);

  useEffect(() => {
    if (boardId) loadPlugins();
  }, [boardId, loadPlugins]);

  // Fetch categories once on mount
  useEffect(() => {
    dispatch(fetchCategoriesThunk());
  }, [dispatch]);

  // If the API returns a 403-style error for a non-member, redirect back to board.
  // Board members (MEMBER+) get no error and stay on the page normally.
  useEffect(() => {
    if (error && (error.includes('not-board-member') || error.includes('not-board-admin') || error.includes('403'))) {
      navigate(`/boards/${boardId}`);
    }
  }, [error, boardId, navigate]);

  // When registration succeeds, close the register modal
  useEffect(() => {
    if (registerStatus === 'success') {
      setRegisterOpen(false);
    }
  }, [registerStatus]);

  // When update succeeds, close edit modal and show toast
  useEffect(() => {
    if (updateStatus === 'success') {
      setEditPlugin(null);
      addToast('Plugin updated.', 'info');
      dispatch(clearUpdateState());
    }
  }, [updateStatus, addToast, dispatch]);

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
      boardPlugin: bp,
      boardId: boardId ?? '',
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
    if (boardId) {
      const params: { boardId: string; q?: string; category?: string | null } = { boardId };
      if (searchQuery) params.q = searchQuery;
      if (selectedCategory) params.category = selectedCategory;
      dispatch(fetchAvailablePluginsThunk(params));
    }
  }, [dispatch, boardId, searchQuery, selectedCategory]);

  const handleEditOpen = useCallback((plugin: Plugin) => {
    dispatch(clearUpdateState());
    setEditPlugin(plugin);
  }, [dispatch]);

  const handleEditClose = useCallback(() => {
    setEditPlugin(null);
    dispatch(clearUpdateState());
  }, [dispatch]);

  const handleEditSubmit = useCallback((pluginId: string, body: UpdatePluginBody) => {
    dispatch(updatePluginThunk({ pluginId, body }));
  }, [dispatch]);

  const handleSearchChange = useCallback((q: string) => {
    dispatch(setSearchQuery(q));
    if (boardId) {
      const params: { boardId: string; q?: string; category?: string | null } = { boardId };
      if (q) params.q = q;
      if (selectedCategory) params.category = selectedCategory;
      dispatch(fetchAvailablePluginsThunk(params));
    }
  }, [dispatch, boardId, selectedCategory]);

  const handleCategoryChange = useCallback((category: string | null) => {
    dispatch(setSelectedCategory(category));
    if (boardId) {
      const params: { boardId: string; q?: string; category?: string | null } = { boardId };
      if (searchQuery) params.q = searchQuery;
      if (category) params.category = category;
      dispatch(fetchAvailablePluginsThunk(params));
    }
  }, [dispatch, boardId, searchQuery]);

  const handleClearSearch = useCallback(() => {
    dispatch(clearSearch());
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
            + Register Plugin
          </button>
        ) : null}
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
          <>
            <PluginSearchBar
              categories={categories}
              onSearchChange={handleSearchChange}
              onCategoryChange={handleCategoryChange}
              searchQuery={searchQuery}
              selectedCategory={selectedCategory}
            />
            {availablePlugins.length === 0 && (searchQuery || selectedCategory) ? (
              <div className="mb-4">
                <p className="text-slate-400 text-sm mb-2">No plugins match your search.</p>
                <button
                  onClick={handleClearSearch}
                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  Clear search
                </button>
              </div>
            ) : null}
            <PluginList
              boardPlugins={boardPlugins}
              availablePlugins={availablePlugins}
              onEnable={enablePlugin}
              onDisable={disablePlugin}
              onSettings={handleSettings}
              {...(isAdmin ? { onEdit: handleEditOpen } : {})}
            />
          </>
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

      {/* Edit Plugin modal — platform admins only */}
      <EditPluginModal
        open={editPlugin !== null}
        plugin={editPlugin}
        isSubmitting={updateStatus === 'loading'}
        serverError={updateStatus === 'error' ? updateError : null}
        onClose={handleEditClose}
        onSubmit={handleEditSubmit}
      />

      {/* Toast notifications */}
      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default PluginDashboardPage;

