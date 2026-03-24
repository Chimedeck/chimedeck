// RunLogDetail — inline expandable row showing context JSON and error message.
import type { FC } from 'react';
import type { AutomationRunLog } from '../../types';
import translations from '../../translations/en.json';

interface Props {
  run: AutomationRunLog;
}

const RunLogDetail: FC<Props> = ({ run }) => (
  <tr>
    <td colSpan={6} className="bg-slate-950 px-6 py-3">
      <div className="space-y-2">
        {run.errorMessage && (
          <div>
            <p className="text-xs font-medium text-red-400 mb-1">{translations['automation.runLogDetail.error']}</p>
            <pre className="text-xs text-red-300 whitespace-pre-wrap break-words font-mono bg-slate-900 rounded p-2">
              {run.errorMessage}
            </pre>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">{translations['automation.runLogDetail.context']}</p>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono bg-slate-900 rounded p-2">
            {JSON.stringify(run.context, null, 2)}
          </pre>
        </div>
      </div>
    </td>
  </tr>
);

export default RunLogDetail;
