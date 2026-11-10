import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { ThumbnailInspectResult, ThumbnailVariant } from '../types';

interface ThumbnailDownloaderProps {
  initialUrl?: string;
  onOpenAiGenerator?: (topic?: string) => void;
}

function formatBytesShort(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${Math.round(kb)} KB`;
}

export const ThumbnailDownloader: React.FC<ThumbnailDownloaderProps> = ({
  initialUrl,
  onOpenAiGenerator,
}) => {
  const [urlInput, setUrlInput] = useState(initialUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ThumbnailInspectResult | null>(null);
  const [convertingPngId, setConvertingPngId] = useState<string | null>(null);

  const inspectYouTubeUrl = async (targetUrl?: string) => {
    const cleanUrl = (targetUrl ?? urlInput).trim();
    if (!cleanUrl) {
      setError('Paste a public YouTube video or YouTube Shorts URL.');
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
        return;
      }
      setResult(json as ThumbnailInspectResult);
    } catch {
      setError('Network error while checking YouTube thumbnail resolutions.');
      setResult(null);
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
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Failed to load image for PNG conversion.'));
        el.src = variant.previewUrl;
      });
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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          YouTube Thumbnail Downloader
        </h1>
        <p className="text-sm text-zinc-400">
          Extract and download official public thumbnails from YouTube videos and Shorts in the highest available resolution.
        </p>
      </div>

      {/* Input Bar */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            inspectYouTubeUrl();
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... or https://youtube.com/shorts/..."
            className="flex-1 px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500/70"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors disabled:opacity-60 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Get Thumbnails
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500">Examples:</span>
          {[
            { label: 'YouTube Video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { label: 'YouTube Shorts', url: 'https://www.youtube.com/shorts/5-x1qKq2f1Q' },
          ].map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => {
                setUrlInput(ex.url);
                inspectYouTubeUrl(ex.url);
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-sm text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Highlight Card (Video Info + Highest Available Resolution) */}
          <div className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row gap-6 items-start">
            <div className="w-full lg:w-80 shrink-0 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 aspect-video flex items-center justify-center">
              {result.highestAvailable ? (
                <img
                  src={result.highestAvailable.previewUrl}
                  alt={result.metadata.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4 text-xs text-zinc-500 space-y-1">
                  <ImageIcon className="w-6 h-6 mx-auto" />
                  <p>No public thumbnail preview available</p>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mb-1">
                  <span className="font-mono text-zinc-500">ID: {result.videoId}</span>
                  <span>&bull;</span>
                  <span className="capitalize">{result.contentType}</span>
                </div>
                <h2 className="text-lg font-bold text-white leading-snug">{result.metadata.title}</h2>
                <p className="text-xs text-zinc-400 mt-1">Channel: {result.metadata.authorName}</p>
              </div>

              {result.highestAvailable ? (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Highest Available: {result.highestAvailable.resolution}
                    </span>
                    <span className="text-zinc-400 block mt-0.5">
                      {result.highestAvailable.label}
                      {result.highestAvailable.sizeBytes
                        ? ` · ${formatBytesShort(result.highestAvailable.sizeBytes)}`
                        : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadJpg(result.highestAvailable!)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download JPG
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPng(result.highestAvailable!)}
                      disabled={convertingPngId === result.highestAvailable.quality}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-zinc-700 transition-colors"
                    >
                      {convertingPngId === result.highestAvailable.quality ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      PNG
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
                  No standard public thumbnails were returned by YouTube for video ID {result.videoId}.
                </div>
              )}

              {onOpenAiGenerator && (
                <button
                  type="button"
                  onClick={() => onOpenAiGenerator(result.metadata.title)}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-red-400" />
                  Want to create a new custom thumbnail for this video? Open AI Thumbnail Generator &rarr;
                </button>
              )}
            </div>
          </div>

          {/* All Probed Resolutions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.resolutions.map((variant) => (
              <div
                key={variant.quality}
                className={`rounded-xl border p-3.5 space-y-3 ${
                  variant.available
                    ? 'bg-zinc-900/70 border-zinc-800'
                    : 'bg-zinc-950/60 border-zinc-800/50 opacity-60'
                }`}
              >
                <div className="aspect-video rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800/80 flex items-center justify-center">
                  {variant.available ? (
                    <img
                      src={variant.previewUrl}
                      alt={`${variant.resolution} preview`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-zinc-600 text-xs">
                      <XCircle className="w-5 h-5" />
                      <span>Unavailable</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-white">{variant.resolution}</p>
                    <p className="text-[11px] text-zinc-400">
                      {variant.label}
                      {variant.sizeBytes ? ` · ${formatBytesShort(variant.sizeBytes)}` : ''}
                    </p>
                  </div>

                  {variant.available && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDownloadJpg(variant)}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-100 border border-zinc-700"
                      >
                        JPG
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadPng(variant)}
                        disabled={convertingPngId === variant.quality}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-100 border border-zinc-700"
                      >
                        {convertingPngId === variant.quality ? '...' : 'PNG'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
