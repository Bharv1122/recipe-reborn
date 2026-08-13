'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Mail, MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/support';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data?.error ?? 'Something went wrong');
        return;
      }

      // The API answers identically for known and unknown addresses, so the
      // confirmation screen has to stay vague too — naming whether the account
      // exists here would undo that.
      setSent(true);
    } catch (error) {
      console.error('Password reset request error:', error);
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <Card className="border-0 shadow-xl">
        <CardContent className="pt-6 text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MailCheck className="h-7 w-7 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h3>
          <p className="text-sm text-gray-600 mb-4">
            If an account exists for <span className="font-medium">{email}</span>, we've
            sent a link to reset the password. It expires in an hour.
          </p>
          <p className="text-xs text-gray-500">
            Nothing arrived? Check your spam folder, or email us at{' '}
            <a href={SUPPORT_MAILTO} className="text-emerald-700 hover:underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e?.target?.value ?? '')}
                required
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending link...
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
