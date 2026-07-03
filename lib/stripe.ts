import Stripe from 'stripe';

// Placeholder key keeps builds/dev working before Stripe is configured;
// any real Stripe call without STRIPE_SECRET_KEY set will fail loudly.
export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
  {
    apiVersion: '2026-02-25.clover',
    typescript: true,
  }
);

// Stripe pricing configurations (can be expanded in Phase 3)
export const PRICING_PLANS = {
  free: {
    name: 'Free',
    price: 0,
    features: [
      'Generate up to 3 recipes per month',
      'Save up to 20 recipes',
      'Basic recipe customization',
    ],
  },
  premium: {
    name: 'Premium',
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID, // To be set in .env
    price: 9.99,
    features: [
      'Unlimited recipe generation',
      'Unlimited recipe storage',
      'Advanced customization options',
      'Wine pairing suggestions',
      'Recipe import from URLs',
      'Priority support',
    ],
  },
  premiumYearly: {
    name: 'Premium Yearly',
    priceId: process.env.STRIPE_YEARLY_PRICE_ID, // To be set in .env
    price: 99,
    features: [
      'Everything in Premium',
      'Save 17% vs. monthly billing',
      'Billed once per year',
    ],
  },
  // Legacy tier — grandfathered subscribers only; no longer sold on the pricing page.
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID, // To be set in .env
    price: 19.99,
    features: [
      'Everything in Premium',
      'OCR ingredient scanning',
      'Voice interaction',
      'Social media sharing',
      'Custom recipe folders',
      'Priority AI processing',
    ],
  },
};
