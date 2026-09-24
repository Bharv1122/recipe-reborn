'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ChefHat, Loader2, Send, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

type Message = { role: 'user' | 'assistant'; content: string };

export function AskChef() {
  const { data: session, status } = useSession();
  // Changing accounts unmounts the old conversation and aborts its request.
  return <ChefConversation key={session?.user?.id ?? 'guest'} signedIn={status === 'authenticated'} loading={status === 'loading'} />;
}

function ChefConversation({ signedIn, loading }: { signedIn: boolean; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef<AbortController | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => {
    const pending = requestRef.current;
    requestRef.current = null;
    pending?.abort();
  }, []);
  useEffect(() => {
    if (open && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [messages, busy, open]);
  useEffect(() => {
    if (open && !busy) inputRef.current?.focus();
  }, [open, busy]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!signedIn || !question || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError('');
    const pending: Message = { role: 'user', content: question };
    const next = [...messages, pending].slice(-39);
    setMessages(next);
    setDraft('');
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch('/api/chef-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ messages: next.slice(-20).map(message => ({
          ...message, content: message.content.slice(0, 2000),
        })) }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(response.status === 401
        ? 'Please sign in again to ask Chef.' : 'Chef could not answer right now. Please try again.');
      const answer = data?.message?.content;
      if (typeof answer !== 'string' || !answer.trim()) throw new Error('Chef returned no answer. Please try again.');
      if (requestRef.current !== controller) return;
      const reply: Message = { role: 'assistant', content: answer.trim() };
      setMessages([...next, reply].slice(-40));
    } catch (failure) {
      if (requestRef.current !== controller) return;
      // Keep the question ready for retry without duplicating it in history.
      setMessages(messages);
      setDraft(question);
      setError(controller.signal.aborted ? 'Chef took too long to answer. Please try again.'
        : failure instanceof Error ? failure.message : 'Could not connect. Please try again.');
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(false);
      }
    }
  }

  function clearConversation() {
    requestRef.current?.abort();
    requestRef.current = null;
    setBusy(false);
    setMessages([]);
    setError('');
    setDraft('');
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Ask Chef" className="fixed right-4 z-40 flex min-h-12 items-center gap-2 rounded-full border-2 border-white bg-emerald-800 px-5 py-3 font-semibold text-white shadow-lg hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 print:hidden"
          style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <ChefHat className="h-5 w-5" aria-hidden="true" /> Ask Chef
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={12} collisionPadding={16}
        aria-labelledby="ask-chef-heading"
        onOpenAutoFocus={event => { if (signedIn) { event.preventDefault(); inputRef.current?.focus(); } }}
        className="flex w-[min(24rem,calc(100vw-2rem))] max-h-[min(36rem,calc(100dvh-7rem))] flex-col overflow-hidden rounded-2xl border-emerald-200 bg-white p-0 text-gray-900 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-emerald-800 px-4 py-3 text-white">
          <div className="flex items-center gap-2"><ChefHat className="h-5 w-5" aria-hidden="true" /><h2 id="ask-chef-heading" className="font-semibold">Ask Chef</h2></div>
          <button type="button" aria-label="Close Ask Chef" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/15 focus-visible:outline focus-visible:outline-2"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        {loading ? <p className="p-5" role="status">Checking your account…</p> : !signedIn ? (
          <div className="space-y-4 p-5">
            <p>Need a substitution, meal idea, or cooking tip? Sign in to ask Chef.</p>
            <Button asChild className="w-full bg-emerald-800 hover:bg-emerald-900"><Link href="/login" onClick={() => setOpen(false)}>Sign in to ask Chef</Link></Button>
          </div>
        ) : (
          <>
            <div ref={historyRef} role="log" aria-label="Conversation with Chef" aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
              {!messages.length ? <div className="space-y-3 py-2 text-sm">
                <p className="font-medium">What can I help you cook?</p>
                <p className="text-gray-600">Ask about ingredients, substitutions, timing, or meal ideas. Your saved allergies and food preferences apply.</p>
                <button type="button" onClick={() => { setDraft('What can I cook with the ingredients I have?'); inputRef.current?.focus(); }} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-emerald-900 hover:bg-emerald-100">Help me use what I have</button>
              </div> : messages.map((message, index) => (
                <div key={index} className={`rounded-xl p-3 text-sm ${message.role === 'user' ? 'ml-6 bg-emerald-50' : 'mr-2 bg-gray-100'}`}>
                  <p className="mb-1 font-semibold">{message.role === 'user' ? 'You' : 'Chef'}</p>
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              ))}
              {busy ? <p className="flex items-center gap-2 text-sm text-gray-600" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Chef is thinking…</p> : null}
            </div>
            <form onSubmit={send} className="shrink-0 space-y-2 border-t p-3">
              {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
              <label htmlFor="ask-chef-question" className="sr-only">Your cooking question</label>
              <div className="flex items-end gap-2">
                <textarea id="ask-chef-question" ref={inputRef} value={draft} maxLength={2000} rows={2} disabled={busy}
                  onChange={event => setDraft(event.target.value)} placeholder="Ask a cooking question…"
                  onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
                  className="min-w-0 flex-1 resize-none rounded-xl border border-gray-300 p-2 text-base focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 disabled:opacity-60" />
                <Button type="submit" aria-label="Send question" disabled={busy || !draft.trim()} className="h-11 bg-emerald-800 px-3 hover:bg-emerald-900"><Send className="h-4 w-4" aria-hidden="true" /></Button>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                <span>AI cooking help · Check important details.</span>
                <button type="button" onClick={clearConversation} disabled={!messages.length && !draft && !error} className="shrink-0 rounded px-1 py-2 text-emerald-800 underline disabled:hidden">Clear chat</button>
              </div>
            </form>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
