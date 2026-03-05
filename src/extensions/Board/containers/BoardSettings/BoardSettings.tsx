// BoardSettings — slide-in panel for board-level settings.
import { useNavigate, useParams } from 'react-router-dom';

interface Props {
  onClose: () => void;
}

const BoardSettings = ({ onClose }: Props) => {
  const navigate = useNavigate();
  const { boardId } = useParams<{ boardId: string }>();

  const handlePluginsClick = () => {
    onClose();
    navigate(`/boards/${boardId}/settings/plugins`);
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-30 bg-black/50"
      onClick={onClose}
      aria-label="Close settings"
    >
      {/* Panel — stop click propagation so clicks inside don't close */}
      <div
        className="absolute right-0 top-0 h-full w-80 bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Board Settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-slate-100 font-semibold text-sm">Board Settings</h2>
          <button
            className="text-slate-400 hover:text-slate-200 transition-colors"
            onClick={onClose}
            aria-label="Close settings panel"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <button
            onClick={handlePluginsClick}
            className="w-full text-left px-3 py-2 rounded text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition-colors"
          >
            <span>🧩</span>
            <span>Plugins</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BoardSettings;
