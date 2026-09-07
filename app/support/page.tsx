import Link from 'next/link';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/support';

export default function SupportPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          <h1 className="text-3xl font-bold text-gray-900">Recipe Reborn support</h1>
          <p className="text-gray-700">
            Need help with your account, recipes, camera access, meal plans, shopping lists, or subscription status?
          </p>
          <p className="text-gray-700">
            Email <a className="text-emerald-700 hover:underline" href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> and include a short description of what happened. Do not send your password, payment details, or sensitive health information.
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/forgot-password" className="text-emerald-700 hover:underline">Reset your password</Link>
            <Link href="/account-deletion" className="text-emerald-700 hover:underline">Delete your account</Link>
            <Link href="/privacy" className="text-emerald-700 hover:underline">Read the Privacy Policy</Link>
            <Link href="/terms" className="text-emerald-700 hover:underline">Read the Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
