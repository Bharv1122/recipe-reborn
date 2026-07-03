'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard,
  Crown,
  TrendingUp,
  Calendar,
  AlertCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface UserData {
  subscriptionTier: string;
  subscriptionStatus: string;
  generationCount: number;
  lastGenerationReset: string;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

const TIER_LIMITS: Record<string, number> = {
  free: 10,
  premium: 100,
  pro: Infinity,
};

const TIER_INFO = {
  free: {
    name: 'Free',
    color: 'bg-gray-500',
    icon: '🆓',
  },
  premium: {
    name: 'Premium',
    color: 'bg-blue-500',
    icon: '⭐',
  },
  pro: {
    name: 'Pro',
    color: 'bg-purple-500',
    icon: '👑',
  },
};

export default function AccountPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [managingSubscription, setManagingSubscription] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchUserData();
    }
  }, [status, router]);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user/subscription');
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      } else {
        toast.error('Failed to load subscription data');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        toast.error('Failed to open billing portal');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      toast.error('Failed to open billing portal');
    } finally {
      setManagingSubscription(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error Loading Account</CardTitle>
            <CardDescription>Unable to load your account information.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')} className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tierInfo = TIER_INFO[userData.subscriptionTier as keyof typeof TIER_INFO] || TIER_INFO.free;
  const limit = TIER_LIMITS[userData.subscriptionTier] || 10;
  const usagePercent = limit === Infinity ? 0 : (userData.generationCount / limit) * 100;
  const daysUntilReset = userData.currentPeriodEnd
    ? Math.ceil(
        (new Date(userData.currentPeriodEnd).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : Math.ceil(
        30 -
          (new Date().getTime() - new Date(userData.lastGenerationReset).getTime()) /
            (1000 * 60 * 60 * 24)
      );

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">Account Dashboard</h1>
          <p className="text-emerald-50/90">Manage your subscription and usage</p>
        </div>

        {/* Subscription Status Card */}
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{tierInfo.icon}</div>
                <div>
                  <CardTitle className="text-2xl">
                    {tierInfo.name} Plan
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant={userData.subscriptionStatus === 'active' ? 'default' : 'destructive'}>
                      {userData.subscriptionStatus}
                    </Badge>
                  </div>
                </div>
              </div>
              {userData.subscriptionTier !== 'free' && (
                <Crown className={`h-10 w-10 ${tierInfo.color} text-white p-2 rounded-full`} />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Usage Statistics */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Monthly Recipe Generations</span>
                <span className="text-muted-foreground">
                  {userData.generationCount} / {limit === Infinity ? '∞' : limit}
                </span>
              </div>
              {limit !== Infinity && (
                <Progress value={usagePercent} className="h-2" />
              )}
            </div>

            {/* Billing Info */}
            {userData.currentPeriodEnd && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  Next billing date: {new Date(userData.currentPeriodEnd).toLocaleDateString()}
                  {' '}({daysUntilReset} days)
                </span>
              </div>
            )}

            {/* Limit Warning */}
            {userData.generationCount >= limit * 0.8 && limit !== Infinity && (
              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <p className="text-sm text-yellow-600">
                  You've used {Math.floor(usagePercent)}% of your monthly limit.
                  {userData.subscriptionTier === 'free' && ' Consider upgrading for more recipes!'}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              {userData.subscriptionTier === 'free' ? (
                <Link href="/pricing" className="flex-1">
                  <Button className="w-full" size="lg">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Upgrade Plan
                  </Button>
                </Link>
              ) : (
                <Button
                  onClick={handleManageSubscription}
                  disabled={managingSubscription || !userData.stripeCustomerId}
                  className="flex-1"
                  size="lg"
                  variant="outline"
                >
                  {managingSubscription ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-5 w-5" />
                  )}
                  Manage Subscription
                </Button>
              )}
              
              {userData.subscriptionTier === 'premium' && (
                <Link href="/pricing" className="flex-1">
                  <Button variant="default" className="w-full" size="lg">
                    <Crown className="mr-2 h-5 w-5" />
                    Upgrade to Pro
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plan Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Features</CardTitle>
            <CardDescription>Compare what's included in each tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg space-y-2">
                <div className="font-semibold">Free</div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>✓ 10 recipes/month</li>
                  <li>✓ Basic features</li>
                  <li>✓ Recipe saving</li>
                  <li>✓ Folder organization</li>
                </ul>
              </div>
              <div className="p-4 border-2 border-blue-500 rounded-lg space-y-2 bg-blue-500/5">
                <div className="font-semibold flex items-center gap-2">
                  <span>Premium</span>
                  <Badge>$9.99/mo</Badge>
                </div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>✓ 100 recipes/month</li>
                  <li>✓ All Free features</li>
                  <li>✓ Wine pairing</li>
                  <li>✓ Collections & PDFs</li>
                  <li>✓ Priority support</li>
                </ul>
              </div>
              <div className="p-4 border-2 border-purple-500 rounded-lg space-y-2 bg-purple-500/5">
                <div className="font-semibold flex items-center gap-2">
                  <span>Pro</span>
                  <Badge>$19.99/mo</Badge>
                </div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>✓ Unlimited recipes</li>
                  <li>✓ All Premium features</li>
                  <li>✓ Advanced AI features</li>
                  <li>✓ Bulk exports</li>
                  <li>✓ API access (coming soon)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/generator">
            <Card className="hover:bg-secondary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-lg">Generate Recipe</CardTitle>
                <CardDescription>Create a new recipe with AI</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/recipes">
            <Card className="hover:bg-secondary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-lg">My Recipes</CardTitle>
                <CardDescription>View your saved recipes</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/pricing">
            <Card className="hover:bg-secondary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-lg">View Plans</CardTitle>
                <CardDescription>See all available plans</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
