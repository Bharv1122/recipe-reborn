import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

const recipeSnapshotSchema = z.object({
  title: z.string().trim().min(1).max(200),
  freshIngredients: z.array(z.string().trim().min(1).max(500)).min(1).max(150),
  instructions: z.array(z.string().trim().min(1).max(3000)).min(1).max(100),
});

const reportDetailsSchema = z.object({
  reason: z.enum(['unsafe', 'offensive', 'incorrect', 'allergen', 'other']),
  details: z.string().trim().max(500).optional(),
  recipe: recipeSnapshotSchema,
});

const reportSchema = z.discriminatedUnion('source', [
  reportDetailsSchema.extend({ source: z.literal('generated'), recipeId: z.undefined().optional() }),
  reportDetailsSchema.extend({ source: z.literal('saved'), recipeId: z.string().trim().min(1).max(100) }),
]);

const MAX_REPORTS_PER_HOUR = 10;

export async function POST(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const parsed = reportSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Choose a reason and try again.' }, { status: 400 });
    }

    const submittedSince = new Date(Date.now() - 60 * 60 * 1000);
    const recentReports = await prisma.recipeReport.count({
      where: { userId, createdAt: { gte: submittedSince } },
    });
    if (recentReports >= MAX_REPORTS_PER_HOUR) {
      return NextResponse.json({ error: 'Too many reports submitted. Please try again later.' }, { status: 429 });
    }

    const { recipe, details, ...report } = parsed.data;
    if (report.source === 'saved') {
      const ownedRecipe = await prisma.recipe.findFirst({
        where: { id: report.recipeId, userId },
        select: { id: true },
      });
      if (!ownedRecipe) return NextResponse.json({ error: 'Recipe not found.' }, { status: 404 });
    }

    await prisma.recipeReport.create({
      data: {
        userId,
        ...report,
        details: details || null,
        recipeTitle: recipe.title,
        recipeSnapshot: recipe,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Mobile recipe report error:', error);
    return NextResponse.json({ error: 'Unable to submit the report right now.' }, { status: 500 });
  }
}
