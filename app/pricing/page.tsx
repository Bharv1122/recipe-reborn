'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, Crown, Zap, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface PricingTier {
  name: string;
  price: string;
  interval?: string;
  priceId: string | null;
  description: string;
  features: string[];
  icon: React.ReactNode;
  popular?: boolean;
  badge?: string;
  buttonText: string;
}

const pricingTiers: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    priceId: null,
    description: 'Perfect for trying out RecipeReborn',
    features: [
      '3 recipe generations per month',
      'Basic dietary customizations',
      'Save up to 20 recipes',
      'Search and filter recipes',
      'Personal notes and ratings',
    ],
    icon: <Sparkles className="h-6 w-6" />,
    buttonText: 'Get Started Free',
  },
  {
    name: 'Premium',
    price: '$9.99',
    interval: 'month',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID || '',
    description: 'For home cooks who love healthy recipes',
    features: [
      'Unlimited recipe generations',
      'All dietary customizations',
      'Unlimited recipe storage',
      'Recipe folders & organization',
      'Wine pairing suggestions',
      'Ingredient information',
      'Import recipes from URLs',
      'Share recipes publicly',
    ],
    icon: <Crown className="h-6 w-6" />,
    popular: true,
    buttonText: 'Start Premium',
  },
  {
    name: 'Premium Yearly',
    price: '$99',
    interval: 'year',
    priceId: process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID || '',
    description: 'Everything in Premium — pay once, save all year',
    features: [
      'Everything in Premium',
      'Unlimited recipe generations',
      'All dietary customizations',
      'Unlimited recipe storage',
      'Wine pairing suggestions',
      'Import recipes from URLs',
      'Billed once per year',
    ],
    icon: <Zap className="h-6 w-6" />,
    badge: 'Save 17%',
    buttonText: 'Start Premium Yearly',
  },
];

export default function PricingPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSubscribe = async (tier: PricingTier) => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (tier.priceId === null) {
      // Free tier - just redirect to signup or dashboard
      router.push(session ? '/generator' : '/signup');
      return;
    }

    setLoadingTier(tier.name);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: tier.priceId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="pt-20 pb-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-emerald-50/90 max-w-2xl mx-auto">
            Transform processed ingredients into fresh, healthy recipes with AI-powered recipe generation
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pricingTiers.map((tier) => (
            <Card
              key={tier.name}
              className={`relative shadow-xl border-2 transition-all hover:shadow-2xl ${
                tier.popular
                  ? 'border-emerald-500 transform scale-105'
                  : tier.badge
                  ? 'border-orange-500'
                  : 'border-gray-200'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-emerald-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}
              {tier.badge && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    {tier.badge}
                  </span>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-orange-500 text-white mb-4 mx-auto">
                  {tier.icon}
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  {tier.name}
                </CardTitle>
                <div className="mt-4">
                  <span className="text-5xl font-bold text-gray-900">
                    {tier.price}
                  </span>
                  {tier.interval && (
                    <span className="text-gray-600 ml-2">/{tier.interval}</span>
                  )}
                </div>
                <p className="text-gray-600 mt-2">{tier.description}</p>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  onClick={() => handleSubscribe(tier)}
                  disabled={loadingTier === tier.name}
                  className={`w-full text-white ${
                    tier.popular
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : tier.badge
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-gray-900 hover:bg-gray-800'
                  }`}
                >
                  {loadingTier === tier.name ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    tier.buttonText
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I cancel my subscription anytime?
              </h3>
              <p className="text-gray-600">
                Yes! You can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your billing period.
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600">
                We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe.
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I upgrade or downgrade my plan?
              </h3>
              <p className="text-gray-600">
                Absolutely! You can upgrade or downgrade your plan at any time. Changes will be prorated and reflected in your next billing cycle.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Is there a free trial?
              </h3>
              <p className="text-gray-600">
                Our Free tier gives you access to core features without any credit card required. You can upgrade to Premium (monthly or yearly) anytime to unlock more features.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-emerald-600 to-orange-500 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl font-bold mb-4">
            Start Creating Healthy Recipes Today
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of home cooks transforming processed foods into fresh, nutritious meals
          </p>
          <Button
            onClick={() => router.push('/signup')}
            size="lg"
            className="bg-white text-emerald-600 hover:bg-gray-100 text-lg px-8 py-6"
          >
            Get Started Free
          </Button>
        </div>
      </div>
    </div>
  );
}
