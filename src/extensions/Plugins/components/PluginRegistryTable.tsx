// PluginRegistryTable — full table view of registered plugins for platform admins.
// Columns: icon, name/author, description, categories, actions.
import translations from '../translations/en.json';
import PluginRegistryRow from './PluginRegistryRow';
import type { Plugin } from '../api';

interface Props {
  plugins: Plugin[];
  deactivatingId: string | null;
  reactivatingId: string | null;
  onEdit: (plugin: Plugin) => void;
  onDeactivate: (pluginId: string) => void;
  onReactivate: (pluginId: string) => void;
}

const PluginRegistryTable = ({
  plugins,
  deactivatingId,
  reactivatingId,
  onEdit,
  onDeactivate,
  onReactivate,
}: Props) => {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full divide-y divide-border">
        {/* [theme-exception] bg-slate-50: light-mode table header */}
        <thead className="bg-slate-50">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 w-12 text-left text-xs font-medium text-muted uppercase tracking-wider"
            >
              <span className="sr-only">{translations['plugins.registry.table.colIcon']}</span>
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider"
            >
              {translations['plugins.registry.table.colName']}
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider"
            >
              {translations['plugins.registry.table.colDescription']}
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider"
            >
              {translations['plugins.registry.table.colCategories']}
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider"
            >
              {translations['plugins.registry.table.colActions']}
            </th>
          </tr>
        </thead>
        {/* [theme-exception] bg-white: light-mode table body */}
        <tbody className="bg-white divide-y divide-slate-100">
          {plugins.map((plugin) => (
            <PluginRegistryRow
              key={plugin.id}
              plugin={plugin}
              onEdit={onEdit}
              onDeactivate={onDeactivate}
              onReactivate={onReactivate}
              isDeactivating={deactivatingId === plugin.id}
              isReactivating={reactivatingId === plugin.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PluginRegistryTable;
