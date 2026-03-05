// PluginDashboardPage — board admin-only page for managing plugins.
// Route: /boards/:boardId/settings/plugins
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBoardPlugins } from '../../hooks/useBoardPlugins';
import PluginList from '../../components/PluginList';

const PluginDashboardPage = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { boardPlugins, availablePlugins, status, error, loadPlugins, enablePlugin, disablePlugin } =
    useBoardPlugins({ boardId: boardId ?? '' });

  useEffect(() => {
    if (boardId) loadPlugins();
  }, [boardId, loadPlugins]);

  // If the API returns a 403-style error, redirect back to board
  useEffect(() => {
    if (error && (error.includes('not-board-admin') || error.includes('403'))) {
      navigate(`/boards/${boardId}`);
    }
  }, [error, boardId, navigate]);

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
        {/* Add a Plugin — coming soon */}
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
          />
        )}
      </div>
    </div>
  );
};

export default PluginDashboardPage;
