'use client';

import dynamic from 'next/dynamic';
import type { KitchenRecipe } from '@/lib/kitchen/engine';

// three.js, @react-three/* and the XR runtime load only on this route, only in
// the browser, and only after the page shell is up — other pages never grow.
const XRKitchen = dynamic(() => import('./xr/xr-kitchen'), {
  ssr: false,
  loading: () => (
    <div className="rx-root">
      <div className="rx-loading" role="status">
        Loading the 3D kitchen…
      </div>
    </div>
  ),
});

export function XRKitchenLoader(props: { recipe: KitchenRecipe; exitHref: string }) {
  return <XRKitchen {...props} />;
}
