import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Server-side transcription is temporarily disabled while migrating off the
// old Whisper endpoint. The voice UI should prefer the browser's built-in
// SpeechRecognition; this route returns 501 so the fallback fails gracefully.
// Phase 3a replaces this with Gemini audio transcription.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        'Voice transcription is being upgraded. Please use Chrome, Edge, or Safari for built-in voice input, or type your ingredients instead.',
    },
    { status: 501 }
  );
}
