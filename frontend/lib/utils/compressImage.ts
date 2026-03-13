/**
 * Client-side image compression (WhatsApp-like).
 * Resizes to max 1600px on longest side and converts to JPEG at ~80% quality.
 * Typical output: 150-400 KB for a phone photo.
 */
export async function compressImage(
  file: File,
  { maxDimension = 1600, quality = 0.8 } = {},
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  let newW = width;
  let newH = height;

  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    newW = Math.round(width * ratio);
    newH = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(newW, newH);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, newW, newH);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });

  const name = file.name.replace(/\.[^.]+$/, '.jpg');
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
}
