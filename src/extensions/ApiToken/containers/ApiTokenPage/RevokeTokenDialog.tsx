// RevokeTokenDialog — confirmation dialog before revoking an API token.
import translations from '../../translations/en.json';

interface Props {
  tokenName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function RevokeTokenDialog({ tokenName, onConfirm, onCancel, isLoading }: Props) {
  const body = translations['RevokeTokenDialog.body'].replace('{name}', tokenName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-slate-800 p-6 shadow-2xl">
        <h2 className="mb-3 text-lg font-semibold text-white">
          {translations['RevokeTokenDialog.title']}
        </h2>
        <p className="mb-6 text-sm text-slate-300">{body}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {translations['RevokeTokenDialog.cancel']}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {translations['RevokeTokenDialog.confirm']}
          </button>
        </div>
      </div>
    </div>
  );
}
