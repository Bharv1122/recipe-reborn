import assert from 'node:assert/strict';
import { findPartnerOffer, resolveSignupAttribution } from '../lib/partner-offers';
import { buildTrialCheckoutSettings } from '../lib/partner-checkout';

const typed = resolveSignupAttribution('Finnsters', 'fb');
assert.equal(typed.typedOffer?.slug, 'finnsters');
assert.equal(typed.signupSource, 'finnsters');
assert.equal(typed.typedOffer?.trialDays, 30);
assert.equal(typed.typedOffer?.fullPremium, true);

const linkOnly = resolveSignupAttribution(null, 'Finnsters');
assert.equal(linkOnly.typedOffer, null);
assert.equal(linkOnly.signupSource, null);

const staleStoredLink = resolveSignupAttribution('not-a-code', 'finnsters');
assert.equal(staleStoredLink.typedOffer, null);
assert.equal(staleStoredLink.signupSource, null);

const ordinaryCampaign = resolveSignupAttribution(null, 'Facebook');
assert.equal(ordinaryCampaign.typedOffer, null);
assert.equal(ordinaryCampaign.signupSource, 'facebook');

assert.equal(findPartnerOffer('  FINNSTERS  ')?.slug, 'finnsters');

const alexan = resolveSignupAttribution('  alexan30  ', 'facebook');
assert.equal(alexan.typedOffer?.slug, 'alexan30');
assert.equal(alexan.signupSource, 'alexan30');
assert.equal(alexan.typedOffer?.trialDays, 3);
assert.equal(alexan.typedOffer?.trialRecipeLimit, 100);
assert.equal(alexan.typedOffer?.fullPremium, true);

const alexanLinkOnly = resolveSignupAttribution(null, 'alexan30');
assert.equal(alexanLinkOnly.typedOffer, null);
assert.equal(alexanLinkOnly.signupSource, null);

const alexanCheckout = buildTrialCheckoutSettings(true, alexan.typedOffer!.trialDays);
assert.equal(alexanCheckout.payment_method_collection, 'if_required');
assert.equal(alexanCheckout.subscription_data.trial_period_days, 3);
assert.equal(
  alexanCheckout.subscription_data.trial_settings.end_behavior.missing_payment_method,
  'cancel',
);

const finnstersCheckout = buildTrialCheckoutSettings(true, typed.typedOffer!.trialDays);
assert.equal(finnstersCheckout.payment_method_collection, 'if_required');
assert.equal(finnstersCheckout.subscription_data.trial_period_days, 30);
assert.equal(
  finnstersCheckout.subscription_data.trial_settings.end_behavior.missing_payment_method,
  'cancel',
);

const standardCheckout = buildTrialCheckoutSettings(false, 7);
assert.equal(standardCheckout.payment_method_collection, 'always');
assert.equal(
  standardCheckout.subscription_data.trial_settings.end_behavior.missing_payment_method,
  'create_invoice',
);

console.log('Partner-code verification passed. Finnsters and ALEXAN30 are separate code-only offers.');
