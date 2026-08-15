#!/usr/bin/env node
/**
 * Creates the "Finnsters" coupon and its promotion code in Stripe.
 *
 * Run it yourself — your secret key stays on your machine.
 *
 *   TEST MODE (do this first):
 *     STRIPE_SECRET_KEY=sk_test_xxx node scripts/create-finnsters-coupon.js
 *
 *   LIVE MODE (only after the test run looks right):
 *     STRIPE_SECRET_KEY=sk_live_xxx node scripts/create-finnsters-coupon.js --live
 *
 * A live key without --live is refused, so a stray paste cannot create real
 * billing objects by accident.
 *
 * WHAT IT CREATES
 *   Coupon          100% off, repeating, 1 month  (id/name: Finnsters)
 *   Promotion code  FINNSTERS  (what a customer types at checkout)
 *
 * WHAT A STRIPE COUPON ACTUALLY DOES — read before sharing the code:
 *
 *   1. It is a DISCOUNT, not a trial extension. This one waives the first
 *      monthly invoice. It does not change trial_period_days.
 *
 *   2. It STACKS on the 7-day trial that create-checkout-session already
 *      sets, so a customer entering the code gets 7 days trial + 1 free
 *      month ≈ 37 days, and their first charge lands on a date that matches
 *      nothing you advertised. Decide what you want here before promoting it.
 *
 *   3. Stripe's promo-code box is inside Checkout, and subscription Checkout
 *      COLLECTS A CARD by default. A coupon alone does not give you the
 *      "no credit card" promise.
 *
 * Nothing is deleted or modified: if the coupon or code already exists the
 * script reports it and exits without touching it.
 */

const COUPON_ID = 'Finnsters';
const PROMO_CODE = 'FINNSTERS';
const PERCENT_OFF = 100;
const DURATION_IN_MONTHS = 1;

// null = unlimited. Set a number to cap how many people can redeem it.
const MAX_REDEMPTIONS = null;

const key = process.env.STRIPE_SECRET_KEY;
const wantsLive = process.argv.includes('--live');

if (!key) {
  console.error('STRIPE_SECRET_KEY is not set.\n');
  console.error('  STRIPE_SECRET_KEY=sk_test_xxx node scripts/create-finnsters-coupon.js');
  process.exit(1);
}

const isLiveKey = key.startsWith('sk_live_');

if (isLiveKey && !wantsLive) {
  console.error('Refusing to run: that is a LIVE key and --live was not passed.');
  console.error('Run it in test mode first, then re-run with --live if it looks right.');
  process.exit(1);
}

if (!isLiveKey && wantsLive) {
  console.error('--live was passed but the key is a test key. Nothing to worry about, but check which key you meant.');
  process.exit(1);
}

const MODE = isLiveKey ? 'LIVE' : 'TEST';

async function stripe(path, method = 'GET', form) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${body?.error?.message ?? 'unknown error'}`);
  }
  return body;
}

(async () => {
  console.log(`\n=== Stripe ${MODE} MODE ===\n`);

  // --- Coupon -------------------------------------------------------------
  let coupon = null;
  try {
    coupon = await stripe(`/coupons/${encodeURIComponent(COUPON_ID)}`);
    console.log(`Coupon "${COUPON_ID}" already exists — leaving it untouched.`);
    console.log(
      `  ${coupon.percent_off}% off, ${coupon.duration}` +
        (coupon.duration_in_months ? ` ${coupon.duration_in_months} month(s)` : '') +
        `, valid=${coupon.valid}`
    );
  } catch {
    coupon = await stripe('/coupons', 'POST', {
      id: COUPON_ID,
      name: COUPON_ID,
      percent_off: PERCENT_OFF,
      duration: 'repeating',
      duration_in_months: DURATION_IN_MONTHS,
    });
    console.log(`Created coupon "${coupon.id}" — ${PERCENT_OFF}% off for ${DURATION_IN_MONTHS} month.`);
  }

  // --- Promotion code -----------------------------------------------------
  const existing = await stripe(`/promotion_codes?code=${encodeURIComponent(PROMO_CODE)}&limit=1`);

  if (existing.data.length > 0) {
    const pc = existing.data[0];
    console.log(`Promotion code "${pc.code}" already exists — leaving it untouched.`);
    console.log(`  active=${pc.active}  redeemed=${pc.times_redeemed}  coupon=${pc.coupon.id}`);
  } else {
    const created = await stripe('/promotion_codes', 'POST', {
      coupon: coupon.id,
      code: PROMO_CODE,
      ...(MAX_REDEMPTIONS ? { max_redemptions: MAX_REDEMPTIONS } : {}),
    });
    console.log(`Created promotion code "${created.code}".`);
  }

  console.log(`\nCustomers type: ${PROMO_CODE}  (Stripe matches it case-insensitively)`);
  console.log('allow_promotion_codes is already true in create-checkout-session,');
  console.log('so the box is on the checkout page with no deploy needed.\n');
  console.log('Reminder: this waives the first monthly invoice. It stacks with the');
  console.log('existing 7-day trial (~37 days total) and does NOT remove the card');
  console.log('requirement at checkout. See the header of this file.\n');
})().catch((err) => {
  console.error('\nFailed:', err.message, '\n');
  process.exit(1);
});
