import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Share2, Download } from 'lucide-react';
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
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 mt-6 animate-slideUp">
      <div className={`relative rounded-2xl glass-card border ${brandMeta.borderAccent} p-5 sm:p-6 shadow-xl overflow-hidden`}>
        <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${brandMeta.topBarClass}`} />

        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <h3 className="text-sm sm:text-base font-bold text-white">
              Smart Link Created
            </h3>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase border ${brandMeta.badgeClass}`}
          >
            <PlatformIcon platform={platform} className="w-3.5 h-3.5" />
            {brandMeta.label} {link.url_type}
          </span>
        </div>

        {/* Short Link + Copy */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-xl bg-zinc-900/90 border border-zinc-700/80 mb-5">
          <div className="flex-1 px-3 py-2 min-w-0">
            <span className="font-mono text-sm sm:text-base font-semibold text-zinc-100 truncate block select-all">
              {shortUrl}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-colors text-white ${
                copied ? 'bg-emerald-600' : brandMeta.buttonClass
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>

            <a
              href={shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              title="Open short link"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Target Info Row */}
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{link.title}</p>
            <p className="text-xs text-zinc-400 truncate mt-0.5">{link.clean_url || link.clean_youtube_url}</p>
          </div>

          {platform === 'youtube' && onDownloadThumbnails && (
            <button
              type="button"
              onClick={() => onDownloadThumbnails(link.clean_url || link.original_url)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-red-400" />
              Get Thumbnails
            </button>
          )}
        </div>

        {/* Quick Share */}
        <div className="mt-4 pt-4 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5" />
            Quick share:
          </span>
          <div className="flex items-center gap-2">
            <a
              href={getShareUrl('whatsapp')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-md bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 font-medium"
            >
              WhatsApp
            </a>
            <a
              href={getShareUrl('telegram')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-md bg-[#0088cc]/10 text-[#0088cc] hover:bg-[#0088cc]/20 font-medium"
            >
              Telegram
            </a>
            <a
              href={getShareUrl('twitter')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-medium"
            >
              X
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
