import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const recipeSnapshotSchema = z.object({
  title: z.string().trim().min(1).max(200),
  freshIngredients: z.array(z.string().trim().min(1).max(500)).min(1).max(150),
  instructions: z.array(z.string().trim().min(1).max(3000)).min(1).max(100),
});

const reportDetailsSchema = z.object({
  reason: z.enum(['unsafe', 'offensive', 'incorrect', 'allergen', 'other']),
  details: z.string().trim().max(500).optional(),
});

const reportSchema = z.discriminatedUnion('source', [
  reportDetailsSchema.extend({ source: z.literal('generated'), recipe: recipeSnapshotSchema }).strict(),
  // Older clients may include a snapshot; saved reports always use the owned
  // server record so client-supplied contents cannot replace the evidence.
  reportDetailsSchema.extend({ source: z.literal('saved'), recipeId: z.string().trim().min(1).max(100), recipe: recipeSnapshotSchema.optional() }).strict(),
  reportDetailsSchema.extend({ source: z.literal('chat'), message: z.string().trim().min(1).max(16000) }).strict(),
]);

const MAX_REPORTS_PER_HOUR = 10;
const MAX_BODY_BYTES = 128 * 1024;

class ReportError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function readReportBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new ReportError(413, 'This report is too large. Try reporting a shorter response.');
  }
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new ReportError(413, 'This report is too large. Try reporting a shorter response.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ReportError(400, 'Choose a reason and try again.'); }
}

export async function POST(request: Request) {
  try {
    const userId = requireMobileUserId(request);
    const [userLimit, globalLimit] = await Promise.all([
      rateLimit(`mobile-report:${userId}`, 20, 60),
      rateLimit('mobile-reports:global', 1000, 60),
    ]);
    if (!userLimit.success || !globalLimit.success) {
      throw new ReportError(429, 'Too many report requests. Please try again in a minute.');
    }
    const parsed = reportSchema.safeParse(await readReportBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Choose a reason and try again.' }, { status: 400 });
    }

    const report = parsed.data;
    const stored = await prisma.$transaction(async (tx) => {
      // Serialize the durable count+insert for this account across instances.
      // This also rejects access tokens whose account has since been deleted.
      const users = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      if (!users.length) throw new MobileAuthError();
      const recentReports = await tx.recipeReport.count({
        where: { userId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      });
      if (recentReports >= MAX_REPORTS_PER_HOUR) {
        throw new ReportError(429, 'You have sent 10 reports in the past hour. Please try again later.');
      }

      let snapshot;
      let title;
      if (report.source === 'saved') {
        const ownedRecipe = await tx.recipe.findFirst({
          where: { id: report.recipeId, userId },
          select: { title: true, freshIngredients: true, instructions: true },
        });
        if (!ownedRecipe) throw new ReportError(404, 'Recipe not found.');
        snapshot = ownedRecipe;
        title = ownedRecipe.title;
      } else if (report.source === 'chat') {
        snapshot = { kind: 'chat', content: report.message };
        title = 'AI Chef response';
      } else {
        snapshot = report.recipe;
        title = report.recipe.title;
      }

      return tx.recipeReport.create({
        data: {
          userId, source: report.source, reason: report.reason,
          recipeId: report.source === 'saved' ? report.recipeId : null,
          details: report.details || null, recipeTitle: title, recipeSnapshot: snapshot,
        },
        select: { id: true },
      });
    });

    return NextResponse.json({ ok: true, id: stored.id }, { status: 201 });
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof ReportError) return NextResponse.json({ error: error.message }, { status: error.status });
    // Report contents can contain private information; never log the payload.
    console.error('Mobile recipe report persistence failed.');
    return NextResponse.json({ error: 'Unable to submit the report right now.' }, { status: 500 });
  }
}
