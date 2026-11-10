import React, { useState } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  QrCode,
  BarChart3,
  Smartphone,
  Share2,
  Sparkles,
  Download,
} from 'lucide-react';
import { GeneratedLinkResult, Platform } from '../types';
import { PlatformIcon, getPlatformMeta } from './PlatformIcon';

interface ResultCardProps {
  result: GeneratedLinkResult;
  onOpenQr: () => void;
  onOpenSimulator: () => void;
  onOpenAnalytics: () => void;
  onInspectMedia?: (url: string) => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  result,
  onOpenQr,
  onOpenSimulator,
  onOpenAnalytics,
  onInspectMedia,
}) => {
  const [copied, setCopied] = useState(false);
  const { link, shortUrl, parsed } = result;
  const platform: Platform = link.platform || parsed?.platform || 'youtube';
  const brandMeta = getPlatformMeta(platform);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  const getShareUrl = (target: string) => {
    const encodedUrl = encodeURIComponent(shortUrl);
    const encodedText = encodeURIComponent(`Check this out on ${brandMeta.label} ("${link.title}"): `);
    switch (target) {
      case 'whatsapp':
        return `https://api.whatsapp.com/send?text=${encodedText}${encodedUrl}`;
      case 'telegram':
        return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
      case 'twitter':
        return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
      default:
        return shortUrl;
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 mt-8 animate-slideUp">
      <div
        className={`relative rounded-2xl glass-card border ${brandMeta.borderAccent} p-5 sm:p-7 shadow-2xl overflow-hidden`}
      >
        {/* Top Accent Ribbon */}
        <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${brandMeta.topBarClass}`} />

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50" />
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>{brandMeta.label} Smart Link Ready!</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${brandMeta.badgeClass}`}
            >
              <PlatformIcon platform={platform} className="w-3.5 h-3.5" />
              <span>
                {brandMeta.label} {link.url_type}
              </span>
            </span>
          </div>
        </div>

        {/* Main Link Box */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-2 rounded-xl bg-zinc-900/90 border border-zinc-700/80 mb-6">
          <div className="flex-1 px-3 py-2 flex items-center min-w-0">
            <span className="font-mono text-sm sm:text-base font-semibold text-zinc-100 truncate select-all">
              {shortUrl}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleCopy}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 shadow-md text-white ${
                copied ? 'bg-emerald-600 shadow-emerald-600/30' : brandMeta.buttonClass
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </>
              )}
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

        {/* Action Buttons Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
          <button
            onClick={onOpenQr}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 text-xs sm:text-sm font-semibold text-zinc-200 hover:text-white transition shadow-sm"
          >
            <QrCode className="w-4 h-4 text-rose-400" />
            <span>QR Code</span>
          </button>

          <button
            onClick={onOpenSimulator}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 text-xs sm:text-sm font-semibold text-zinc-200 hover:text-white transition shadow-sm"
          >
            <Smartphone className="w-4 h-4 text-blue-400" />
            <span>Test Redirect</span>
          </button>

          <button
            onClick={onOpenAnalytics}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 text-xs sm:text-sm font-semibold text-zinc-200 hover:text-white transition shadow-sm"
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Analytics</span>
          </button>

          {onInspectMedia && (
            <button
              onClick={() => onInspectMedia(link.clean_url || link.clean_youtube_url)}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 text-xs sm:text-sm font-semibold text-zinc-200 hover:text-white transition shadow-sm"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Media Tools</span>
            </button>
          )}
        </div>

        {/* Target Preview */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-36 aspect-video rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
            <img
              src={link.thumbnail_url}
              alt={link.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg ${brandMeta.buttonClass}`}
              >
                <PlatformIcon platform={platform} className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white line-clamp-2 mb-1">{link.title}</p>
            <p className="text-xs text-zinc-400 mb-2">By {link.author_name}</p>
            <div className="text-[11px] text-zinc-500 font-mono truncate">
              Target: {link.clean_url || link.clean_youtube_url}
            </div>
          </div>
        </div>

        {/* Quick Social Sharing */}
        <div className="mt-5 pt-4 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Share2 className="w-3.5 h-3.5 text-zinc-400" />
            Share with rich preview:
          </span>

          <div className="flex items-center gap-2">
            <a
              href={getShareUrl('whatsapp')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-md bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 font-medium transition"
            >
              WhatsApp
            </a>
            <a
              href={getShareUrl('telegram')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-md bg-[#0088cc]/10 text-[#0088cc] hover:bg-[#0088cc]/20 font-medium transition"
            >
              Telegram
            </a>
            <a
              href={getShareUrl('twitter')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-medium transition"
            >
              X (Twitter)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
