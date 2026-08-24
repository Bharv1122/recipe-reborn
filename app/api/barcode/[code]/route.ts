import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { InvalidBarcodeError, lookupBarcode } from '@/lib/barcode-lookup';

export const dynamic = 'force-dynamic';

// GET /api/barcode/[code] - Look up a packaged product by barcode via OpenFoodFacts
export async function GET(req: NextRequest, props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(await lookupBarcode(params?.code ?? ''));
  } catch (error) {
    if (error instanceof InvalidBarcodeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Barcode lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to look up barcode' },
      { status: 500 }
    );
  }
}
