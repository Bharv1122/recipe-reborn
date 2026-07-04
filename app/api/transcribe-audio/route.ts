import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { AI_CHAT_URL, AI_API_KEY, MODEL_SMART } from '@/lib/ai';

export const dynamic = 'force-dynamic';

// 10 MB is plenty for a voice clip (~10 min of opus audio) and keeps the
// base64 payload to Gemini well under request limits.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

// The client labels every recording "audio/webm", but the real container
// varies by browser (Firefox's MediaRecorder emits Ogg). Sniff the magic
// bytes so Gemini gets the true format.
function detectAudioFormat(bytes: Uint8Array, fallbackMime: string): string {
  if (bytes.length >= 4) {
    // "OggS"
    if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return 'ogg';
    }
    // EBML header (WebM/Matroska)
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      return 'webm';
    }
    // "RIFF" (WAV)
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      return 'wav';
    }
    // "fLaC"
    if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
      return 'flac';
    }
    // ID3 tag or MPEG frame sync (MP3)
    if (
      (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    ) {
      return 'mp3';
    }
    // "ftyp" at offset 4 (MP4/M4A)
    if (
      bytes.length >= 8 &&
      bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
    ) {
      return 'mp4';
    }
  }

  const mime = fallbackMime.toLowerCase();
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mp3') || mime.includes('mpeg')) return 'mp3';
  if (mime.includes('mp4')) return 'mp4';
  return 'webm';
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!AI_API_KEY) {
      console.error('Transcription error: GEMINI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Voice transcription is not available right now. Please type your ingredients instead.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    if (audioFile.size === 0) {
      return NextResponse.json(
        { error: 'The recording was empty. Please try again.' },
        { status: 400 }
      );
    }

    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: 'Recording is too long. Please keep it under a few minutes.' },
        { status: 413 }
      );
    }

    const audioBytes = new Uint8Array(await audioFile.arrayBuffer());
    const format = detectAudioFormat(audioBytes, audioFile.type ?? '');
    const base64Audio = Buffer.from(audioBytes).toString('base64');

    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL_SMART,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcribe this audio recording of a person speaking (likely listing recipe ingredients or making a cooking request). Return ONLY the verbatim transcription with no commentary, labels, or quotation marks. If there is no discernible speech, return nothing.',
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: base64Audio,
                  format,
                },
              },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini transcription API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to transcribe audio. Please try again or type your ingredients.' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim() ?? '';

    return NextResponse.json({ text }, { status: 200 });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
