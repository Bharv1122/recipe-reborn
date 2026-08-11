import Link from 'next/link';
import { Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AuthenticatedPageLoading({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="flex items-center gap-3 rounded-lg bg-white/95 px-5 py-4 shadow-lg" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" aria-hidden="true" />
        <p className="font-medium text-gray-900">Loading {label}…</p>
      </div>
    </div>
  );
}

export function SessionRequiredState() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Your session needs to be refreshed</CardTitle>
          <CardDescription>
            Sign in again to continue. Your recipes and account data have not been changed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">
              <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
              Sign in
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
