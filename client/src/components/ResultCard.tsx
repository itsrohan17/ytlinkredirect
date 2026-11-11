import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Share2, Download, ArrowUpRight } from 'lucide-react';
import { GeneratedLinkResult, Platform } from '../types';
import { PlatformIcon, getPlatformMeta } from './PlatformIcon';

interface ResultCardProps {
  result: GeneratedLinkResult;
  onDownloadThumbnails?: (url: string) => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ result, onDownloadThumbnails }) => {
  const [copied, setCopied] = useState(false);
  const { link, shortUrl, parsed } = result;
  const platform: Platform = link.platform || parsed?.platform || 'youtube';
  const brandMeta = getPlatformMeta(platform);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const getShareUrl = (target: 'whatsapp' | 'telegram' | 'twitter') => {
    const encodedUrl = encodeURIComponent(shortUrl);
    const encodedText = encodeURIComponent(`Open on ${brandMeta.label}: `);
    if (target === 'whatsapp') return `https://api.whatsapp.com/send?text=${encodedText}${encodedUrl}`;
    if (target === 'telegram') return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
    return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-5 animate-slideUp">
      <div className="relative rounded-2xl studio-panel p-4 sm:p-6 overflow-hidden">
        {/* Hairline platform top accent */}
        <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${brandMeta.topBarClass}`} />

        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]" />
            <h2 className="font-display text-sm font-semibold text-white">Smart Link Active</h2>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase border ${brandMeta.badgeClass}`}
          >
            <PlatformIcon platform={platform} className="w-3 h-3" />
            {brandMeta.label} {link.url_type}
          </span>
        </div>

        {/* Monospace Short Link Output */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 rounded-xl bg-[#0b0b0e] border border-white/[0.09] mb-4">
          <div className="flex-1 px-3 py-2 min-w-0">
            <span className="font-mono text-sm font-medium text-zinc-100 truncate block select-all">
              {shortUrl}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-xs transition-all ${
                copied
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'bg-white hover:bg-zinc-200 text-zinc-950'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>

            <a
              href={shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open smart link in new tab"
              className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-white transition-colors"
              title="Open short link"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Destination Summary */}
        <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-zinc-100 truncate">{link.title}</p>
            <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">
              {link.clean_url || link.clean_youtube_url}
            </p>
          </div>

          {platform === 'youtube' && onDownloadThumbnails && (
            <button
              type="button"
              onClick={() => onDownloadThumbnails(link.clean_url || link.original_url)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 border border-white/[0.08] text-xs font-medium text-zinc-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Get Thumbnails
            </button>
          )}
        </div>

        {/* Sharing Strip */}
        <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
            <Share2 className="w-3.5 h-3.5" />
            Quick share
          </span>
          <div className="flex items-center gap-2">
            <a
              href={getShareUrl('whatsapp')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/15 text-[11px] font-medium transition-colors"
            >
              WhatsApp
              <ArrowUpRight className="w-3 h-3" />
            </a>
            <a
              href={getShareUrl('telegram')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0088cc]/10 border border-[#0088cc]/25 text-[#38bdf8] hover:bg-[#0088cc]/20 text-[11px] font-medium transition-colors"
            >
              Telegram
              <ArrowUpRight className="w-3 h-3" />
            </a>
            <a
              href={getShareUrl('twitter')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800/90 border border-white/[0.08] text-zinc-200 hover:bg-zinc-700 text-[11px] font-medium transition-colors"
            >
              X
              <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
