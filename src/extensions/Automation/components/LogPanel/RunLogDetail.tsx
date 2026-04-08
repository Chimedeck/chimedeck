// RunLogDetail — inline expandable row showing context JSON and error message.
import type { FC } from 'react';
import type { AutomationRunLog } from '../../types';
import translations from '../../translations/en.json';

interface Props {
  run: AutomationRunLog;
}

const RunLogDetail: FC<Props> = ({ run }) => (
  <tr>
    <td colSpan={6} className="bg-bg-base px-6 py-3">
      <div className="space-y-2">
        {run.errorMessage && (
          <div>
            <p className="text-xs font-medium text-danger mb-1">{translations['automation.runLogDetail.error']}</p>
            <pre className="text-xs text-danger whitespace-pre-wrap break-words font-mono bg-bg-base rounded p-2">
              {run.errorMessage}
            </pre>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-muted mb-1">{translations['automation.runLogDetail.context']}</p>
          <pre className="text-xs text-subtle whitespace-pre-wrap break-words font-mono bg-bg-base rounded p-2">
            {JSON.stringify(run.context, null, 2)}
          </pre>
        </div>
      </div>
    </td>
  </tr>
);

export default RunLogDetail;
