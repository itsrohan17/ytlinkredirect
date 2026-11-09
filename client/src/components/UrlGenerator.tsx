import React, { useState, useEffect, useRef } from 'react';
import { 
  Link as LinkIcon, 
  ArrowRight, 
  Clipboard, 
  X, 
  Sparkles, 
  AlertCircle, 
  Loader2, 
  Sliders, 
  Check, 
  Film,
  Video,
  ListMusic,
  UserCheck
} from 'lucide-react';
import { GeneratedLinkResult, YouTubeUrlType } from '../types';

interface UrlGeneratorProps {
  onSuccess: (result: GeneratedLinkResult) => void;
  initialUrl?: string;
}

export const UrlGenerator: React.FC<UrlGeneratorProps> = ({ onSuccess, initialUrl }) => {
  const [url, setUrl] = useState(initialUrl || '');
  const [customSlug, setCustomSlug] = useState('');
  const [showCustomSlug, setShowCustomSlug] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    title: string;
    author: string;
    thumbnail: string;
    type: YouTubeUrlType;
  } | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync initialUrl if prop changes
  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
      triggerPreview(initialUrl);
    }
  }, [initialUrl]);

  // Live debounced preview
  const triggerPreview = (val: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!val || !val.trim() || !isValidYouTubeUrl(val)) {
      setPreviewData(null);
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
                title: data.metadata.title,
                author: data.metadata.authorName,
                thumbnail: data.metadata.thumbnailUrl,
                type: data.parsed.type,
              });
            }
          }
        }
      } catch (e) {
        // Silently fail preview
      } finally {
        setPreviewLoading(false);
      }
    }, 450);
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
      // Clipboard permission denied
    }
  };

  const handleClear = () => {
    setUrl('');
    setPreviewData(null);
    setError(null);
  };

  const isValidYouTubeUrl = (testUrl: string) => {
    return /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\/.+$/i.test(testUrl.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();

    if (!cleanUrl) {
      setError('Please paste a YouTube URL to convert.');
      return;
    }

    if (!isValidYouTubeUrl(cleanUrl)) {
      setError('Invalid link. Please provide a valid YouTube Video, Shorts, Playlist, or Channel URL.');
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

  const getTypeIcon = (type: YouTubeUrlType) => {
    switch (type) {
      case 'shorts':
        return <Film className="w-3.5 h-3.5 text-rose-400" />;
      case 'playlist':
        return <ListMusic className="w-3.5 h-3.5 text-amber-400" />;
      case 'channel':
        return <UserCheck className="w-3.5 h-3.5 text-blue-400" />;
      default:
        return <Video className="w-3.5 h-3.5 text-red-400" />;
    }
  };

  return (
    <div id="generator" className="w-full max-w-3xl mx-auto px-4 sm:px-6">
      <div className="relative group">
        {/* Subtle decorative glow around input card */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-600/30 via-rose-600/20 to-red-700/30 blur-lg opacity-75 group-hover:opacity-100 transition duration-500 -z-10" />

        <div className="relative glass-card rounded-2xl p-4 sm:p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Row */}
            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                  <LinkIcon className="w-5 h-5 text-red-500" />
                </div>
                
                <input
                  type="text"
                  value={url}
                  onChange={handleUrlChange}
                  placeholder="Paste YouTube Video, Shorts, Playlist, or Channel URL..."
                  className="w-full pl-11 pr-24 py-4 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-white placeholder-zinc-500 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-medium"
                />

                {/* Right Input Actions */}
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
                  {url ? (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                      title="Clear input"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePaste}
                      className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
                    >
                      <Clipboard className="w-3.5 h-3.5 text-red-400" />
                      <span>Paste</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="relative flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-[0.98] text-white font-bold text-sm sm:text-base shadow-lg shadow-red-600/30 hover:shadow-red-600/50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Custom Slug & Options Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-zinc-400">
              <button
                type="button"
                onClick={() => setShowCustomSlug(!showCustomSlug)}
                className="flex items-center gap-1.5 hover:text-zinc-200 transition-colors font-medium text-zinc-400"
              >
                <Sliders className="w-3.5 h-3.5 text-red-400" />
                <span>{showCustomSlug ? 'Hide custom link options' : 'Customize link alias / slug'}</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <Check className="w-3 h-3" /> Permanent Link
                </span>
                <span className="hidden sm:inline text-zinc-600">•</span>
                <span className="hidden sm:inline text-zinc-400">No expiration</span>
              </div>
            </div>

            {/* Custom Slug Input Drawer */}
            {showCustomSlug && (
              <div className="pt-2 animate-fadeIn">
                <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center gap-2">
                  <span className="text-zinc-500 font-mono text-xs sm:text-sm pl-2">
                    {window.location.host}/
                  </span>
                  <input
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\-_]/g, ''))}
                    placeholder="my-custom-slug"
                    maxLength={32}
                    className="flex-1 bg-transparent text-white font-mono text-xs sm:text-sm focus:outline-none placeholder-zinc-600"
                  />
                  <span className="text-[11px] text-zinc-500 pr-2">
                    {customSlug.length}/32
                  </span>
                </div>
              </div>
            )}

            {/* Live Detected Target Card */}
            {(previewLoading || previewData) && (
              <div className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800/80 flex items-center gap-3.5 animate-fadeIn">
                {previewLoading ? (
                  <div className="flex items-center gap-2 py-1 text-xs text-zinc-400">
                    <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                    <span>Detecting YouTube target details...</span>
                  </div>
                ) : previewData ? (
                  <>
                    <div className="relative w-16 h-10 sm:w-20 sm:h-12 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                      <img 
                        src={previewData.thumbnail} 
                        alt={previewData.title}
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                          {getTypeIcon(previewData.type)}
                          <span>{previewData.type}</span>
                        </span>
                        <span className="text-xs text-zinc-400 truncate">{previewData.author}</span>
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-white truncate">
                        {previewData.title}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs sm:text-sm flex items-start gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                <div className="flex-1">
                  <p className="font-semibold">Error</p>
                  <p className="text-xs text-red-300/90 mt-0.5">{error}</p>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
