import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { loadKitchenRecipe } from '@/lib/kitchen/load';
import { KitchenDisplay } from '../_components/kitchen-display';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kitchen mode',
  description: 'Hands-free, step-by-step cooking with big text, timers and optional voice commands.',
  robots: { index: false, follow: false },
};

export default async function KitchenPage(props: { params: Promise<{ recipeId: string }> }) {
  const { recipeId } = await props.params;
  const result = await loadKitchenRecipe(recipeId);

  if (result.kind === 'login') {
    const callbackUrl = encodeURIComponent(`/kitchen/${recipeId}`);
    redirect(result.invalidSession ? `/login?error=SessionExpired&callbackUrl=${callbackUrl}` : `/login?callbackUrl=${callbackUrl}`);
  }
  if (result.kind === 'missing') notFound();

  return <KitchenDisplay recipe={result.recipe} exitHref={result.recipe.isSample ? '/' : '/recipes'} />;
}
