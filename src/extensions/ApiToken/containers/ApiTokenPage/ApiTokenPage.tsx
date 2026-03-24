// ApiTokenPage — lists the current user's API tokens with create and revoke actions.
import { useState } from 'react';
import {
  useListTokensQuery,
  useCreateTokenMutation,
  useRevokeTokenMutation,
  type ApiTokenItem,
  type CreateTokenBody,
} from '../../apiToken.slice';
import translations from '../../translations/en.json';
import GenerateTokenModal from './GenerateTokenModal';
import TokenCreatedModal from './TokenCreatedModal';
import RevokeTokenDialog from './RevokeTokenDialog';
import Spinner from '~/common/components/Spinner';

export default function ApiTokenPage() {
  const { data: tokens, isLoading } = useListTokensQuery();
  const [createToken, { isLoading: isCreating }] = useCreateTokenMutation();
  const [revokeToken, { isLoading: isRevoking }] = useRevokeTokenMutation();

  const [showGenerate, setShowGenerate] = useState(false);
  const [newRawToken, setNewRawToken] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiTokenItem | null>(null);

  const handleGenerate = async (body: CreateTokenBody) => {
    const result = await createToken(body).unwrap();
    setShowGenerate(false);
    setNewRawToken(result.data.token);
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    await revokeToken(revokeTarget.id).unwrap();
    setRevokeTarget(null);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{translations['ApiTokenPage.title']}</h1>
          <p className="mt-1 text-sm text-slate-400">{translations['ApiTokenPage.description']}</p>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          {translations['ApiTokenPage.generateButton']}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" className="text-blue-500" />
        </div>
      ) : !tokens || tokens.length === 0 ? (
        <p className="text-sm text-slate-400">{translations['ApiTokenPage.emptyState']}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/60">
                <th className="px-4 py-3 text-left font-medium text-slate-400">
                  {translations['ApiTokenPage.tableNameCol']}
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">
                  {translations['ApiTokenPage.tablePrefixCol']}
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">
                  {translations['ApiTokenPage.tableCreatedCol']}
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">
                  {translations['ApiTokenPage.tableLastUsedCol']}
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">
                  {translations['ApiTokenPage.tableExpiresCol']}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-medium text-white">{token.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{token.prefix}…</td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(token.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {token.lastUsedAt
                      ? formatDate(token.lastUsedAt)
                      : translations['ApiTokenPage.noLastUsed']}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {token.expiresAt
                      ? formatDate(token.expiresAt)
                      : translations['ApiTokenPage.neverExpires']}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setRevokeTarget(token)}
                      className="rounded px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
                    >
                      {translations['ApiTokenPage.revokeButton']}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showGenerate && (
        <GenerateTokenModal
          onSubmit={handleGenerate}
          onCancel={() => setShowGenerate(false)}
          isLoading={isCreating}
        />
      )}

      {newRawToken && (
        <TokenCreatedModal
          rawToken={newRawToken}
          onDone={() => setNewRawToken(null)}
        />
      )}

      {revokeTarget && (
        <RevokeTokenDialog
          tokenName={revokeTarget.name}
          onConfirm={handleRevoke}
          onCancel={() => setRevokeTarget(null)}
          isLoading={isRevoking}
        />
      )}
    </div>
  );
}
