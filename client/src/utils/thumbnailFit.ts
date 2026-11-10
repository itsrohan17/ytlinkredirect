export type BackgroundFitMode = 'cover' | 'contain-blur';
export type CropFocus = 'top' | 'center' | 'bottom';

export interface DrawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BackgroundPlacement {
  fitMode: BackgroundFitMode;
  backdropRect: DrawRect | null;
  foregroundRect: DrawRect;
}

/**
 * Recommends 'cover' for landscape images (e.g. 7:4, 5:3, 3:2) and
 * 'contain-blur' for square or vertical images so 1280x720 exports never
 * accidentally crop off large portions of portrait/square artwork.
 */
export function recommendBackgroundFitMode(naturalWidth: number, naturalHeight: number): BackgroundFitMode {
  if (!naturalWidth || !naturalHeight) return 'cover';
  return naturalWidth / naturalHeight < 1.25 ? 'contain-blur' : 'cover';
}

/**
 * Computes aspect-preserving canvas placement for both live 1280x720 preview
 * and final PNG/JPEG export without stretching or distorting the source image.
 */
export function computeBackgroundPlacement(
  imgWidth: number,
  imgHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  fitMode: BackgroundFitMode,
  cropFocus: CropFocus = 'center'
): BackgroundPlacement {
  const safeIw = Math.max(1, imgWidth);
  const safeIh = Math.max(1, imgHeight);

  if (fitMode === 'contain-blur') {
    const coverScale = Math.max(canvasWidth / safeIw, canvasHeight / safeIh);
    const bleed = 1.08;
    const bw = safeIw * coverScale * bleed;
    const bh = safeIh * coverScale * bleed;
    const backdropRect: DrawRect = {
      x: (canvasWidth - bw) / 2,
      y: (canvasHeight - bh) / 2,
      width: bw,
      height: bh,
    };

    const containScale = Math.min(canvasWidth / safeIw, canvasHeight / safeIh);
    const fw = safeIw * containScale;
    const fh = safeIh * containScale;
    const foregroundRect: DrawRect = {
      x: (canvasWidth - fw) / 2,
      y: (canvasHeight - fh) / 2,
      width: fw,
      height: fh,
    };

    return {
      fitMode,
      backdropRect,
      foregroundRect,
    };
  }

  const coverScale = Math.max(canvasWidth / safeIw, canvasHeight / safeIh);
  const dw = safeIw * coverScale;
  const dh = safeIh * coverScale;
  const xFactor = 0.5;
  const yFactor = cropFocus === 'top' ? 0 : cropFocus === 'bottom' ? 1 : 0.5;

  return {
    fitMode: 'cover',
    backdropRect: null,
    foregroundRect: {
      x: (canvasWidth - dw) * xFactor || 0,
      y: (canvasHeight - dh) * yFactor || 0,
      width: dw,
      height: dh,
    },
  };
}
