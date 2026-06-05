import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Button from '~/common/components/Button';
import Spinner from '~/common/components/Spinner';
import { createSubscriptionCheckout } from '../../api';
import translations from '../../translations/en.json';

const ALLOWED_TIERS = new Set(['tier_2', 'tier_3', 'tier_4']);

export default function SubscriptionCheckoutPage() {
  const { workspaceId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setError(translations['CheckoutPage.error']);
      return;
    }

    const tier = searchParams.get('tier') ?? 'tier_2';
    if (!ALLOWED_TIERS.has(tier)) {
      setError(translations['CheckoutPage.invalidTier']);
      return;
    }

    let active = true;

    const run = async () => {
      try {
        const response = await createSubscriptionCheckout({
          workspaceId,
          tier: tier as 'tier_2' | 'tier_3' | 'tier_4',
        });

        if (!active) return;
        globalThis.location.assign(response.data.url);
      } catch {
        if (!active) return;
        setError(translations['CheckoutPage.error']);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [searchParams, workspaceId]);

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-xl border border-border bg-bg-surface p-6 text-center space-y-4">
        <h1 className="text-xl font-semibold text-base">{translations['CheckoutPage.title']}</h1>

        {error ? (
          <>
            <p className="text-sm text-danger">{error}</p>
            <Link to={`/workspace/${workspaceId}/billing`}>
              <Button variant="secondary">{translations['CheckoutPage.back']}</Button>
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">{translations['CheckoutPage.subtitle']}</p>
            <div className="flex justify-center py-4">
              <Spinner size="lg" className="text-primary" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
