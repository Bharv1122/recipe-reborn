'use client';

import { useEffect, useState } from 'react';

export type WakeLockStatus = 'unsupported' | 'pending' | 'on' | 'denied';

type Sentinel = { release(): Promise<void>; addEventListener(type: 'release', cb: () => void): void };
type WakeLockNav = Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } };

/**
 * Keeps the screen on while cooking. Browsers may refuse (battery saver,
 * not visible, no user gesture yet, iframe policy) — that is fine: we report
 * the status and retry whenever the page becomes visible again.
 */
export function useWakeLock(enabled = true): WakeLockStatus {
  const [status, setStatus] = useState<WakeLockStatus>('pending');

  useEffect(() => {
    if (!enabled) return;
    const nav = navigator as WakeLockNav;
    if (!nav.wakeLock) {
      setStatus('unsupported');
      return;
    }
    let sentinel: Sentinel | null = null;
    let disposed = false;

    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible' || sentinel) return;
      try {
        const s = await nav.wakeLock!.request('screen');
        if (disposed) return void s.release().catch(() => {});
        sentinel = s;
        setStatus('on');
        s.addEventListener('release', () => {
          sentinel = null;
          if (!disposed) setStatus('pending');
        });
      } catch {
        setStatus('denied');
      }
    };

    const onVisible = () => void acquire();
    // Some browsers only grant the lock after a user gesture, so retry on the first tap too.
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('pointerdown', onVisible);
    void acquire();

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('pointerdown', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);

  return status;
}
