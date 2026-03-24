// PluginRegistryPage — global plugin registry accessible only to platform admins.
// Route: /plugins
// Non-admins are redirected to / with a toast notification.
import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { selectAuthUser } from '~/extensions/Auth/duck/authDuck';
import { isPlatformAdmin } from '~/extensions/Auth/utils/isPlatformAdmin';
import Spinner from '~/common/components/Spinner';
import {
  fetchPluginsThunk,
  deletePluginThunk,
  reactivatePluginThunk,
  addPluginThunk,
  optimisticRemovePlugin,
  updatePluginInList,
  setRegistrySearchQuery,
  setRegistryCategory,
  setRegistryStatusFilter,
  selectRegistryPlugins,
  selectRegistryStatus,
  selectRegistryError,
  selectRegistrySearchQuery,
  selectRegistryCategory,
  selectRegistryStatusFilter,
  type RegistryStatus,
} from './PluginRegistryPage.duck';
import PluginSearchBar from '../../components/PluginSearchBar';
import PluginRegistryTable from '../../components/PluginRegistryTable';
import EditPluginModal from '../../modals/EditPluginModal';
import RegisterPluginModal from '../../modals/RegisterPluginModal';
import ApiKeyRevealModal from '../../modals/ApiKeyRevealModal';
import { updatePlugin } from '../../api';
import type { Plugin, UpdatePluginBody, RegisterPluginBody } from '../../api';
import translations from '../../translations/en.json';

const PluginRegistryPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currentUser = useAppSelector(selectAuthUser);
  const isAdmin = isPlatformAdmin(currentUser?.email);

  const plugins = useAppSelector(selectRegistryPlugins);
  const status = useAppSelector(selectRegistryStatus);
  const error = useAppSelector(selectRegistryError);
  const searchQuery = useAppSelector(selectRegistrySearchQuery);
  const selectedCategory = useAppSelector(selectRegistryCategory);
  const statusFilter = useAppSelector(selectRegistryStatusFilter);

  // Local state for edit modal
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editServerError, setEditServerError] = useState<string | null>(null);

  // Register plugin modal state — transitions: closed → register form → api-key reveal
  const [registerOpen, setRegisterOpen] = useState(false);
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
  const [registerServerError, setRegisterServerError] = useState<string | null>(null);
  // [why] Holds the one-time api_key returned on registration; cleared after reveal is dismissed.
  const [revealApiKey, setRevealApiKey] = useState<string | null>(null);

  // Track which plugin is being deactivated/reactivated to show per-row loading
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  // Derive unique categories from the loaded plugins
  const categories = Array.from(
    new Set(plugins.flatMap((p) => p.categories ?? [])),
  ).sort();

  // [why] Admin guard: deny-first, redirect non-admins immediately.
  useEffect(() => {
    if (currentUser !== undefined && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [currentUser, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      const params: Parameters<typeof fetchPluginsThunk>[0] = { status: statusFilter };
      if (searchQuery) params.q = searchQuery;
      if (selectedCategory) params.category = selectedCategory;
      dispatch(fetchPluginsThunk(params));
    }
  }, [isAdmin, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps — fetch once on mount

  // Re-fetch when filters change
  const dispatchFetch = useCallback(
    ({
      q,
      category,
      status: s,
    }: {
      q?: string;
      category?: string | null;
      status?: RegistryStatus;
    }) => {
      const params: Parameters<typeof fetchPluginsThunk>[0] = { status: s ?? statusFilter };
      if (q) params.q = q;
      if (category) params.category = category;
      dispatch(fetchPluginsThunk(params));
    },
    [dispatch, statusFilter],
  );

  const handleSearchChange = (q: string) => {
    dispatch(setRegistrySearchQuery(q));
    dispatchFetch({ q, category: selectedCategory, status: statusFilter });
  };

  const handleCategoryChange = (category: string | null) => {
    dispatch(setRegistryCategory(category));
    dispatchFetch({ q: searchQuery, category, status: statusFilter });
  };

  const handleStatusChange = (s: RegistryStatus) => {
    dispatch(setRegistryStatusFilter(s));
    const params: Parameters<typeof fetchPluginsThunk>[0] = { status: s };
    if (searchQuery) params.q = searchQuery;
    if (selectedCategory) params.category = selectedCategory;
    dispatch(fetchPluginsThunk(params));
  };

  const handleRegisterSubmit = async (body: RegisterPluginBody) => {
    setIsSubmittingRegister(true);
    setRegisterServerError(null);
    const result = await dispatch(addPluginThunk({ body }));
    setIsSubmittingRegister(false);
    if (addPluginThunk.fulfilled.match(result)) {
      const newPlugin = result.payload.data;
      // [why] Close the form and open the key-reveal step before prepending to the list.
      setRegisterOpen(false);
      setRevealApiKey(newPlugin.apiKey ?? '');
    } else {
      const errMsg =
        typeof result.payload === 'string'
          ? result.payload
          : (result.error?.message ?? 'Failed to register plugin.');
      setRegisterServerError(errMsg);
    }
  };

  const handleRevealClose = () => {
    // [why] Only prepend after the admin has acknowledged (copied) the key.
    if (revealApiKey) {
      // The plugin data is already in the fulfilled payload; re-use it from the result.
      // We just need to trigger a refresh so the new row appears correctly.
      const params: Parameters<typeof fetchPluginsThunk>[0] = { status: statusFilter };
      if (searchQuery) params.q = searchQuery;
      if (selectedCategory) params.category = selectedCategory;
      dispatch(fetchPluginsThunk(params));
    }
    setRevealApiKey(null);
  };

  const handleDeactivate = async (pluginId: string) => {
    setDeactivatingId(pluginId);
    // [why] Optimistically remove from list so the UX feels instant.
    dispatch(optimisticRemovePlugin(pluginId));
    await dispatch(deletePluginThunk({ pluginId }));
    setDeactivatingId(null);
  };

  const handleReactivate = async (pluginId: string) => {
    setReactivatingId(pluginId);
    const result = await dispatch(reactivatePluginThunk({ pluginId }));
    if (reactivatePluginThunk.fulfilled.match(result)) {
      // Refresh the list so the reactivated plugin appears in the correct status bucket
      const params: Parameters<typeof fetchPluginsThunk>[0] = { status: statusFilter };
      if (searchQuery) params.q = searchQuery;
      if (selectedCategory) params.category = selectedCategory;
      dispatch(fetchPluginsThunk(params));
    }
    setReactivatingId(null);
  };

  const handleEditSubmit = async (pluginId: string, body: UpdatePluginBody) => {
    setIsSubmittingEdit(true);
    setEditServerError(null);
    try {
      const result = await updatePlugin({ pluginId, body });
      dispatch(updatePluginInList(result.data));
      setEditingPlugin(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update plugin. Please try again.';
      setEditServerError(msg);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {translations['plugins.registry.title']}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {translations['plugins.registry.subtitle']}
          </p>
        </div>
        {/* "+ Register Plugin" button — wired in a future iteration */}
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          aria-label={translations['plugins.registry.registerPlugin']}
          onClick={() => {
            setRegisterServerError(null);
            setRegisterOpen(true);
          }}
        >
          {translations['plugins.registry.registerPlugin']}
        </button>
      </div>

      {/* Search + filter bar */}
      <PluginSearchBar
        categories={categories}
        searchQuery={searchQuery}
        selectedCategory={selectedCategory}
        selectedStatus={statusFilter}
        onSearchChange={handleSearchChange}
        onCategoryChange={handleCategoryChange}
        onStatusChange={handleStatusChange}
      />

      {/* Loading state */}
      {status === 'loading' && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" className="text-indigo-500" />
          <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">
            {translations['plugins.registry.loading']}
          </span>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {translations['plugins.registry.error']}
        </div>
      )}

      {/* Empty state */}
      {status === 'idle' && plugins.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-4xl mb-4" aria-hidden="true">🧩</span>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {translations['plugins.registry.empty']}
          </p>
        </div>
      )}

      {/* Plugin registry table */}
      {status === 'idle' && plugins.length > 0 && (
        <PluginRegistryTable
          plugins={plugins}
          deactivatingId={deactivatingId}
          reactivatingId={reactivatingId}
          onEdit={setEditingPlugin}
          onDeactivate={handleDeactivate}
          onReactivate={handleReactivate}
        />
      )}

      {/* Edit plugin modal */}
      <EditPluginModal
        open={editingPlugin !== null}
        plugin={editingPlugin}
        isSubmitting={isSubmittingEdit}
        serverError={editServerError}
        onClose={() => {
          setEditingPlugin(null);
          setEditServerError(null);
        }}
        onSubmit={handleEditSubmit}
      />

      {/* Register plugin modal — step 1: fill in the form */}
      <RegisterPluginModal
        open={registerOpen}
        isSubmitting={isSubmittingRegister}
        serverError={registerServerError}
        onClose={() => setRegisterOpen(false)}
        onSubmit={handleRegisterSubmit}
      />

      {/* API key reveal modal — step 2: shown once after successful registration */}
      {revealApiKey !== null && (
        <ApiKeyRevealModal apiKey={revealApiKey} onClose={handleRevealClose} />
      )}
    </div>
  );
};

export default PluginRegistryPage;
