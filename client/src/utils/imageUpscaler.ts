export type UpscalePreset = '1080p' | '2x' | '4x' | '4k';
export type UpscaleOutputFormat = 'png' | 'jpeg' | 'webp';

export interface UpscaleTargetDimensions {
  width: number;
  height: number;
  scaleFactor: number;
  wasCapped: boolean;
}

export const MAX_UPSCALE_DIMENSION = 4096;

/**
 * Computes exact aspect-preserving output dimensions for the chosen preset.
 * Never shrinks an already-larger image on Full HD / 4K presets and caps
 * safely at MAX_UPSCALE_DIMENSION so mobile/desktop browsers never OOM.
 */
export function computeUpscaleDimensions(
  srcWidth: number,
  srcHeight: number,
  preset: UpscalePreset
): UpscaleTargetDimensions {
  const safeW = Math.max(1, Math.round(srcWidth));
  const safeH = Math.max(1, Math.round(srcHeight));
  const longEdge = Math.max(safeW, safeH);

  let desiredScale = 2;
  if (preset === '2x') {
    desiredScale = 2;
  } else if (preset === '4x') {
    desiredScale = 4;
  } else if (preset === '1080p') {
    desiredScale = Math.max(1, 1920 / longEdge);
  } else if (preset === '4k') {
    desiredScale = Math.max(1, 3840 / longEdge);
  }

  let width = Math.max(1, Math.round(safeW * desiredScale));
  let height = Math.max(1, Math.round(safeH * desiredScale));
  let wasCapped = false;

  const outLongEdge = Math.max(width, height);
  if (outLongEdge > MAX_UPSCALE_DIMENSION) {
    const capScale = MAX_UPSCALE_DIMENSION / longEdge;
    width = Math.max(1, Math.round(safeW * capScale));
    height = Math.max(1, Math.round(safeH * capScale));
    wasCapped = true;
  }

  return {
    width,
    height,
    scaleFactor: Math.round((width / safeW) * 100) / 100,
    wasCapped,
  };
}

/**
 * Applies a 3x3 unsharp-mask edge sharpening pass directly to RGBA pixel data
 * with a small flat-noise threshold so edges/text become crisp without grain.
 */
export function applyUnsharpMaskToRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sharpnessPct: number
): void {
  if (sharpnessPct <= 0 || width < 3 || height < 3) return;
  const amount = Math.min(1.5, Math.max(0, (sharpnessPct / 100) * 1.15));
  const src = new Uint8ClampedArray(data);
  const threshold = 4;

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = (row + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = src[idx + c];
        // Weighted 3x3 blur kernel [1,2,1; 2,4,2; 1,2,1] / 16
        const top = src[((y - 1) * width + x) * 4 + c];
        const bottom = src[((y + 1) * width + x) * 4 + c];
        const left = src[(row + x - 1) * 4 + c];
        const right = src[(row + x + 1) * 4 + c];
        const tl = src[((y - 1) * width + (x - 1)) * 4 + c];
        const tr = src[((y - 1) * width + (x + 1)) * 4 + c];
        const bl = src[((y + 1) * width + (x - 1)) * 4 + c];
        const br = src[((y + 1) * width + (x + 1)) * 4 + c];

        const blur = (center * 4 + (top + bottom + left + right) * 2 + tl + tr + bl + br) / 16;
        const diff = center - blur;
        if (Math.abs(diff) > threshold) {
          const v = center + diff * amount;
          data[idx + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
        }
      }
    }
  }
}

export interface UpscaleResult {
  blob: Blob;
  objectUrl: string;
  width: number;
  height: number;
  srcWidth: number;
  srcHeight: number;
  scaleFactor: number;
  wasCapped: boolean;
  mimeType: string;
}

/**
 * Performs multi-pass stepped bicubic Canvas upscaling followed by detail
 * sharpening, returning a max-quality PNG/JPEG/WebP blob without backend cost.
 */
export async function upscaleImageElement(
  img: HTMLImageElement,
  options: {
    preset: UpscalePreset;
    sharpnessPct: number;
    outputFormat: UpscaleOutputFormat;
  }
): Promise<UpscaleResult> {
  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;
  const dims = computeUpscaleDimensions(srcWidth, srcHeight, options.preset);

  // Build stepped intermediate canvases (~1.55x per step) to minimize ringing and blur
  let curCanvas = document.createElement('canvas');
  curCanvas.width = srcWidth;
  curCanvas.height = srcHeight;
  const initCtx = curCanvas.getContext('2d');
  if (!initCtx) throw new Error('Canvas 2D context unavailable.');
  initCtx.drawImage(img, 0, 0, srcWidth, srcHeight);

  while (curCanvas.width < dims.width || curCanvas.height < dims.height) {
    const nextW = Math.min(dims.width, Math.max(curCanvas.width + 1, Math.round(curCanvas.width * 1.55)));
    const nextH = Math.min(dims.height, Math.max(curCanvas.height + 1, Math.round(curCanvas.height * 1.55)));
    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = nextW;
    stepCanvas.height = nextH;
    const stepCtx = stepCanvas.getContext('2d');
    if (!stepCtx) throw new Error('Canvas 2D step context unavailable.');
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(curCanvas, 0, 0, nextW, nextH);
    curCanvas = stepCanvas;
  }

  if (options.sharpnessPct > 0) {
    const finalCtx = curCanvas.getContext('2d');
    if (finalCtx) {
      const imgData = finalCtx.getImageData(0, 0, dims.width, dims.height);
      applyUnsharpMaskToRgba(imgData.data, dims.width, dims.height, options.sharpnessPct);
      finalCtx.putImageData(imgData, 0, 0);
    }
  }

  const mimeType =
    options.outputFormat === 'jpeg'
      ? 'image/jpeg'
      : options.outputFormat === 'webp'
      ? 'image/webp'
      : 'image/png';

  const qualityArg = options.outputFormat === 'png' ? undefined : 1.0;

  const blob = await new Promise<Blob>((resolve, reject) => {
    curCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode upscaled image.'))),
      mimeType,
      qualityArg
    );
  });

  return {
    blob,
    objectUrl: URL.createObjectURL(blob),
    width: dims.width,
    height: dims.height,
    srcWidth,
    srcHeight,
    scaleFactor: dims.scaleFactor,
    wasCapped: dims.wasCapped,
    mimeType,
  };
}
