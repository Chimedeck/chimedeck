// PluginList — renders "Active on this board" and "Available plugins" sections.
import PluginCard from './PluginCard';
import type { Plugin, BoardPlugin } from '../api';

interface Props {
  boardPlugins: BoardPlugin[];
  availablePlugins: Plugin[];
  onEnable: (plugin: Plugin) => void;
  onDisable: (boardPlugin: BoardPlugin) => void;
  onSettings?: (boardPlugin: BoardPlugin) => void;
}

const PluginList = ({ boardPlugins, availablePlugins, onEnable, onDisable, onSettings }: Props) => {
  return (
    <div className="space-y-6">
      {/* Active section */}
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Active on this board
        </h3>
        {boardPlugins.length === 0 ? (
          <p className="text-slate-500 text-sm">No plugins enabled on this board yet.</p>
        ) : (
          <div className="space-y-2">
            {boardPlugins.map((bp) => (
              <PluginCard
                key={bp.id}
                mode="disable"
                boardPlugin={bp}
                onDisable={onDisable}
                {...(onSettings ? { onSettings } : {})}
              />
            ))}
          </div>
        )}
      </section>

      {/* Available section */}
      <section>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Available plugins
        </h3>
        {availablePlugins.length === 0 ? (
          <p className="text-slate-500 text-sm">No additional plugins available.</p>
        ) : (
          <div className="space-y-2">
            {availablePlugins.map((plugin) => (
              <PluginCard
                key={plugin.id}
                mode="enable"
                plugin={plugin}
                onEnable={onEnable}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default PluginList;

