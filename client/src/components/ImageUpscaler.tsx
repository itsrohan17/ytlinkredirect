import React, { useState, useEffect, useRef } from 'react';
import {
  Maximize2,
  Upload,
  Download,
  Loader2,
  AlertCircle,
  Sparkles,
  Image as ImageIcon,
  RotateCcw,
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
}

interface ImageUpscalerProps {
  initialSource?: UpscalerInitialSource | null;
}

function formatBytesShort(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${Math.round(kb)} KB`;
}

export const ImageUpscaler: React.FC<ImageUpscalerProps> = ({ initialSource }) => {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [baseFilename, setBaseFilename] = useState<string>('image');
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);

  const [preset, setPreset] = useState<UpscalePreset>('1080p');
  const [sharpnessPct, setSharpnessPct] = useState<number>(45);
  const [outputFormat, setOutputFormat] = useState<UpscaleOutputFormat>('png');

  const [processing, setProcessing] = useState(false);
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

  const loadImageUrl = (url: string, label: string, filenameBase: string, isBlob: boolean) => {
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
      setSourceImg(img);
    };
    img.onerror = () => {
      setError('Could not load that image. Try uploading a PNG, JPEG, or WebP file directly.');
    };
    img.src = url;
  };

  useEffect(() => {
    if (initialSource?.url) {
      const cleanName = (initialSource.filename || 'youtube-thumbnail').replace(/\.[a-z0-9]+$/i, '');
      loadImageUrl(initialSource.url, initialSource.label || 'YouTube Thumbnail Source', cleanName, false);
    }
  }, [initialSource]);

  const handleFile = (file?: File | null) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Supported formats: PNG, JPEG, and WebP.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('Please select an image smaller than 25 MB.');
      return;
    }
    const url = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[a-z0-9]+$/i, '') || 'image';
    loadImageUrl(url, file.name, cleanName, true);
  };

  const runUpscale = async (targetImg?: HTMLImageElement) => {
    const img = targetImg || sourceImg;
    if (!img) return;
    setProcessing(true);
    setError(null);
    try {
      // Allow UI spinner frame to paint before synchronous pixel pass
      await new Promise((r) => setTimeout(r, 20));
      const upscaled = await upscaleImageElement(img, {
        preset,
        sharpnessPct,
        outputFormat,
      });
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = upscaled.objectUrl;
      setResult(upscaled);
    } catch (err: any) {
      setError(err?.message || 'Failed to upscale image.');
    } finally {
      setProcessing(false);
    }
  };

  // Automatically upscale whenever source image or parameters change
  useEffect(() => {
    if (sourceImg) {
      runUpscale(sourceImg);
    }
  }, [sourceImg, preset, sharpnessPct, outputFormat]);

  const targetPreview = sourceImg
    ? computeUpscaleDimensions(sourceImg.naturalWidth, sourceImg.naturalHeight, preset)
    : null;

  const handleDownload = () => {
    if (!result) return;
    const ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
    const a = document.createElement('a');
    a.href = result.objectUrl;
    a.download = `${baseFilename}-upscaled-${result.width}x${result.height}.${ext}`;
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
    setError(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Image Upscaler &amp; Enhancer
        </h1>
        <p className="text-sm text-zinc-400">
          Upscale thumbnails and photos cleanly to Full HD (1080p), 2&times;, 4&times;, or 4K UHD with edge-preserving detail sharpening directly in your browser.
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
          className={`glass-card rounded-2xl p-10 sm:p-14 border-2 border-dashed text-center cursor-pointer transition-colors ${
            dragActive ? 'border-red-500 bg-red-500/5' : 'border-zinc-700/80 hover:border-zinc-500'
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
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
            <Upload className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Drop an image here or click to browse</h2>
          <p className="text-xs text-zinc-400 mt-1.5">
            Supports PNG, JPEG, and WebP &bull; Zero server uploads or quality loss
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-sm text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Workspace */}
      {sourceUrl && sourceImg && (
        <div className="space-y-6 animate-fadeIn">
          {/* Controls Panel */}
          <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold text-white truncate max-w-[260px]">{sourceLabel}</span>
                  <span>&bull;</span>
                  <span className="font-mono">
                    {sourceImg.naturalWidth}&times;{sourceImg.naturalHeight}
                  </span>
                </div>
                {targetPreview && (
                  <p className="text-xs text-emerald-400 font-mono mt-1">
                    Output Target: {targetPreview.width}&times;{targetPreview.height} ({targetPreview.scaleFactor}&times;)
                    {targetPreview.wasCapped ? ' · capped at 4096px edge for browser stability' : ''}
                  </p>
                )}
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Change Image
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-zinc-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 border-t border-zinc-800/80">
              {/* Target Size Preset */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">
                  Target Upscale Mode
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: '1080p', label: 'Full HD (1920px)' },
                      { id: '2x', label: '2× Scale' },
                      { id: '4x', label: '4× Scale' },
                      { id: '4k', label: '4K UHD (3840px)' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPreset(opt.id)}
                      className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        preset === opt.id
                          ? 'bg-red-600/20 border-red-500 text-red-200'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail Sharpness */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">
                  Edge Crispness &amp; Detail ({sharpnessPct}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={sharpnessPct}
                  onChange={(e) => setSharpnessPct(Number(e.target.value))}
                  className="w-full accent-red-500 mt-1"
                />
                <div className="flex justify-between text-[11px] text-zinc-500 mt-1">
                  <span>Smooth</span>
                  <span>Balanced</span>
                  <span>Sharp</span>
                </div>
              </div>

              {/* Output Format + Download */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">
                  Export Format (Max Quality)
                </label>
                <div className="flex gap-1.5 mb-2.5">
                  {(
                    [
                      { id: 'png', label: 'PNG (Lossless)' },
                      { id: 'jpeg', label: 'JPG (100%)' },
                      { id: 'webp', label: 'WebP (Max)' },
                    ] as const
                  ).map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setOutputFormat(fmt.id)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                        outputFormat === fmt.id
                          ? 'bg-zinc-800 border-zinc-600 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
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
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-colors disabled:opacity-60"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {processing
                    ? 'Upscaling...'
                    : result
                    ? `Download ${result.width}×${result.height} (${formatBytesShort(result.blob.size)})`
                    : 'Preparing...'}
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Before / After Comparison Preview */}
          <div className="glass-card rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Before vs. After Preview
              </span>
              <span className="text-zinc-400 font-mono">
                Left: Original ({sourceImg.naturalWidth}&times;{sourceImg.naturalHeight}) &bull; Right: Upscaled (
                {result ? `${result.width}×${result.height}` : '...'})
              </span>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 select-none">
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
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-[0_0_8px_rgba(0,0,0,0.8)] pointer-events-none"
                  style={{ left: `${splitPct}%` }}
                />
              )}
            </div>

            {result && (
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-zinc-400 shrink-0">Original</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={splitPct}
                  onChange={(e) => setSplitPct(Number(e.target.value))}
                  aria-label="Comparison split slider"
                  className="w-full accent-emerald-500"
                />
                <span className="text-[11px] font-medium text-emerald-400 shrink-0">
                  Upscaled ({result.width}&times;{result.height})
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
