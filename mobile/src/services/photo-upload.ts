import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Four photos remain below the endpoint's 4 MB combined limit.
const MAX_PHOTO_BYTES = 900 * 1024;

export function removeUploadCopy(file: File) {
  try { if (file.exists) file.delete(); } catch { /* Only a temporary upload copy; the OS can reclaim it. */ }
}

export async function preparePhotoUpload(uri: string): Promise<File> {
  for (const [width, compress] of [[1600, 0.72], [1200, 0.6], [900, 0.5]]) {
    const context = ImageManipulator.manipulate(uri);
    try {
      context.resize({ width });
      const image = await context.renderAsync();
      try {
        const result = await image.saveAsync({ format: SaveFormat.JPEG, compress });
        const file = new File(result.uri);
        if (file.size > 0 && file.size <= MAX_PHOTO_BYTES) return file;
        removeUploadCopy(file);
      } finally { image.release(); }
    } finally { context.release(); }
  }
  throw new Error('That photo could not be prepared. Please try a closer photo of one shelf.');
}
