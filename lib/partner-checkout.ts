export function buildTrialCheckoutSettings(hasCommunityCode: boolean, trialDays: number) {
  return {
    payment_method_collection: hasCommunityCode ? 'if_required' as const : 'always' as const,
    subscription_data: {
      trial_period_days: trialDays,
      trial_settings: {
        end_behavior: {
          missing_payment_method: hasCommunityCode ? 'cancel' as const : 'create_invoice' as const,
        },
      },
    },
  };
}
