// Singleton for loading Stripe.js. loadStripe is called once and the promise
// is reused across all components to avoid loading the script multiple times.
import { loadStripe } from '@stripe/stripe-js';
import config from '~/config';

// WHY: loadStripe must be called outside of a React component/render to avoid
// recreating the Stripe instance on every render.
const stripePromise = config.STRIPE_PUBLIC_KEY
  ? loadStripe(config.STRIPE_PUBLIC_KEY)
  : null;

export default stripePromise;
