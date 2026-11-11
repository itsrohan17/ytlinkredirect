import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Download,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  RotateCcw,
  MoveHorizontal,
  ArrowRight,
  Maximize2,
} from 'lucide-react';
import {
  UpscaleOutputFormat,
  UpscalePreset,
  UpscaleResult,
  computeUpscaleDimensions,
  upscaleImageElement,
} from '../utils/imageUpscaler';

export interface UpscalerInitialSource {
  url: string;
  filename?: string;
  label?: string;
  sizeBytes?: number | null;
}

interface ImageUpscalerProps {
  initialSource?: UpscalerInitialSource | null;
}

function formatBytesShort(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${Math.round(kb)} KB`;
}

export const ImageUpscaler: React.FC<ImageUpscalerProps> = ({ initialSource }) => {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [sourceFileBytes, setSourceFileBytes] = useState<number | null>(null);
  const [baseFilename, setBaseFilename] = useState<string>('image');
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);

  const [scalePreset, setScalePreset] = useState<Extract<UpscalePreset, '2x' | '4x'>>('2x');
  const [sharpnessPct, setSharpnessPct] = useState<number>(45);
  const [outputFormat, setOutputFormat] = useState<UpscaleOutputFormat>('png');

  const [processing, setProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UpscaleResult | null>(null);
  const [splitPct, setSplitPct] = useState<number>(50);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadedBlobUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const clearResult = () => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setResult(null);
  };

  useEffect(() => {
    return () => {
      if (uploadedBlobUrlRef.current) URL.revokeObjectURL(uploadedBlobUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  const loadImageUrl = (
    url: string,
    label: string,
    filenameBase: string,
    isBlob: boolean,
    bytes: number | null
  ) => {
    setError(null);
    clearResult();
    if (uploadedBlobUrlRef.current && uploadedBlobUrlRef.current !== url) {
      URL.revokeObjectURL(uploadedBlobUrlRef.current);
      uploadedBlobUrlRef.current = null;
    }
    if (isBlob) uploadedBlobUrlRef.current = url;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setSourceUrl(url);
      setSourceLabel(label);
      setBaseFilename(filenameBase);
      setSourceFileBytes(bytes);
      setSourceImg(img);
    };
    img.onerror = () => {
      setError('Could not load that image. Please try a valid PNG, JPEG, or WebP file.');
    };
    img.src = url;
  };

  useEffect(() => {
    if (initialSource?.url) {
      const cleanName = (initialSource.filename || 'youtube-thumbnail').replace(/\.[a-z0-9]+$/i, '');
      loadImageUrl(
        initialSource.url,
        initialSource.label || 'YouTube Thumbnail Source',
        cleanName,
        false,
        initialSource.sizeBytes ?? null
      );
    }
  }, [initialSource]);

  const handleFile = (file?: File | null) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Unsupported file format. Please upload a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('Image exceeds the 25 MB browser workspace limit.');
      return;
    }
    const url = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[a-z0-9]+$/i, '') || 'image';
    loadImageUrl(url, file.name, cleanName, true, file.size);
  };

  const runUpscale = async (targetImg: HTMLImageElement) => {
    setProcessing(true);
    setProgressPct(25);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 25));
      setProgressPct(65);
      const upscaled = await upscaleImageElement(targetImg, {
        preset: scalePreset,
        sharpnessPct,
        outputFormat,
      });
      setProgressPct(100);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = upscaled.objectUrl;
      setResult(upscaled);
    } catch (err: any) {
      setError(err?.message || 'Failed to upscale image.');
      setProgressPct(0);
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (sourceImg) {
      runUpscale(sourceImg);
    }
  }, [sourceImg, scalePreset, sharpnessPct, outputFormat]);

  const targetPreview = sourceImg
    ? computeUpscaleDimensions(sourceImg.naturalWidth, sourceImg.naturalHeight, scalePreset)
    : null;

  const handleDownload = () => {
    if (!result) return;
    const ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
    const a = document.createElement('a');
    a.href = result.objectUrl;
    a.download = `${baseFilename}-${scalePreset}-${result.width}x${result.height}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const resetAll = () => {
    clearResult();
    if (uploadedBlobUrlRef.current) {
      URL.revokeObjectURL(uploadedBlobUrlRef.current);
      uploadedBlobUrlRef.current = null;
    }
    setSourceImg(null);
    setSourceUrl(null);
    setSourceLabel('');
    setSourceFileBytes(null);
    setProgressPct(0);
    setError(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2.5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/85 border border-white/[0.08] text-[11px] font-medium text-zinc-300">
          <Maximize2 className="w-3 h-3 text-rose-400" />
          Client-Side Multi-Pass Resampling &amp; Crisp Detail
        </div>
        <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-[-0.03em] text-white">
          Image Upscaler
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Upload a thumbnail or image to upscale smoothly at 2&times; or 4&times;, inspect edge sharpness with the before/after slider, and export cleanly.
        </p>
      </div>

      {/* Upload Dropzone */}
      {!sourceUrl && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`max-w-3xl mx-auto studio-panel rounded-2xl p-10 sm:p-16 border-2 border-dashed text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-rose-500 bg-rose-500/[0.06]'
              : 'border-white/[0.12] hover:border-white/[0.25] hover:bg-[#131318]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
            className="hidden"
          />
          <div className="w-12 h-12 mx-auto rounded-xl bg-zinc-900 border border-white/[0.1] flex items-center justify-center text-rose-400 mb-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <Upload className="w-5 h-5" />
          </div>
          <h2 className="font-display text-base font-semibold text-white">
            Drop an image here, or click to select
          </h2>
          <p className="text-xs text-zinc-400 mt-1.5">
            PNG, JPEG, or WebP up to 25 MB &bull; Processed locally in your browser
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="max-w-3xl mx-auto flex items-start gap-2.5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs sm:text-sm text-rose-300 animate-fadeIn"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Workspace */}
      {sourceUrl && sourceImg && (
        <div className="space-y-6 animate-slideUp">
          {/* Metrics + Controls Panel */}
          <div className="studio-panel rounded-2xl p-5 sm:p-6 space-y-5">
            {/* File & Dimension Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-emerald-400 shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                    {sourceLabel}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono mt-0.5 tabular-nums">
                    <span className="text-zinc-400">
                      Original: {sourceImg.naturalWidth}&times;{sourceImg.naturalHeight}
                      {sourceFileBytes ? ` (${formatBytesShort(sourceFileBytes)})` : ''}
                    </span>
                    <ArrowRight className="w-3 h-3 text-zinc-600" />
                    <span className="text-emerald-400 font-medium">
                      Output: {targetPreview ? `${targetPreview.width}×${targetPreview.height}` : '...'}
                      {result ? ` (${formatBytesShort(result.blob.size)})` : ''}
                    </span>
                    {targetPreview?.wasCapped && (
                      <span className="text-[11px] font-sans text-amber-300">
                        (capped at 4096px edge)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    handleFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-xs font-medium text-zinc-200 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Replace
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            </div>

            {/* Upscale Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
              {/* 2x / 4x Scale Selector */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-2">
                  Scale Factor
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#0b0b0e] border border-white/[0.07]">
                  {(['2x', '4x'] as const).map((mode) => {
                    const active = scalePreset === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setScalePreset(mode)}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                          active
                            ? 'bg-zinc-800 text-white border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                            : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                        }`}
                      >
                        {mode === '2x' ? '2× Upscale' : '4× Upscale'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detail Sharpness */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <label htmlFor="upscale-sharpness" className="font-medium text-zinc-300">
                    Edge Crispness
                  </label>
                  <span className="font-mono text-zinc-400 tabular-nums">{sharpnessPct}%</span>
                </div>
                <input
                  id="upscale-sharpness"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={sharpnessPct}
                  onChange={(e) => setSharpnessPct(Number(e.target.value))}
                  className="w-full accent-rose-500"
                />
                <div className="flex justify-between text-[11px] text-zinc-500 mt-1">
                  <span>Natural</span>
                  <span>Balanced</span>
                  <span>Sharp</span>
                </div>
              </div>

              {/* Format + Download CTA */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'png', label: 'PNG Lossless' },
                      { id: 'jpeg', label: 'JPG 100%' },
                      { id: 'webp', label: 'WebP Max' },
                    ] as const
                  ).map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setOutputFormat(fmt.id)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-colors ${
                        outputFormat === fmt.id
                          ? 'bg-zinc-800 border-white/[0.14] text-white'
                          : 'bg-[#0b0b0e] border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={processing || !result}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-all disabled:opacity-60"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {processing
                    ? 'Processing image...'
                    : result
                    ? `Download ${result.width}×${result.height} (${formatBytesShort(result.blob.size)})`
                    : 'Preparing output...'}
                </button>
              </div>
            </div>

            {/* Subtle Progress Bar */}
            {processing && (
              <div className="space-y-1.5 animate-fadeIn">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Upscaling &amp; sharpening pixels...</span>
                  <span className="font-mono tabular-nums">{progressPct}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-emerald-400 transition-all duration-200"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Before / After Comparison Workspace */}
          <div className="studio-panel rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-display font-semibold text-white">
                Before &amp; After Comparison
              </span>
              <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
                <span className="text-zinc-400">
                  Original: {sourceImg.naturalWidth}&times;{sourceImg.naturalHeight}
                </span>
                <span className="text-zinc-700">|</span>
                <span className="text-emerald-400">
                  Upscaled ({scalePreset}): {result ? `${result.width}×${result.height}` : '...'}
                </span>
              </div>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-white/[0.08] checker-bg select-none">
              <img
                src={result ? result.objectUrl : sourceUrl}
                alt="Upscaled output preview"
                className="w-full max-h-[540px] object-contain block mx-auto"
              />
              {result && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ clipPath: `inset(0 ${100 - splitPct}% 0 0)` }}
                >
                  <img
                    src={sourceUrl}
                    alt="Original source preview"
                    className="w-full h-full object-contain block"
                  />
                </div>
              )}
              {result && (
                <>
                  <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-black/75 border border-white/10 text-[10px] font-mono text-zinc-200 pointer-events-none">
                    Original
                  </span>
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/75 border border-emerald-500/35 text-[10px] font-mono text-emerald-300 pointer-events-none">
                    {scalePreset} Upscaled
                  </span>
                  <div
                    className="absolute top-0 bottom-0 w-px bg-white/80 shadow-[0_0_10px_rgba(0,0,0,0.85)] pointer-events-none"
                    style={{ left: `${splitPct}%` }}
                  >
                    <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-zinc-900/95 border border-white/25 text-white flex items-center justify-center shadow-lg">
                      <MoveHorizontal className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </>
              )}
            </div>

            {result && (
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[11px] font-medium text-zinc-400 shrink-0">Original</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={splitPct}
                  onChange={(e) => setSplitPct(Number(e.target.value))}
                  aria-label="Before and after comparison split slider"
                  className="w-full accent-white cursor-ew-resize"
                />
                <span className="text-[11px] font-medium text-emerald-400 shrink-0 tabular-nums">
                  {scalePreset} ({result.width}&times;{result.height})
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
