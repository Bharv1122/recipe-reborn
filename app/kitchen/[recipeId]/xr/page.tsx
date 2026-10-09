import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { loadKitchenRecipe } from '@/lib/kitchen/load';
import { XRKitchenLoader } from '../../_components/xr-kitchen-loader';
import '../../kitchen.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kitchen mode for Meta Quest',
  description: 'Cook hands-free in passthrough: a floating step panel, ingredient checklist and timers you control with pinch and poke.',
  robots: { index: false, follow: false },
};

export default async function KitchenXRPage(props: { params: Promise<{ recipeId: string }> }) {
  const { recipeId } = await props.params;
  const result = await loadKitchenRecipe(recipeId);

  if (result.kind === 'login') {
    const callbackUrl = encodeURIComponent(`/kitchen/${recipeId}/xr`);
    redirect(result.invalidSession ? `/login?error=SessionExpired&callbackUrl=${callbackUrl}` : `/login?callbackUrl=${callbackUrl}`);
  }
  if (result.kind === 'missing') notFound();

  return <XRKitchenLoader recipe={result.recipe} exitHref={`/kitchen/${result.recipe.id}`} />;
}
