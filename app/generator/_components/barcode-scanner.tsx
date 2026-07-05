'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ScanBarcode, Camera, StopCircle, Search, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
  onIngredientsExtracted?: (ingredients: string, productName?: string) => void;
}

// html5-qrcode renders its camera feed into this element
const SCANNER_REGION_ID = 'barcode-scanner-region';
// Separate always-mounted element for decoding uploaded barcode photos
const FILE_SCAN_REGION_ID = 'barcode-file-scan-region';

export function BarcodeScanner({ onIngredientsExtracted }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isDecodingImage, setIsDecodingImage] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Guards against html5-qrcode firing the success callback repeatedly
  // for the same barcode while the camera is still running
  const hasScannedRef = useRef(false);

  useEffect(() => {
    return () => {
      // Release the camera if the user switches tabs mid-scan
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setIsScanning(false);

    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch (e) {
        // Scanner was already stopped — nothing to release
      }
    }
  };

  const startScanner = async () => {
    setIsStartingCamera(true);
    hasScannedRef.current = false;

    try {
      // Imported on demand: html5-qrcode touches browser APIs, so keep it
      // out of the server-rendered bundle
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

      const scanner = new Html5Qrcode(SCANNER_REGION_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
        ],
        verbose: false,
      });
      scannerRef.current = scanner;
      setIsScanning(true);

      await scanner.start(
        { facingMode: 'environment' }, // back camera on phones
        {
          fps: 10,
          qrbox: (viewfinderWidth) => {
            // Wide, short box — the shape of a product barcode
            const width = Math.min(Math.floor(viewfinderWidth * 0.8), 320);
            return { width, height: Math.floor(width * 0.5) };
          },
        },
        (decodedText) => {
          if (hasScannedRef.current) return;
          hasScannedRef.current = true;
          stopScanner();
          lookupBarcode(decodedText);
        },
        () => {
          // No barcode in this frame — keep scanning
        }
      );
    } catch (error) {
      console.error('Camera start error:', error);
      await stopScanner();
      toast.error(
        'Could not access the camera. Check permissions, or type the barcode number below.'
      );
    } finally {
      setIsStartingCamera(false);
    }
  };

  const lookupBarcode = async (code: string) => {
    setIsLookingUp(true);

    try {
      const response = await fetch(`/api/barcode/${encodeURIComponent(code.trim())}`);

      if (!response?.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? 'Failed to look up barcode');
      }

      const data = await response.json();

      if (!data?.found) {
        toast.error(
          "This product isn't in the OpenFoodFacts database yet. Try the Photo Upload tab instead!",
          { duration: 5000 }
        );
        return;
      }

      if (!data?.ingredients_text) {
        toast.error(
          `Found ${data?.name || 'the product'}, but it has no ingredient list on file. Try the Photo Upload tab instead!`,
          { duration: 5000 }
        );
        return;
      }

      toast.success(
        data?.name
          ? `Found ${data.name}! Ingredients loaded — ready to generate.`
          : 'Product found! Ingredients loaded — ready to generate.',
        { duration: 4000 }
      );
      onIngredientsExtracted?.(data.ingredients_text, data?.name);
    } catch (error: any) {
      console.error('Barcode lookup error:', error);
      toast.error(error?.message || 'Failed to look up barcode');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleBarcodeImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    setIsDecodingImage(true);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(FILE_SCAN_REGION_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
        ],
        verbose: false,
      });
      try {
        const decoded = await scanner.scanFile(file, /* showImage */ false);
        toast.success(`Barcode found: ${decoded}`);
        await lookupBarcode(decoded);
      } finally {
        scanner.clear();
      }
    } catch (error) {
      console.error('Barcode image decode error:', error);
      toast.error(
        "Couldn't read a barcode in that photo. Try a straight-on, well-lit shot of just the barcode — or type the number below.",
        { duration: 6000 }
      );
    } finally {
      setIsDecodingImage(false);
    }
  };

  const handleManualLookup = () => {
    const code = manualCode.trim();
    if (!/^\d{6,14}$/.test(code)) {
      toast.error('Barcodes are 6-14 digits — check the number under the bars');
      return;
    }
    lookupBarcode(code);
  };

  return (
    <div className="space-y-4">
      {/* Camera area */}
      {!isScanning ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <ScanBarcode className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Scan a Barcode
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Point your camera at the barcode on any packaged food and we&apos;ll
            look up its ingredients for a fresh homemade version!
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={startScanner}
              disabled={isStartingCamera || isLookingUp || isDecodingImage}
            >
              {isStartingCamera ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Camera...
                </>
              ) : isLookingUp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Looking Up Product...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  Scan with Camera
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
              onClick={() => document.getElementById('barcode-photo-upload')?.click()}
              disabled={isStartingCamera || isLookingUp || isDecodingImage}
            >
              {isDecodingImage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reading Barcode...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Barcode Photo
                </>
              )}
            </Button>
          </div>
          <input
            id="barcode-photo-upload"
            type="file"
            accept="image/*"
            onChange={handleBarcodeImage}
            className="hidden"
          />
          <p className="text-xs text-gray-400 mt-4">
            Works with EAN and UPC barcodes — powered by OpenFoodFacts
          </p>
        </div>
      ) : null}

      {/* The camera feed mounts here; html5-qrcode needs the element in the DOM */}
      <div
        id={SCANNER_REGION_ID}
        className={isScanning ? 'rounded-lg overflow-hidden border border-gray-200' : 'hidden'}
      />
      {/* Off-screen decode target for uploaded barcode photos (must stay mounted) */}
      <div id={FILE_SCAN_REGION_ID} className="h-0 overflow-hidden" />

      {isScanning && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={stopScanner}
        >
          <StopCircle className="mr-2 h-4 w-4" />
          Stop Scanning
        </Button>
      )}

      {/* Manual entry fallback */}
      <div className="space-y-2 pt-2 border-t">
        <label className="text-sm font-medium text-gray-700">
          No camera handy? Type the barcode number:
        </label>
        <div className="flex gap-2">
          <Input
            type="text"
            inputMode="numeric"
            placeholder="e.g., 038000138416"
            value={manualCode}
            onChange={(e) => setManualCode(e?.target?.value ?? '')}
            disabled={isLookingUp}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && manualCode.trim()) {
                handleManualLookup();
              }
            }}
          />
          <Button
            onClick={handleManualLookup}
            disabled={isLookingUp || !manualCode.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isLookingUp ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Looking Up...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Look Up
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          It&apos;s the number printed under the bars, usually 8-13 digits
        </p>
      </div>
    </div>
  );
}
