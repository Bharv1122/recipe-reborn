'use client';

import { useState } from 'react';
import { Loader2, Ticket, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import toast from 'react-hot-toast';

/**
 * "Have a community code?" box for an existing, signed-in account.
 *
 * New signups can type the code on the signup form instead; this covers people
 * who already have an account when the code reaches them.
 */
export function PartnerCodeEntry({ onRedeemed }: { onRedeemed?: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);

    try {
      const res = await fetch('/api/partner-offer/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data?.error ?? 'Something went wrong');
        return;
      }

      setDone(data.message);
      toast.success(data.message);
      onRedeemed?.();
    } catch (error) {
      console.error('Redeem error:', error);
      toast.error('Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className="mx-auto mb-8 flex max-w-md items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
        <Check className="h-4 w-4 flex-shrink-0" />
        {done}
      </p>
    );
  }

  if (!open) {
    return (
      <div className="mb-8 text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-white/90 underline underline-offset-4 hover:text-white"
        >
          Have a community code?
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mb-8 max-w-md rounded-xl border border-white/40 bg-white/95 p-4 shadow-lg"
    >
      <Label htmlFor="community-code" className="flex items-center gap-2 text-gray-900">
        <Ticket className="h-4 w-4 text-emerald-600" />
        Community code
      </Label>
      <div className="mt-2 flex gap-2">
        <Input
          id="community-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter community code"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={busy}
        />
        <Button
          type="submit"
          disabled={busy || !code.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
        </Button>
      </div>
    </form>
  );
}
