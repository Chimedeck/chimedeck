// PluginDashboardPage — board settings page for managing plugins.
// All board members (MEMBER+) can enable/disable plugins.
// Registering new plugins in the registry requires platform-admin access.
// Route: /boards/:boardId/settings/plugins
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PuzzlePieceIcon } from '@heroicons/react/24/outline';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { selectAuthUser } from '~/extensions/Auth/duck/authDuck';
import { isPlatformAdmin } from '~/extensions/Auth/utils/isPlatformAdmin';
import translations from '../../translations/en.json';
import { useBoardPlugins } from '../../hooks/useBoardPlugins';
import EnabledPluginRow from '../../components/EnabledPluginRow';
import DiscoverPluginRow from '../../components/DiscoverPluginRow';
import DiscoverPluginSearch from '../../components/DiscoverPluginSearch';
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
  fetchDiscoverablePluginsThunk,
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
          addToast(translations['plugins.dashboard.toast.noPermissionEnable'], 'error');
        } else {
          addToast(translations['plugins.dashboard.toast.failedEnable'], 'error');
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
      addToast(translations['plugins.dashboard.toast.pluginUpdated'], 'info');
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
      dispatch(fetchDiscoverablePluginsThunk(params));
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
      dispatch(fetchDiscoverablePluginsThunk(params));
    }
  }, [dispatch, boardId, selectedCategory]);

  const handleCategoryChange = useCallback((category: string | null) => {
    dispatch(setSelectedCategory(category));
    if (boardId) {
      const params: { boardId: string; q?: string; category?: string | null } = { boardId };
      if (searchQuery) params.q = searchQuery;
      if (category) params.category = category;
      dispatch(fetchDiscoverablePluginsThunk(params));
    }
  }, [dispatch, boardId, searchQuery]);

  const handleClearSearch = useCallback(() => {
    dispatch(clearSearch());
    if (boardId) dispatch(fetchDiscoverablePluginsThunk({ boardId }));
  }, [dispatch, boardId]);

  return (
    // [theme-exception]: full dark-themed plugin dashboard page
    <div className="min-h-screen bg-bg-base text-base">
      {/* Header */}
      <div className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate(`/boards/${boardId}`)}
            className="text-subtle hover:text-base text-sm mb-1 flex items-center gap-1"
          >
            {translations['plugins.dashboard.backToBoard']}
          </button>
          <h1 className="text-xl font-semibold">{translations['plugins.dashboard.title']}</h1>
        </div>
        {isAdmin ? (
          <button
            onClick={() => setRegisterOpen(true)}
            className="text-sm bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-2" // [theme-exception] text-white on bg-blue-600 button
          >
            {translations['plugins.dashboard.registerPlugin']}
          </button>
        ) : null}
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-8">
        {status === 'loading' && (
          <p className="text-subtle text-sm">{translations['plugins.dashboard.loading']}</p>
        )}
        {status === 'error' && error && !error.includes('not-board-admin') && (
          // [theme-exception]: light text on dark red error bg
          <div className="bg-danger/10 border border-danger/40 rounded p-3 text-danger text-sm">
            {error}
          </div>
        )}

        {/* ── Section 1: Enabled on this board ── */}
        {status !== 'loading' && (
          <section>
            <h2 className="text-xs font-semibold text-subtle uppercase tracking-wide mb-3">
              {translations['plugins.dashboard.enabled.heading']}
            </h2>
            {boardPlugins.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted">
                <PuzzlePieceIcon className="h-8 w-8 text-muted" aria-hidden="true" />
                <p className="text-sm text-center">{translations['plugins.dashboard.enabled.empty']}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {boardPlugins.map((bp) => (
                  <EnabledPluginRow
                    key={bp.id}
                    boardPlugin={bp}
                    onDisable={disablePlugin}
                    onSettings={handleSettings}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Section 2: Discover Plugins ── */}
        {status !== 'loading' && (
          <section>
            <h2 className="text-xs font-semibold text-subtle uppercase tracking-wide mb-3">
              {translations['plugins.dashboard.discover.heading']}
            </h2>
            <DiscoverPluginSearch
              searchQuery={searchQuery}
              selectedCategory={selectedCategory}
              categories={categories}
              onSearchChange={handleSearchChange}
              onCategoryChange={handleCategoryChange}
            />
            {availablePlugins.length === 0 && (searchQuery || selectedCategory) ? (
              <div className="mb-4">
                <p className="text-subtle text-sm mb-2">
                  {translations['plugins.dashboard.discover.noMatch']}
                </p>
                <button
                  onClick={handleClearSearch}
                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  {translations['plugins.dashboard.discover.clearSearch']}
                </button>
              </div>
            ) : availablePlugins.length === 0 ? (
              <p className="text-muted text-sm">
                {translations['plugins.dashboard.discover.empty']}
              </p>
            ) : (
              <div className="space-y-2">
                {availablePlugins.map((plugin) => (
                  <DiscoverPluginRow
                    key={plugin.id}
                    plugin={plugin}
                    onEnable={enablePlugin}
                  />
                ))}
              </div>
            )}
          </section>
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

