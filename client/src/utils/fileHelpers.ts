export async function readFileHeaderHex(file: File, byteCount = 16): Promise<string> {
  const slice = file.slice(0, byteCount);
  const buf = await slice.arrayBuffer();
  const bytes = new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function getSafeBrowserWasmLimitMb(): number {
  const mem = (navigator as any).deviceMemory as number | undefined;
  if (typeof mem === 'number') {
    if (mem <= 2) return 30;
    if (mem <= 4) return 55;
    return 85;
  }
  return 60;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

let cachedAvifSupport: boolean | null = null;
export function canvasSupportsAvif(): boolean {
  if (cachedAvifSupport !== null) return cachedAvifSupport;
  try {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 2;
    const dataUrl = c.toDataURL('image/avif');
    cachedAvifSupport = dataUrl.startsWith('data:image/avif');
  } catch {
    cachedAvifSupport = false;
  }
  return cachedAvifSupport;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
