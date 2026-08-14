/**
 * Shrink a camera photo in the browser before uploading it.
 *
 * A modern phone camera produces 3-8MB files. The use case here is someone
 * standing in a grocery aisle on cell data, so uploading the original would
 * add many seconds before the label is even read. 1600px on the long edge is
 * still plenty of detail for OCR of fine print, and lands well under 1MB.
 *
 * Best-effort by design: if anything about the decode/encode fails (HEIC that
 * this browser can't paint, a canvas security error), we hand back the
 * original file rather than blocking the user's scan.
 */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

export async function downscaleImage(file: File): Promise<File> {
  try {
    const bitmap = await loadBitmap(file);

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    // Already small enough — re-encoding would only lose quality.
    if (scale === 1 && file.size <= 1_000_000) {
      bitmap.close?.();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );

    if (!blob) return file;

    // Re-encoding tiny images can make them bigger; keep whichever is smaller.
    if (blob.size >= file.size) return file;

    return new File([blob], 'label.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap & { close?: () => void }> {
  // createImageBitmap handles EXIF orientation in current browsers and avoids
  // the object-URL dance entirely.
  if (typeof createImageBitmap === 'function') {
    try {
      return (await createImageBitmap(file)) as ImageBitmap & { close?: () => void };
    } catch {
      // Fall through to the <img> path below.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image'));
      el.src = url;
    });
    return img as unknown as ImageBitmap & { close?: () => void };
  } finally {
    URL.revokeObjectURL(url);
  }
}
