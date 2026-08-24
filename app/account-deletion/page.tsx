import Link from 'next/link';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/support';

export default function AccountDeletionPage() {
  return <div className="min-h-screen"><div className="max-w-3xl mx-auto px-4 sm:px-6 py-12"><div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
    <h1 className="text-3xl font-bold text-gray-900">Delete your Recipe Reborn account</h1>
    <p className="text-gray-700">In the Recipe Reborn mobile app, open <strong>Account → Delete account</strong>, enter your password, type <strong>DELETE</strong>, and confirm.</p>
    <p className="text-gray-700">This permanently removes your profile, recipes, collections, meal plans, shopping lists, confirmed pantry inventory, and app sessions. Active Stripe subscriptions must be canceled from Account before deletion so billing cannot continue after the account is gone.</p>
    <p className="text-gray-700">If you cannot access the app, email <a className="text-emerald-700 hover:underline" href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> from the address on the account and request deletion. We may need to verify account ownership.</p>
    <p className="text-gray-700">Records required for fraud prevention, billing reconciliation, tax, or legal obligations may be retained only as required.</p>
    <Link href="/privacy" className="text-emerald-700 hover:underline">Read the Privacy Policy</Link>
  </div></div></div>;
}
