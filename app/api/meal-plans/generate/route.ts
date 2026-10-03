import { NextResponse } from 'next/server';

// Old clients assume a saved plan ID. Never silently save or return a draft in
// that contract: an update is required before generating another plan.
export async function POST() {
  return NextResponse.json({ error: 'Update required', message: 'Update Recipe Reborn to preview meal plans and save only the meals you choose.' }, { status: 426 });
}
