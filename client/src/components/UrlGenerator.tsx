import React, { useState, useEffect, useRef } from 'react';
import {
  Link2,
  ArrowRight,
  Clipboard,
  X,
  AlertCircle,
  Loader2,
  SlidersHorizontal,
  Check,
  Film,
  Video,
  ListMusic,
  UserCheck,
  Image as ImageIcon,
  ShieldCheck,
} from 'lucide-react';
import { ContentType, GeneratedLinkResult, Platform } from '../types';
import { PlatformIcon, getPlatformMeta } from './PlatformIcon';

interface UrlGeneratorProps {
  onSuccess: (result: GeneratedLinkResult) => void;
  initialUrl?: string;
}

function detectClientPlatform(testUrl: string): Platform | null {
  const trimmed = testUrl.trim();
  if (!trimmed) return null;
  if (/^(https?:\/\/)?(www\.|m\.|music\.|gaming\.)?(youtube\.com|youtu\.be)\/.+$/i.test(trimmed)) {
    return 'youtube';
  }
  if (/^(https?:\/\/)?(www\.|m\.)?(instagram\.com|instagr\.am)\/.+$/i.test(trimmed)) {
    return 'instagram';
  }
  if (/^(https?:\/\/)?(www\.|m\.|mbasic\.|web\.)?(facebook\.com|fb\.watch|fb\.com)\/.+$/i.test(trimmed)) {
    return 'facebook';
  }
  return null;
}

export const UrlGenerator: React.FC<UrlGeneratorProps> = ({ onSuccess, initialUrl }) => {
  const [url, setUrl] = useState(initialUrl || '');
  const [customSlug, setCustomSlug] = useState('');
  const [showCustomSlug, setShowCustomSlug] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detectedPlatform, setDetectedPlatform] = useState<Platform | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    platform: Platform;
    title: string;
    author: string;
    thumbnail: string;
    type: ContentType;
  } | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
      triggerPreview(initialUrl);
    }
  }, [initialUrl]);

  const triggerPreview = (val: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const plat = detectClientPlatform(val);
    setDetectedPlatform(plat);

    if (!val || !val.trim() || !plat) {
      setPreviewData(null);
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/preview?url=${encodeURIComponent(val.trim())}`);
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim()) {
            const data = JSON.parse(text);
            if (data?.metadata) {
              setPreviewData({
                platform: data.platform || data.metadata.platform || plat,
                title: data.metadata.title,
                author: data.metadata.authorName,
                thumbnail: data.metadata.thumbnailUrl,
                type: data.parsed.type,
              });
            }
          }
        }
      } catch {
        // Silently ignore preview network issues
      } finally {
        setPreviewLoading(false);
      }
    }, 360);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrl(val);
    setError(null);
    triggerPreview(val);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        setError(null);
        triggerPreview(text);
      }
    } catch {
      // Clipboard access denied
    }
  };

  const handleClear = () => {
    setUrl('');
    setDetectedPlatform(null);
    setPreviewData(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();

    if (!cleanUrl) {
      setError('Please paste a YouTube, Instagram, or Facebook URL.');
      return;
    }

    const plat = detectClientPlatform(cleanUrl);
    if (!plat) {
      setError('Unsupported link. Please provide a valid YouTube, Instagram, or Facebook URL.');
      return;
    }

    if (showCustomSlug && customSlug.trim() && customSlug.trim().length < 3) {
      setError('Custom slug must be at least 3 characters (or leave it empty).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: cleanUrl,
          customSlug: showCustomSlug && customSlug.trim() ? customSlug.trim() : undefined,
        }),
      });

      let data: any = {};
      const text = await res.text();
      if (text && text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(text.slice(0, 150) || `Server error (${res.status})`);
        }
      }

      if (!res.ok) {
        throw new Error(data?.error || `Failed to generate smart link (HTTP ${res.status})`);
      }

      onSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: ContentType) => {
    switch (type) {
      case 'shorts':
      case 'reel':
        return <Film className="w-3 h-3" />;
      case 'playlist':
        return <ListMusic className="w-3 h-3" />;
      case 'channel':
      case 'profile':
        return <UserCheck className="w-3 h-3" />;
      case 'post':
        return <ImageIcon className="w-3 h-3" />;
      default:
        return <Video className="w-3 h-3" />;
    }
  };

  const activeMeta = detectedPlatform ? getPlatformMeta(detectedPlatform) : null;

  return (
    <div id="generator" className="w-full max-w-3xl mx-auto">
      <div className="relative">
        {/* Subtle top edge halo */}
        <div
          className="absolute -inset-px rounded-2xl bg-gradient-to-b from-white/[0.12] via-white/[0.03] to-transparent pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative studio-panel rounded-2xl p-4 sm:p-5">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Command Input Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  {detectedPlatform && activeMeta ? (
                    <PlatformIcon platform={detectedPlatform} className={`w-4 h-4 ${activeMeta.iconColor}`} />
                  ) : (
                    <Link2 className="w-4 h-4 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" />
                  )}
                </div>

                <input
                  type="text"
                  value={url}
                  onChange={handleUrlChange}
                  aria-label="Destination URL"
                  placeholder="Paste YouTube, Instagram, or Facebook URL..."
                  className="w-full pl-10 pr-24 py-3.5 rounded-xl bg-[#0b0b0e] border border-white/[0.09] text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/35 focus:border-rose-500/60 transition-all"
                />

                {/* Inline Input Controls */}
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
                  {url ? (
                    <button
                      type="button"
                      onClick={handleClear}
                      aria-label="Clear URL"
                      className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePaste}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-zinc-300 bg-zinc-800/80 hover:bg-zinc-700 border border-white/[0.08] rounded-lg transition-colors"
                    >
                      <Clipboard className="w-3 h-3 text-rose-400" />
                      <span>Paste</span>
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-sm shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_-1px_0_rgba(0,0,0,0.1)] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <span>{activeMeta ? `Create ${activeMeta.label} Link` : 'Generate Smart Link'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Footer Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
              <button
                type="button"
                onClick={() => setShowCustomSlug(!showCustomSlug)}
                aria-expanded={showCustomSlug}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] transition-colors font-medium"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
                <span>{showCustomSlug ? 'Hide custom slug' : 'Custom slug'}</span>
              </button>

              <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1 text-emerald-400/90 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  App-first fallback
                </span>
                <span className="hidden sm:inline text-zinc-700">&bull;</span>
                <span className="hidden sm:inline">Permanent short URLs</span>
              </div>
            </div>

            {/* Custom Slug Drawer */}
            {showCustomSlug && (
              <div className="animate-fadeIn">
                <div className="rounded-xl bg-[#0b0b0e] border border-white/[0.08] flex items-center overflow-hidden focus-within:border-rose-500/50 transition-colors">
                  <span className="px-3 py-2.5 bg-zinc-900/70 border-r border-white/[0.06] text-zinc-500 font-mono text-xs select-none shrink-0">
                    {window.location.host}/
                  </span>
                  <input
                    type="text"
                    value={customSlug}
                    onChange={(e) =>
                      setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\-_]/g, ''))
                    }
                    aria-label="Custom short link slug"
                    placeholder="my-launch-video"
                    maxLength={32}
                    className="flex-1 min-w-0 px-3 py-2.5 bg-transparent text-zinc-100 font-mono text-xs focus:outline-none placeholder-zinc-600"
                  />
                  <span className="text-[11px] font-mono text-zinc-500 pr-3 tabular-nums shrink-0">
                    {customSlug.length}/32
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1.5 px-1">
                  Optional 3–32 characters using lowercase letters, numbers, hyphens, or underscores.
                </p>
              </div>
            )}

            {/* Live Target Metadata / Skeleton */}
            {(previewLoading || previewData) && (
              <div className="p-3 rounded-xl bg-[#0b0b0e] border border-white/[0.07] animate-fadeIn">
                {previewLoading ? (
                  <div className="flex items-center gap-3.5">
                    <div className="w-16 h-10 rounded-lg skeleton-shimmer shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-28 rounded skeleton-shimmer" />
                      <div className="h-3.5 w-3/4 rounded skeleton-shimmer" />
                    </div>
                  </div>
                ) : previewData ? (
                  <div className="flex items-center gap-3.5">
                    <div className="relative w-16 h-10 sm:w-20 sm:h-11 rounded-lg overflow-hidden bg-zinc-900 border border-white/[0.06] shrink-0">
                      <img
                        src={previewData.thumbnail}
                        alt={previewData.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${getPlatformMeta(previewData.platform).badgeClass}`}
                        >
                          <PlatformIcon platform={previewData.platform} className="w-2.5 h-2.5" />
                          <span>{getPlatformMeta(previewData.platform).label}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-zinc-800/90 text-zinc-300 border border-white/[0.06]">
                          {getTypeIcon(previewData.type)}
                          <span>{previewData.type}</span>
                        </span>
                        <span className="text-[11px] text-zinc-500 truncate">{previewData.author}</span>
                      </div>
                      <p className="text-xs sm:text-[13px] font-medium text-zinc-100 truncate">
                        {previewData.title}
                      </p>
                    </div>
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 hidden sm:block" />
                  </div>
                ) : null}
              </div>
            )}

            {/* Validation / Server Error */}
            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
