import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import {
  Image as ImageIcon,
  Upload,
  Download,
  Archive,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Sliders,
  Lock,
  Unlock,
  Loader2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import {
  canvasSupportsAvif,
  formatBytes,
  readFileHeaderHex,
  triggerBlobDownload,
} from '../../utils/fileHelpers';

type ImageFormat = 'jpg' | 'png' | 'webp' | 'avif';

interface ImageItem {
  id: string;
  file: File;
  headerHex: string;
  srcUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  outputBlob?: Blob;
  outputFilename?: string;
}

const SOCIAL_PRESETS = [
  { label: 'Original', w: 0, h: 0 },
  { label: 'YouTube HD (1280×720)', w: 1280, h: 720 },
  { label: 'IG Square (1080×1080)', w: 1080, h: 1080 },
  { label: 'Reels / Shorts (1080×1920)', w: 1080, h: 1920 },
  { label: 'FB / OG Link (1200×630)', w: 1200, h: 630 },
];

export const ImageStudioTab: React.FC = () => {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format & Compression
  const [outputFormat, setOutputFormat] = useState<ImageFormat>('webp');
  const [quality, setQuality] = useState<number>(85);
  const [jpgFillColor, setJpgFillColor] = useState<string>('#09090b');

  // Resize
  const [resizeWidth, setResizeWidth] = useState<number>(0);
  const [resizeHeight, setResizeHeight] = useState<number>(0);
  const [lockAspect, setLockAspect] = useState<boolean>(true);

  // Edit (Rotate, Flip, Crop)
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [cropX, setCropX] = useState<number>(0); // 0-90%
  const [cropY, setCropY] = useState<number>(0); // 0-90%
  const [cropW, setCropW] = useState<number>(100); // 10-100%
  const [cropH, setCropH] = useState<number>(100); // 10-100%

  const [processing, setProcessing] = useState(false);
  const avifSupported = canvasSupportsAvif();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedItem = items.find((i) => i.id === selectedId) || items[0] || null;

  const handleFilesAdded = async (fileList: FileList | File[]) => {
    setError(null);
    const files = Array.from(fileList);
    const added: ImageItem[] = [];

    for (const file of files) {
      try {
        const hex = await readFileHeaderHex(file, 16);
        const valRes = await fetch('/api/jobs/validate-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mime: file.type || 'image/jpeg',
            headerHex: hex,
            category: 'image',
          }),
        });
        const valData = await valRes.json();
        if (!valRes.ok || !valData.valid) {
          throw new Error(`${file.name}: ${valData?.error || 'Invalid image signature'}`);
        }

        const srcUrl = URL.createObjectURL(file);
        const dims = await loadImageDimensions(srcUrl);

        added.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          file,
          headerHex: hex,
          srcUrl,
          naturalWidth: dims.w,
          naturalHeight: dims.h,
        });
      } catch (err: any) {
        setError(err.message || 'Skipped invalid image file.');
      }
    }

    if (added.length > 0) {
      setItems((prev) => [...prev, ...added]);
      if (!selectedId) {
        setSelectedId(added[0].id);
        setResizeWidth(added[0].naturalWidth);
        setResizeHeight(added[0].naturalHeight);
      }
    }
  };

  const loadImageDimensions = (url: string): Promise<{ w: number; h: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = url;
    });
  };

  const applyPreset = (w: number, h: number) => {
    if (w === 0 && h === 0 && selectedItem) {
      setResizeWidth(selectedItem.naturalWidth);
      setResizeHeight(selectedItem.naturalHeight);
    } else {
      setResizeWidth(w);
      setResizeHeight(h);
    }
  };

  const handleWidthChange = (newW: number) => {
    setResizeWidth(newW);
    if (lockAspect && selectedItem && selectedItem.naturalWidth > 0 && newW > 0) {
      setResizeHeight(Math.round((newW * selectedItem.naturalHeight) / selectedItem.naturalWidth));
    }
  };

  const handleHeightChange = (newH: number) => {
    setResizeHeight(newH);
    if (lockAspect && selectedItem && selectedItem.naturalHeight > 0 && newH > 0) {
      setResizeWidth(Math.round((newH * selectedItem.naturalWidth) / selectedItem.naturalHeight));
    }
  };

  const processSingleImage = (item: ImageItem): Promise<{ blob: Blob; filename: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // 1. Source crop coordinates
        const sx = Math.round((cropX / 100) * img.naturalWidth);
        const sy = Math.round((cropY / 100) * img.naturalHeight);
        const sw = Math.max(1, Math.round((cropW / 100) * img.naturalWidth));
        const sh = Math.max(1, Math.round((cropH / 100) * img.naturalHeight));

        // 2. Target dimensions (use natural cropped size if resizeWidth/Height <= 0 or batch with diff ratios)
        const baseW = resizeWidth > 0 && items.length === 1 ? resizeWidth : sw;
        const baseH = resizeHeight > 0 && items.length === 1 ? resizeHeight : sh;

        const isRotated90 = rotation === 90 || rotation === 270;
        const canvas = document.createElement('canvas');
        canvas.width = isRotated90 ? baseH : baseW;
        canvas.height = isRotated90 ? baseW : baseH;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        // Preserve transparency for PNG, WebP, AVIF; flatten only for JPG
        if (outputFormat === 'jpg') {
          ctx.fillStyle = jpgFillColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
        ctx.drawImage(img, sx, sy, sw, sh, -baseW / 2, -baseH / 2, baseW, baseH);
        ctx.restore();

        const mimeMap: Record<ImageFormat, string> = {
          jpg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
          avif: 'image/avif',
        };

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error(`Browser failed to encode ${outputFormat.toUpperCase()}`));
              return;
            }
            const cleanBase = item.file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_\-]+/g, '-');
            resolve({ blob, filename: `${cleanBase}.${outputFormat}` });
          },
          mimeMap[outputFormat],
          quality / 100
        );
      };
      img.onerror = () => reject(new Error(`Failed to load ${item.file.name}`));
      img.src = item.srcUrl;
    });
  };

  const handleProcessAll = async () => {
    if (items.length === 0) return;
    setProcessing(true);
    setError(null);

    try {
      const updated: ImageItem[] = [];
      for (const item of items) {
        const res = await processSingleImage(item);
        updated.push({ ...item, outputBlob: res.blob, outputFilename: res.filename });

        // Log metadata only to Turso/SQLite
        fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            module: 'image-studio',
            processingMode: 'browser-canvas',
            inputFilename: item.file.name,
            inputMime: item.file.type || 'image/jpeg',
            inputSize: item.file.size,
            outputFormat,
            outputSize: res.blob.size,
            headerHex: item.headerHex,
            category: 'image',
          }),
        }).catch(() => {});
      }
      setItems(updated);
    } catch (err: any) {
      setError(err.message || 'Image processing error.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadZip = async () => {
    const processed = items.filter((i) => i.outputBlob && i.outputFilename);
    if (processed.length === 0) return;
    const zip = new JSZip();
    for (const item of processed) {
      zip.file(item.outputFilename!, item.outputBlob!);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerBlobDownload(zipBlob, `linktwin-images-${Date.now()}.zip`);
  };

  const removeItem = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (target) URL.revokeObjectURL(target.srcUrl);
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id || null);
    }
  };

  const processedCount = items.filter((i) => i.outputBlob).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files?.length) handleFilesAdded(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-7 text-center transition ${
          dragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-zinc-700/80 bg-zinc-900/40 hover:border-zinc-600'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          onChange={(e) => {
            if (e.target.files?.length) handleFilesAdded(e.target.files);
          }}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-2">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-white">
            Drop one or multiple images here (Batch Supported)
          </p>
          <p className="text-xs text-zinc-400">
            JPG, PNG, WebP, AVIF &amp; GIF &bull; 100% local browser Canvas processing with transparency preservation
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Preview & Batch List */}
          <div className="lg:col-span-6 space-y-4">
            {selectedItem && (
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iIzI3MjcyYSIvPjxyZWN0IHg9IjgiIHk9IjgiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMyNzI3MmEiLz48L3N2Zz4=')] flex items-center justify-center border border-zinc-800">
                  <img
                    src={selectedItem.srcUrl}
                    alt={selectedItem.file.name}
                    style={{
                      transform: `rotate(${rotation}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
                    }}
                    className="max-h-full max-w-full object-contain transition-transform duration-200"
                  />
                  {/* Crop Overlay Indicator */}
                  {(cropX > 0 || cropY > 0 || cropW < 100 || cropH < 100) && (
                    <div
                      className="absolute border-2 border-blue-400 bg-blue-500/10 pointer-events-none"
                      style={{
                        left: `${cropX}%`,
                        top: `${cropY}%`,
                        width: `${cropW}%`,
                        height: `${cropH}%`,
                      }}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400">
                  <span>
                    Natural: <strong className="text-white font-mono">{selectedItem.naturalWidth}×{selectedItem.naturalHeight}</strong>
                  </span>
                  <span>
                    Original: <strong className="text-white font-mono">{formatBytes(selectedItem.file.size)}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Batch File Queue */}
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5 max-h-72 overflow-y-auto">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-400">
                <span>Batch Queue ({items.length})</span>
                {processedCount > 1 && (
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Download All ZIP</span>
                  </button>
                )}
              </div>

              {items.map((item) => {
                const savedPct =
                  item.outputBlob && item.file.size > 0
                    ? Math.round(((item.file.size - item.outputBlob.size) / item.file.size) * 100)
                    : null;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setResizeWidth(item.naturalWidth);
                      setResizeHeight(item.naturalHeight);
                    }}
                    className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition ${
                      selectedId === item.id
                        ? 'bg-zinc-800/80 border-blue-500/40'
                        : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">{item.file.name}</p>
                      <p className="text-[11px] text-zinc-400">
                        {formatBytes(item.file.size)}
                        {item.outputBlob && (
                          <>
                            {' → '}
                            <strong className="text-emerald-400">{formatBytes(item.outputBlob.size)}</strong>
                            {savedPct !== null && (
                              <span className={savedPct >= 0 ? ' text-emerald-400' : ' text-amber-400'}>
                                {' '}
                                ({savedPct >= 0 ? `-${savedPct}%` : `+${Math.abs(savedPct)}%`})
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {item.outputBlob && item.outputFilename && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerBlobDownload(item.outputBlob!, item.outputFilename!);
                          }}
                          className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                          title="Download result"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(item.id);
                        }}
                        className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Controls */}
          <div className="lg:col-span-6 p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-5 h-fit">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>Format, Compression &amp; Editing</span>
            </h4>

            {/* Format */}
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Output Format</label>
              <div className="grid grid-cols-4 gap-2">
                {(['jpg', 'png', 'webp', 'avif'] as ImageFormat[]).map((fmt) => {
                  const disabled = fmt === 'avif' && !avifSupported;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      disabled={disabled}
                      title={disabled ? 'AVIF Canvas export not supported by this browser' : undefined}
                      onClick={() => setOutputFormat(fmt)}
                      className={`py-2 rounded-lg text-xs font-bold uppercase border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                        outputFormat === fmt
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {fmt}
                    </button>
                  );
                })}
              </div>
              {outputFormat === 'jpg' && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
                  <span>Alpha Flatten Background:</span>
                  <input
                    type="color"
                    value={jpgFillColor}
                    onChange={(e) => setJpgFillColor(e.target.value)}
                    className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Quality Slider */}
            {outputFormat !== 'png' && (
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                  <span>Compression Quality</span>
                  <span className="font-mono text-white">{quality}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            )}

            {/* Resizing & Presets */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Resize Dimensions (px)</span>
                <button
                  type="button"
                  onClick={() => setLockAspect(!lockAspect)}
                  className="inline-flex items-center gap-1 text-zinc-300 hover:text-white"
                >
                  {lockAspect ? <Lock className="w-3 h-3 text-blue-400" /> : <Unlock className="w-3 h-3" />}
                  <span>{lockAspect ? 'Aspect Locked' : 'Free Aspect'}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="number"
                  min={1}
                  placeholder="Width"
                  value={resizeWidth || ''}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white font-mono"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Height"
                  value={resizeHeight || ''}
                  onChange={(e) => handleHeightChange(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white font-mono"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SOCIAL_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.w, p.h)}
                    className="px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rotate, Flip & Crop */}
            <div className="space-y-3 pt-2 border-t border-zinc-800">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 hover:text-white"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotate 90° ({rotation}°)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFlipH(!flipH)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
                    flipH ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span>Flip H</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFlipV(!flipV)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
                    flipV ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <FlipVertical className="w-3.5 h-3.5" />
                  <span>Flip V</span>
                </button>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <Crop className="w-3.5 h-3.5 text-blue-400" />
                    Crop Area (%)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCropX(0);
                      setCropY(0);
                      setCropW(100);
                      setCropH(100);
                    }}
                    className="text-[11px] text-zinc-400 hover:text-white"
                  >
                    Reset Crop
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <label className="text-zinc-400">
                    X%:
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={cropX}
                      onChange={(e) => setCropX(Math.min(90, Math.max(0, Number(e.target.value))))}
                      className="mt-1 w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white"
                    />
                  </label>
                  <label className="text-zinc-400">
                    Y%:
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={cropY}
                      onChange={(e) => setCropY(Math.min(90, Math.max(0, Number(e.target.value))))}
                      className="mt-1 w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white"
                    />
                  </label>
                  <label className="text-zinc-400">
                    W%:
                    <input
                      type="number"
                      min={10}
                      max={100 - cropX}
                      value={cropW}
                      onChange={(e) => setCropW(Math.min(100 - cropX, Math.max(10, Number(e.target.value))))}
                      className="mt-1 w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white"
                    />
                  </label>
                  <label className="text-zinc-400">
                    H%:
                    <input
                      type="number"
                      min={10}
                      max={100 - cropY}
                      value={cropH}
                      onChange={(e) => setCropH(Math.min(100 - cropY, Math.max(10, Number(e.target.value))))}
                      className="mt-1 w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white"
                    />
                  </label>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleProcessAll}
              disabled={processing}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing {items.length} Image(s)...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" />
                  <span>Convert &amp; Optimize {items.length > 1 ? `(${items.length} Files)` : ''}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
