import React, { useState } from 'react';
import { History, Copy, Check, ExternalLink, QrCode, BarChart3, Trash2 } from 'lucide-react';
import { GeneratedLinkResult, Platform } from '../types';
import { PlatformIcon, getPlatformMeta } from './PlatformIcon';

interface RecentHistoryProps {
  history: GeneratedLinkResult[];
  onClearHistory: () => void;
  onOpenQr: (result: GeneratedLinkResult) => void;
  onOpenAnalytics: (code: string) => void;
}

export const RecentHistory: React.FC<RecentHistoryProps> = ({
  history,
  onClearHistory,
  onOpenQr,
  onOpenAnalytics,
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (history.length === 0) return null;

  const handleCopy = async (code: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {}
  };

  return (
    <section id="recent-history" className="py-12 max-w-5xl mx-auto px-4 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
            <History className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Your Generated Links</h3>
            <p className="text-xs text-zinc-400">Quickly manage links created in this session</p>
          </div>
        </div>

        <button
          onClick={onClearHistory}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition px-2.5 py-1 rounded bg-zinc-900/60 hover:bg-zinc-800"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
      </div>

      <div className="space-y-3">
        {history.map((item) => {
          const platform: Platform = item.link.platform || item.parsed?.platform || 'youtube';
          const brandMeta = getPlatformMeta(platform);

          return (
            <div
              key={item.link.code}
              className="p-3.5 sm:p-4 rounded-xl glass-card border border-zinc-800/80 hover:border-zinc-700/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative w-16 h-10 sm:w-20 sm:h-12 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                  <img
                    src={item.link.thumbnail_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                    <PlatformIcon platform={platform} className="w-4 h-4 text-white" />
                  </div>
                </div>

                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                    {item.link.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs font-semibold text-zinc-200">
                      {item.shortUrl}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] uppercase px-1.5 py-0.5 rounded border ${brandMeta.badgeClass}`}
                    >
                      {brandMeta.label} {item.link.url_type}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                <button
                  onClick={() => handleCopy(item.link.code, item.shortUrl)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition"
                >
                  {copiedCode === item.link.code ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => onOpenQr(item)}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                  title="View QR Code"
                >
                  <QrCode className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onOpenAnalytics(item.link.code)}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                  title="Live Analytics"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>

                <a
                  href={item.shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                  title="Test Link"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
