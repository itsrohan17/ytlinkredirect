import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

const CORE_CDN_BASES = [
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
];

export async function getFfmpeg(
  onProgress?: (pct: number) => void,
  onStatus?: (msg: string) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    if (onProgress) {
      ffmpegInstance.on('progress', ({ progress }) => {
        const clamped = Math.max(0, Math.min(100, Math.round((progress || 0) * 100)));
        onProgress(clamped);
      });
    }
    return ffmpegInstance;
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      let lastErr: any = null;

      for (const baseUrl of CORE_CDN_BASES) {
        try {
          onStatus?.('Loading FFmpeg WebAssembly engine...');
          const coreURL = await toBlobURL(`${baseUrl}/ffmpeg-core.js`, 'text/javascript');
          const wasmURL = await toBlobURL(`${baseUrl}/ffmpeg-core.wasm`, 'application/wasm');
          await ffmpeg.load({ coreURL, wasmURL });
          ffmpegInstance = ffmpeg;
          return ffmpeg;
        } catch (err) {
          lastErr = err;
        }
      }

      loadPromise = null;
      throw new Error(
        `Failed to initialize FFmpeg WebAssembly engine: ${lastErr?.message || 'Network or WASM load error'}`
      );
    })();
  }

  const instance = await loadPromise;
  if (onProgress) {
    instance.on('progress', ({ progress }) => {
      const clamped = Math.max(0, Math.min(100, Math.round((progress || 0) * 100)));
      onProgress(clamped);
    });
  }
  return instance;
}

export function resetFfmpeg(): void {
  try {
    ffmpegInstance?.terminate();
  } catch {}
  ffmpegInstance = null;
  loadPromise = null;
}

export { fetchFile };
