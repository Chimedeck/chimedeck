import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Button from '~/common/components/Button';
import Spinner from '~/common/components/Spinner';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectWorkspaces, setActiveWorkspace } from '~/extensions/Workspace/duck/workspaceDuck';
import {
  createSubscriptionPortal,
  getWorkspaceEntitlements,
  getWorkspaceSubscription,
  type EntitlementValue,
  type WorkspaceEntitlements,
  type WorkspaceSubscription,
  type WorkspaceUsage,
} from '../../api';
import translations from '../../translations/en.json';

type BillingMetric = {
  id: string;
  label: string;
  used: number;
  limit: EntitlementValue;
  formatter?: (value: number) => string;
};

type PlanCard = {
  tier: WorkspaceSubscription['tier'];
  name: string;
  description: string;
};

type PaidTier = Extract<WorkspaceSubscription['tier'], 'tier_2' | 'tier_3' | 'tier_4'>;

const TIER_RANK: Record<WorkspaceSubscription['tier'], number> = {
  tier_1: 1,
  tier_2: 2,
  tier_3: 3,
  tier_4: 4,
  unlimited: 5,
};

function normalizeWorkspaceToken(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatDate(value: string | null): string {
  if (!value) return translations['BillingPage.notAvailable'];
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return translations['BillingPage.notAvailable'];
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatStorage(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 10) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function ratioClass(used: number, limit: number): string {
  const ratio = used / Math.max(limit, 1);
  if (ratio >= 1) return 'bg-danger';
  if (ratio >= 0.8) return 'bg-amber-500';
  return 'bg-primary';
}

function planLabel(tier: WorkspaceSubscription['tier']): string {
  if (tier === 'tier_2') return translations['BillingPage.planHobby'];
  if (tier === 'tier_3') return translations['BillingPage.planPro'];
  if (tier === 'tier_4') return translations['BillingPage.planBusiness'];
  if (tier === 'unlimited') return translations['BillingPage.planEnterprise'];
  return translations['BillingPage.planPersonal'];
}

function nextTierForUpgrade(tier: WorkspaceSubscription['tier']): PaidTier | null {
  if (tier === 'tier_1') return 'tier_2';
  if (tier === 'tier_2') return 'tier_3';
  if (tier === 'tier_3') return 'tier_4';
  return null;
}

function upgradeButtonLabel(tier: PaidTier): string {
  if (tier === 'tier_2') return translations['BillingPage.upgradeToHobby'];
  if (tier === 'tier_3') return translations['BillingPage.upgradeToPro'];
  return translations['BillingPage.upgradeToBusiness'];
}

function canManageBilling(): boolean {
  return true;
}

function planActionLabel({
  currentTier,
  targetTier,
}: {
  currentTier: WorkspaceSubscription['tier'];
  targetTier: WorkspaceSubscription['tier'];
}): string {
  if (TIER_RANK[targetTier] > TIER_RANK[currentTier]) {
    return translations['BillingPage.upgrade'];
  }
  return translations['BillingPage.downgrade'];
}

export default function BillingPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { workspaceId = '' } = useParams();
  const [searchParams] = useSearchParams();

  const workspaces = useAppSelector(selectWorkspaces);
  const workspace = workspaces.find((item) => {
    if (item.id === workspaceId) return true;
    const token = normalizeWorkspaceToken(workspaceId);
    return normalizeWorkspaceToken(item.name) === token || normalizeWorkspaceToken(item.id) === token;
  });
  const resolvedWorkspaceId = workspace?.id ?? workspaceId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<WorkspaceSubscription | null>(null);
  const [entitlements, setEntitlements] = useState<WorkspaceEntitlements | null>(null);
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const [busyAction, setBusyAction] = useState<'portal' | null>(null);

  useEffect(() => {
    if (workspace?.id) {
      dispatch(setActiveWorkspace(workspace.id));
    }
  }, [dispatch, workspace?.id]);

  const loadBilling = useCallback(async () => {
    if (!resolvedWorkspaceId) return;

    setLoading(true);
    setError(null);

    try {
      const [subscriptionResponse, entitlementsResponse] = await Promise.all([
        getWorkspaceSubscription(resolvedWorkspaceId),
        getWorkspaceEntitlements(resolvedWorkspaceId),
      ]);

      setSubscription(subscriptionResponse.data);
      setEntitlements(entitlementsResponse.data.entitlements);
      setUsage(entitlementsResponse.data.usage);
    } catch {
      setError(translations['BillingPage.error']);
    } finally {
      setLoading(false);
    }
  }, [resolvedWorkspaceId]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  const checkoutStatus = searchParams.get('checkout');
  let checkoutMessage: string | null = null;
  if (checkoutStatus === 'success') checkoutMessage = translations['BillingPage.checkoutSuccess'];
  if (checkoutStatus === 'cancel') checkoutMessage = translations['BillingPage.checkoutCancel'];

  const metrics = useMemo<BillingMetric[]>(() => {
    if (!usage || !entitlements) return [];

    return [
      {
        id: 'boardsPerWorkspace',
        label: translations['BillingPage.metric.boardsPerWorkspace'],
        used: usage.boardsPerWorkspace,
        limit: entitlements['board:max-per-workspace'],
      },
      {
        id: 'boardsTotal',
        label: translations['BillingPage.metric.boardsTotal'],
        used: usage.boardsTotal,
        limit: entitlements['board:max-total'],
      },
      {
        id: 'columnsPerBoard',
        label: translations['BillingPage.metric.columnsPerBoard'],
        used: usage.columnsPerBoard,
        limit: entitlements['list:max-per-board'],
      },
      {
        id: 'cardsPerBoard',
        label: translations['BillingPage.metric.cardsPerBoard'],
        used: usage.cardsPerBoard,
        limit: entitlements['card:max-per-board'],
      },
      {
        id: 'invitedMembersPerBoard',
        label: translations['BillingPage.metric.invitedMembersPerBoard'],
        used: usage.invitedMembersPerBoard,
        limit: entitlements['member:max-invited-per-board'],
      },
      {
        id: 'guestsPerBoard',
        label: translations['BillingPage.metric.guestsPerBoard'],
        used: usage.guestsPerBoard,
        limit: entitlements['guest:max-per-board'],
      },
      {
        id: 'storageBytes',
        label: translations['BillingPage.metric.storageBytes'],
        used: usage.storageBytes,
        limit: entitlements['storage:max-bytes'],
        formatter: formatStorage,
      },
    ];
  }, [entitlements, usage]);

  const isManager = canManageBilling();

  const upgradeTarget = useMemo<PaidTier | null>(
    () => (subscription ? nextTierForUpgrade(subscription.tier) : null),
    [subscription],
  );

  const handleUpgrade = useCallback(() => {
    if (!resolvedWorkspaceId || !upgradeTarget) return;
    navigate(`/workspace/${resolvedWorkspaceId}/checkout?tier=${upgradeTarget}`);
  }, [navigate, upgradeTarget, resolvedWorkspaceId]);

  const handleCheckoutTier = useCallback((tier: PaidTier) => {
    if (!resolvedWorkspaceId) return;
    navigate(`/workspace/${resolvedWorkspaceId}/checkout?tier=${tier}`);
  }, [navigate, resolvedWorkspaceId]);

  const handleOpenPortal = useCallback(async () => {
    if (!resolvedWorkspaceId) return;
    setBusyAction('portal');
    setError(null);

    try {
      const response = await createSubscriptionPortal(resolvedWorkspaceId);
      globalThis.location.assign(response.data.url);
    } catch {
      setError(translations['BillingPage.error']);
      setBusyAction(null);
    }
  }, [resolvedWorkspaceId]);

  const plans = useMemo<PlanCard[]>(() => [
    {
      tier: 'tier_1',
      name: translations['BillingPage.planPersonal'],
      description: translations['BillingPage.planPersonalDescription'],
    },
    {
      tier: 'tier_2',
      name: translations['BillingPage.planHobby'],
      description: translations['BillingPage.planHobbyDescription'],
    },
    {
      tier: 'tier_3',
      name: translations['BillingPage.planPro'],
      description: translations['BillingPage.planProDescription'],
    },
    {
      tier: 'tier_4',
      name: translations['BillingPage.planBusiness'],
      description: translations['BillingPage.planBusinessDescription'],
    },
  ], []);

  if (!workspaceId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-muted">{translations['BillingPage.error']}</p>
      </div>
    );
  }

  let bodyContent: React.ReactNode;
  if (loading) {
    bodyContent = (
      <div className="flex justify-center py-12">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  } else if (error) {
    bodyContent = (
      <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-base space-y-3">
        <p>{error}</p>
        <Button variant="secondary" size="sm" onClick={() => void loadBilling()}>
          {translations['BillingPage.refresh']}
        </Button>
      </div>
    );
  } else {
    bodyContent = (
      <>
        {subscription && (
          <section className="rounded-xl border border-border bg-bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">{translations['BillingPage.currentPlan']}</p>
                <h2 className="mt-1 text-xl font-semibold text-base">{planLabel(subscription.tier)}</h2>
              </div>

              <div className="text-right text-sm text-muted">
                <p>
                  {translations['BillingPage.status']}: <span className="text-base font-medium">{subscription.status}</span>
                </p>
                <p>
                  {translations['BillingPage.renewsOn']}: <span className="text-base font-medium">{formatDate(subscription.stripeCurrentPeriodEnd)}</span>
                </p>
              </div>
            </div>

            {!isManager && (
              <p className="text-sm text-muted">{translations['BillingPage.memberReadOnly']}</p>
            )}

            {subscription.subscriptionsEnabled && isManager && (
              <div className="flex flex-wrap gap-2">
                {upgradeTarget && (
                  <Button variant="primary" onClick={handleUpgrade}>
                    {upgradeButtonLabel(upgradeTarget)}
                  </Button>
                )}

                {!upgradeTarget && (
                  <p className="text-sm text-muted py-2">{translations['BillingPage.noneToUpgrade']}</p>
                )}

                {subscription.stripeCustomerId && (
                  <Button
                    variant="secondary"
                    onClick={() => void handleOpenPortal()}
                    disabled={busyAction === 'portal'}
                  >
                    {busyAction === 'portal'
                      ? translations['BillingPage.portalInProgress']
                      : translations['BillingPage.manageBilling']}
                  </Button>
                )}
              </div>
            )}
          </section>
        )}

        {subscription && (
          <section className="rounded-xl border border-border bg-bg-surface p-5">
            <h3 className="text-lg font-semibold text-base">{translations['BillingPage.plansTitle']}</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {plans.map((plan) => {
                const isCurrent = subscription.tier === plan.tier;
                let actionNode: React.ReactNode;

                if (isCurrent) {
                  actionNode = (
                    <p className="mt-4 text-xs font-medium text-primary">{translations['BillingPage.currentPlanBadge']}</p>
                  );
                } else if (isManager) {
                  const actionLabel = planActionLabel({ currentTier: subscription.tier, targetTier: plan.tier });
                  const isDowngradeToPersonal = plan.tier === 'tier_1';

                  actionNode = (
                    <Button
                      variant={actionLabel === translations['BillingPage.downgrade'] ? 'secondary' : 'primary'}
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        if (isDowngradeToPersonal) {
                          void handleOpenPortal();
                          return;
                        }
                        handleCheckoutTier(plan.tier as PaidTier);
                      }}
                      disabled={isDowngradeToPersonal && busyAction === 'portal'}
                    >
                      {actionLabel}
                    </Button>
                  );
                } else {
                  actionNode = <p className="mt-4 text-xs text-muted">{translations['BillingPage.memberReadOnly']}</p>;
                }

                return (
                  <article
                    key={plan.tier}
                    className={`rounded-lg border p-4 ${isCurrent ? 'border-primary bg-bg-sunken/40' : 'border-border bg-bg-base'}`}
                  >
                    <p className="text-sm text-muted">{plan.name}</p>
                    <p className="mt-1 text-sm text-subtle">{plan.description}</p>
                    {actionNode}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-border bg-bg-surface p-5">
          <h3 className="text-lg font-semibold text-base">{translations['BillingPage.usageTitle']}</h3>

          <div className="mt-4 space-y-4">
            {metrics.map((metric) => {
              const displayUsed = metric.formatter ? metric.formatter(metric.used) : String(metric.used);
              const isUnlimited = metric.limit === 'unlimited';
              let displayLimit = String(metric.limit);
              if (isUnlimited) {
                displayLimit = translations['BillingPage.unlimited'];
              } else if (metric.formatter) {
                displayLimit = metric.formatter(metric.limit);
              }
              const percentage = isUnlimited ? 0 : Math.min((metric.used / Math.max(metric.limit, 1)) * 100, 100);

              return (
                <div key={metric.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-base">{metric.label}</span>
                    <span className="text-muted">{displayUsed} / {displayLimit}</span>
                  </div>

                  {!isUnlimited && (
                    <div className="h-2 rounded-full bg-bg-sunken overflow-hidden">
                      <div
                        className={`h-full ${ratioClass(metric.used, metric.limit)}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-base">{translations['BillingPage.title']}</h1>
        <p className="text-sm text-muted">{translations['BillingPage.subtitle']}</p>
      </header>

      {checkoutMessage && (
        <div className="rounded-lg border border-border bg-bg-surface px-4 py-3 text-sm text-base">
          {checkoutMessage}
        </div>
      )}

      {bodyContent}
    </div>
  );
}
