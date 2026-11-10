import React, { useState, useEffect } from 'react';
import {
  Download,
  Code2,
  ShieldAlert,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Link as LinkIcon,
  Info,
  Image as ImageIcon,
} from 'lucide-react';
import { MediaInspectResult } from '../types';
import { PlatformIcon, getPlatformMeta } from './PlatformIcon';

interface MediaToolsSectionProps {
  externalUrl?: string;
}

export const MediaToolsSection: React.FC<MediaToolsSectionProps> = ({ externalUrl }) => {
  const [url, setUrl] = useState(externalUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MediaInspectResult | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  useEffect(() => {
    if (externalUrl) {
      setUrl(externalUrl);
      inspectUrl(externalUrl);
    }
  }, [externalUrl]);

  const inspectUrl = async (targetUrl: string) => {
    const clean = targetUrl.trim();
    if (!clean) {
      setError('Please enter a YouTube, Instagram, or Facebook URL to inspect.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/media/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: clean }),
      });

      const text = await res.text();
      let data: any = {};
      if (text && text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(text.slice(0, 150) || `Server error (${res.status})`);
        }
      }

      if (!res.ok) {
        throw new Error(data?.error || `Failed to inspect URL (HTTP ${res.status})`);
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Unable to inspect this URL.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inspectUrl(url);
  };

  const handleCopyEmbed = async () => {
    if (!result?.embedCode) return;
    try {
      await navigator.clipboard.writeText(result.embedCode);
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    } catch {}
  };

  const brandMeta = result ? getPlatformMeta(result.platform) : null;

  return (
    <section id="media-tools" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
          <Download className="w-3.5 h-3.5" />
          <span>Permitted Creator Media Tools</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Creator Media &amp; Asset Toolkit
        </h2>
        <p className="mt-4 text-sm sm:text-base text-zinc-400">
          Download public assets you own or have permission to use (such as HD YouTube thumbnails), generate responsive embed snippets, and follow official owner download workflows.
        </p>
      </div>

      {/* Main Inspector Card */}
      <div className="glass-card rounded-2xl border border-zinc-800/90 p-5 sm:p-8 shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
              <LinkIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="Paste YouTube, Instagram, or Facebook URL to inspect permitted assets..."
              className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition disabled:opacity-60 whitespace-nowrap"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Inspecting...</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-4 h-4" />
                <span>Inspect Media</span>
              </>
            )}
          </button>
        </form>

        {/* Policy Compliance Notice */}
        <div className="mt-4 flex items-start gap-2.5 text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p>
            <strong>Permitted Use Policy:</strong> Only public assets and official platform embed/download methods are provided. We respect platform Terms of Service and never bypass DRM, authentication, or private account restrictions.
          </p>
        </div>

        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs sm:text-sm">
            {error}
          </div>
        )}

        {/* Inspection Result */}
        {result && brandMeta && (
          <div className="mt-6 pt-6 border-t border-zinc-800 space-y-6 animate-fadeIn">
            {/* Target Metadata Summary */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <div className="w-full sm:w-40 aspect-video rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                <img
                  src={result.metadata.thumbnailUrl}
                  alt={result.metadata.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase border ${brandMeta.badgeClass}`}
                  >
                    <PlatformIcon platform={result.platform} className="w-3 h-3" />
                    {brandMeta.label} {result.contentType}
                  </span>
                  <span className="text-xs text-zinc-400 truncate">{result.metadata.authorName}</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2">
                  {result.metadata.title}
                </h3>
                <p className="text-[11px] text-zinc-500 font-mono truncate mt-1">{result.cleanUrl}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Permitted Downloads & Embed Code */}
              <div className="space-y-4">
                {result.permittedAssets.length > 0 && (
                  <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5" />
                      <span>Available Permitted Downloads</span>
                    </h4>
                    <div className="space-y-2">
                      {result.permittedAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80"
                        >
                          <div>
                            <p className="text-xs font-semibold text-white">{asset.label}</p>
                            <p className="text-[11px] text-zinc-400">
                              {asset.format} {asset.resolution ? `• ${asset.resolution}` : ''}
                            </p>
                          </div>
                          <a
                            href={asset.downloadUrl}
                            download={asset.filename}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.embedCode && (
                  <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5" />
                        <span>Official Embed Snippet</span>
                      </h4>
                      <button
                        type="button"
                        onClick={handleCopyEmbed}
                        className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-white px-2.5 py-1 rounded bg-zinc-800 transition"
                      >
                        {copiedEmbed ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy HTML</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 overflow-x-auto font-mono">
                      {result.embedCode}
                    </pre>
                  </div>
                )}
              </div>

              {/* Right Column: Official Owner Workflow & Unsupported Notice */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    {result.officialOwnerGuide.title}
                  </h4>
                  <ol className="space-y-2 text-xs text-zinc-400 list-decimal list-inside">
                    {result.officialOwnerGuide.steps.map((step, i) => (
                      <li key={i} className="leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ol>
                  <a
                    href={result.officialOwnerGuide.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 pt-1"
                  >
                    <span>{result.officialOwnerGuide.officialLabel}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Unsupported Downloads Explained</span>
                  </h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {result.unsupportedExplanation}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
