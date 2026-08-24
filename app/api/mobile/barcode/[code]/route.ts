import { NextResponse } from 'next/server';
import { InvalidBarcodeError, lookupBarcode } from '@/lib/barcode-lookup';
import { MobileAuthError, requireMobileUserId } from '@/lib/mobile-auth';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { code: string } }) {
  try {
    const userId = requireMobileUserId(request);
    const limited = await rateLimit(`mobile-barcode:${userId}`, 30, 60);
    if (!limited.success) return NextResponse.json({ error: 'Too many scans. Try again shortly.' }, { status: 429 });
    return NextResponse.json(await lookupBarcode(params.code));
  } catch (error) {
    if (error instanceof MobileAuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error instanceof InvalidBarcodeError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Mobile barcode lookup error:', error);
    return NextResponse.json({ error: 'Failed to look up barcode.' }, { status: 500 });
  }
}
