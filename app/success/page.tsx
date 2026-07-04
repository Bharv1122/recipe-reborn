import Link from 'next/link';
import { ChefHat, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center animate-scaleIn">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-emerald-600" />
          </div>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-gray-600">
              Thank you for subscribing to RecipeReborn Premium. Your account has been upgraded.
            </p>
          </div>

          {/* What's Next */}
          <div className="bg-gradient-to-r from-emerald-50 to-orange-50 rounded-lg p-6 mb-6 text-left">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <ChefHat className="h-5 w-5 text-emerald-600 mr-2" />
              What's Next?
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="text-emerald-600 mr-2">✓</span>
                <span>Access all premium features immediately</span>
              </li>
              <li className="flex items-start">
                <span className="text-emerald-600 mr-2">✓</span>
                <span>Generate unlimited fresh recipes</span>
              </li>
              <li className="flex items-start">
                <span className="text-emerald-600 mr-2">✓</span>
                <span>Enjoy advanced customization options</span>
              </li>
              <li className="flex items-start">
                <span className="text-emerald-600 mr-2">✓</span>
                <span>Check your email for the receipt</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link href="/generator" className="block">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                Start Generating Recipes
              </Button>
            </Link>
            <Link href="/recipes" className="block">
              <Button variant="outline" className="w-full">
                View My Recipes
              </Button>
            </Link>
          </div>

          {/* Support */}
          <p className="text-xs text-gray-500 mt-6">
            Need help? Contact us through our support channels.
          </p>
        </div>
      </div>
    </div>
  );
}
