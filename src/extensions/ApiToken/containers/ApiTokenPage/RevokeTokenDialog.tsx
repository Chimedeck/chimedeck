// RevokeTokenDialog — confirmation dialog before revoking an API token.
import translations from '../../translations/en.json';
import Button from '~/common/components/Button';

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
      <div className="w-full max-w-sm rounded-xl bg-bg-surface p-6 shadow-2xl">
        <h2 className="mb-3 text-lg font-semibold text-base">
          {translations['RevokeTokenDialog.title']}
        </h2>
        <p className="mb-6 text-sm text-subtle">{body}</p>
        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            size="md"
            onClick={onCancel}
            disabled={isLoading}
          >
            {translations['RevokeTokenDialog.cancel']}
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {translations['RevokeTokenDialog.confirm']}
          </Button>
        </div>
      </div>
    </div>
  );
}
