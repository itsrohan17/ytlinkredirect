import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Maximize2,
  Image as ImageIcon,
  X,
  Info,
} from 'lucide-react';
import { ThumbnailInspectResult, ThumbnailVariant } from '../types';
import type { UpscalerInitialSource } from './ImageUpscaler';

interface ThumbnailDownloaderProps {
  initialUrl?: string;
  onSendToUpscaler?: (source: UpscalerInitialSource) => void;
}

function formatBytesShort(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${Math.round(kb)} KB`;
}

export const ThumbnailDownloader: React.FC<ThumbnailDownloaderProps> = ({
  initialUrl,
  onSendToUpscaler,
}) => {
  const [urlInput, setUrlInput] = useState(initialUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ThumbnailInspectResult | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<ThumbnailVariant['quality'] | null>(null);
  const [convertingPngId, setConvertingPngId] = useState<string | null>(null);

  const inspectYouTubeUrl = async (targetUrl?: string) => {
    const cleanUrl = (targetUrl ?? urlInput).trim();
    if (!cleanUrl) {
      setError('Paste a public YouTube watch, Shorts, or youtu.be URL.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/thumbnails/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Could not inspect thumbnails for this URL.');
        setResult(null);
        setSelectedQuality(null);
        return;
      }
      const typed = json as ThumbnailInspectResult;
      setResult(typed);
      setSelectedQuality(typed.highestAvailable?.quality || null);
    } catch {
      setError('Network error while probing YouTube thumbnail sources.');
      setResult(null);
      setSelectedQuality(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialUrl && initialUrl.trim()) {
      setUrlInput(initialUrl);
      inspectYouTubeUrl(initialUrl);
    }
  }, [initialUrl]);

  const handleDownloadJpg = (variant: ThumbnailVariant) => {
    const a = document.createElement('a');
    a.href = variant.downloadUrl;
    a.download = variant.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadPng = async (variant: ThumbnailVariant) => {
    setConvertingPngId(variant.quality);
    setError(null);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Failed to load source thumbnail for PNG export.'));
        el.src = variant.previewUrl;
      });
      // Export strictly at authentic source dimensions — never fake-upscaled
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || variant.width;
      canvas.height = img.naturalHeight || variant.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to encode PNG.'))),
          'image/png'
        );
      });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = variant.filename.replace(/\.jpg$/i, '.png');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setError(err?.message || 'Failed to download PNG.');
    } finally {
      setConvertingPngId(null);
    }
  };

  const activeVariant =
    result?.resolutions.find((v) => v.available && v.quality === selectedQuality) ||
    result?.highestAvailable ||
    null;

  const isHighestFullHd =
    Boolean(result?.highestAvailable) &&
    result!.highestAvailable!.width >= 1280 &&
    result!.highestAvailable!.height >= 720;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2.5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/85 border border-white/[0.08] text-[11px] font-medium text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Authentic YouTube Source Probe
        </div>
        <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-[-0.03em] text-white">
          YouTube Thumbnail Downloader
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Automatically detects every published source resolution from Watch, Shorts, and youtu.be links. Downloads preserve untouched original source pixels.
        </p>
      </div>

      {/* Command Input Card */}
      <div className="studio-panel rounded-2xl p-4 sm:p-5 space-y-3.5 max-w-3xl mx-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            inspectYouTubeUrl();
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              aria-label="YouTube video or Shorts URL"
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              className="w-full pl-4 pr-10 py-3 rounded-xl bg-[#0b0b0e] border border-white/[0.09] text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/35 focus:border-emerald-500/60 transition-all"
            />
            {urlInput && (
              <button
                type="button"
                onClick={() => {
                  setUrlInput('');
                  setError(null);
                }}
                aria-label="Clear URL input"
                className="absolute inset-y-0 right-2.5 my-auto h-7 w-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-sm font-semibold transition-all disabled:opacity-60 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>{loading ? 'Probing...' : 'Inspect Resolutions'}</span>
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500">Quick test:</span>
          {[
            { label: 'Watch (1280×720 HD)', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { label: 'YouTube Shorts', url: 'https://www.youtube.com/shorts/5-x1qKq2f1Q' },
            { label: 'youtu.be Short Link', url: 'https://youtu.be/dQw4w9WgXcQ' },
          ].map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => {
                setUrlInput(ex.url);
                inspectYouTubeUrl(ex.url);
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-white/[0.08] text-[11px] font-medium text-zinc-300 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

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

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-6 animate-fadeIn" aria-busy="true" aria-label="Loading thumbnail resolutions">
          <div className="studio-panel rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-80 aspect-video rounded-xl skeleton-shimmer shrink-0" />
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <div className="h-3 w-36 rounded skeleton-shimmer" />
                <div className="h-5 w-3/4 rounded skeleton-shimmer" />
                <div className="h-3.5 w-1/3 rounded skeleton-shimmer" />
              </div>
              <div className="h-20 rounded-xl skeleton-shimmer" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="studio-panel-subtle rounded-xl p-3.5 space-y-3">
                <div className="aspect-video rounded-lg skeleton-shimmer" />
                <div className="h-4 w-1/2 rounded skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty Initial State */}
      {!loading && !result && !error && (
        <div className="max-w-3xl mx-auto studio-panel-subtle rounded-2xl p-8 text-center space-y-2">
          <div className="w-11 h-11 mx-auto rounded-xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-zinc-400 mb-3">
            <ImageIcon className="w-5 h-5" />
          </div>
          <h2 className="font-display text-sm font-semibold text-zinc-200">
            Ready to inspect any public YouTube thumbnail
          </h2>
          <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
            Supports standard watch URLs, YouTube Shorts, and shortened youtu.be links. We check real source headers before displaying HD availability.
          </p>
        </div>
      )}

      {/* Loaded Results */}
      {!loading && result && (
        <div className="space-y-6 animate-slideUp">
          {/* Active Source Overview Card */}
          <div className="studio-panel rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row gap-6 items-start">
            <div className="w-full lg:w-[340px] shrink-0 rounded-xl overflow-hidden bg-[#0b0b0e] border border-white/[0.08] aspect-video flex items-center justify-center relative">
              {activeVariant ? (
                <>
                  <img
                    src={activeVariant.previewUrl}
                    alt={result.metadata.title}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-sm border border-white/10 text-[11px] font-mono text-zinc-100 tabular-nums">
                    {activeVariant.resolution}
                  </span>
                </>
              ) : (
                <div className="text-center p-4 text-xs text-zinc-500 space-y-1">
                  <ImageIcon className="w-6 h-6 mx-auto" />
                  <p>No public thumbnail preview available</p>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-4 w-full">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 mb-1.5">
                  <span className="font-mono px-2 py-0.5 rounded bg-zinc-900 border border-white/[0.07] text-zinc-300">
                    {result.videoId}
                  </span>
                  <span className="capitalize px-2 py-0.5 rounded bg-zinc-900 border border-white/[0.07] text-zinc-300">
                    {result.contentType}
                  </span>
                  <span className="text-zinc-500">Channel: {result.metadata.authorName}</span>
                </div>
                <h2 className="font-display text-lg font-semibold text-white leading-snug">
                  {result.metadata.title}
                </h2>
              </div>

              {activeVariant && result.highestAvailable ? (
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    isHighestFullHd
                      ? 'bg-emerald-500/[0.07] border-emerald-500/25'
                      : 'bg-zinc-900/75 border-white/[0.09]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isHighestFullHd ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                            <CheckCircle2 className="w-4 h-4" />
                            Genuine Full HD Source ({result.highestAvailable.resolution})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                            <Info className="w-4 h-4" />
                            Best Genuine Source: {result.highestAvailable.resolution}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Selected tier: <span className="text-zinc-200 font-medium">{activeVariant.resolution}</span> ({activeVariant.label})
                        {activeVariant.sizeBytes ? ` · ${formatBytesShort(activeVariant.sizeBytes)}` : ''}
                      </p>
                      {!isHighestFullHd && (
                        <p className="text-[11px] text-zinc-500">
                          1280&times;720 Full HD is not published by YouTube for this video. Downloading preserves the exact authentic source resolution.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleDownloadJpg(activeVariant)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Source JPG ({activeVariant.width}&times;{activeVariant.height})
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadPng(activeVariant)}
                      disabled={convertingPngId === activeVariant.quality}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-white/[0.08] transition-colors disabled:opacity-60"
                    >
                      {convertingPngId === activeVariant.quality ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Download PNG ({activeVariant.width}&times;{activeVariant.height})
                    </button>

                    {onSendToUpscaler && (
                      <button
                        type="button"
                        onClick={() =>
                          onSendToUpscaler({
                            url: activeVariant.previewUrl,
                            filename: activeVariant.filename,
                            label: `${result.metadata.title} (${activeVariant.resolution})`,
                            sizeBytes: activeVariant.sizeBytes,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/25 transition-colors"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        Upscale 2&times; / 4&times;
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
                  No standard public thumbnails were returned by YouTube for video ID {result.videoId}.
                </div>
              )}
            </div>
          </div>

          {/* All Probed Resolutions Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Detected Source Resolutions ({result.resolutions.filter((r) => r.available).length} of {result.resolutions.length} available)
              </h3>
              <span className="text-[11px] text-zinc-500">Click any available tier to preview</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.resolutions.map((variant) => {
                const isHighest = result.highestAvailable?.quality === variant.quality && variant.available;
                const isSelected = activeVariant?.quality === variant.quality && variant.available;
                return (
                  <div
                    key={variant.quality}
                    onClick={() => {
                      if (variant.available) setSelectedQuality(variant.quality);
                    }}
                    className={`rounded-xl border p-3.5 space-y-3 transition-all ${
                      variant.available ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                    } ${
                      isSelected
                        ? 'bg-[#15151b] border-emerald-500/45 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]'
                        : variant.available
                        ? 'studio-panel-subtle hover:border-white/[0.15]'
                        : 'bg-[#0d0d11] border-white/[0.04]'
                    }`}
                  >
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-[#0a0a0d] border border-white/[0.06] flex items-center justify-center">
                      {variant.available ? (
                        <>
                          <img
                            src={variant.previewUrl}
                            alt={`${variant.resolution} preview`}
                            className="w-full h-full object-cover"
                          />
                          {isHighest && (
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-500 text-zinc-950 text-[10px] font-bold uppercase tracking-wide shadow">
                              Highest Genuine Source
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-zinc-600 text-xs">
                          <XCircle className="w-5 h-5" />
                          <span>Not Published</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-semibold text-white tabular-nums">
                          {variant.resolution}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {variant.label}
                          {variant.sizeBytes ? ` · ${formatBytesShort(variant.sizeBytes)}` : ''}
                        </p>
                      </div>

                      {variant.available && (
                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleDownloadJpg(variant)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-100 border border-white/[0.08] transition-colors"
                          >
                            JPG
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadPng(variant)}
                            disabled={convertingPngId === variant.quality}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-100 border border-white/[0.08] transition-colors"
                          >
                            {convertingPngId === variant.quality ? '...' : 'PNG'}
                          </button>
                          {onSendToUpscaler && (
                            <button
                              type="button"
                              onClick={() =>
                                onSendToUpscaler({
                                  url: variant.previewUrl,
                                  filename: variant.filename,
                                  label: `${result.metadata.title} (${variant.resolution})`,
                                  sizeBytes: variant.sizeBytes,
                                })
                              }
                              title="Send to Image Upscaler"
                              aria-label={`Upscale ${variant.resolution} thumbnail`}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-rose-400 border border-white/[0.08] transition-colors"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
