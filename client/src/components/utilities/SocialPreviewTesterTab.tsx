import React, { useState } from 'react';
import {
  Globe,
  Search,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Info,
  Image as ImageIcon,
} from 'lucide-react';

type PlatformStyle = 'whatsapp' | 'telegram' | 'facebook' | 'twitter';

interface PreviewAuditIssue {
  severity: 'error' | 'warning' | 'ok';
  message: string;
}

interface PreviewResponse {
  success: boolean;
  finalUrl: string;
  status: number;
  metadata: {
    title: string;
    description: string;
    image: string | null;
    canonicalUrl: string;
    siteName: string;
    favicon: string | null;
    og: {
      title: string | null;
      description: string | null;
      image: string | null;
      url: string | null;
      siteName: string | null;
      type: string | null;
    };
    twitter: {
      card: string | null;
      title: string | null;
      description: string | null;
      image: string | null;
    };
    basic: {
      title: string | null;
      description: string | null;
      canonical: string | null;
    };
  };
  audit: {
    score: number;
    issues: PreviewAuditIssue[];
  };
  disclaimer: string;
}

const SAMPLE_URLS = [
  { label: 'YouTube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { label: 'Instagram', url: 'https://www.instagram.com/' },
  { label: 'Facebook', url: 'https://www.facebook.com/' },
];

export const SocialPreviewTesterTab: React.FC = () => {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResponse | null>(null);
  const [activeStyle, setActiveStyle] = useState<PlatformStyle>('whatsapp');
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [copiedMeta, setCopiedMeta] = useState(false);

  const inspectUrl = async (targetUrl?: string) => {
    const queryUrl = (targetUrl ?? urlInput).trim();
    if (!queryUrl) {
      setError('Enter a public HTTP or HTTPS URL to inspect.');
      return;
    }
    setError(null);
    setLoading(true);
    setImageLoadFailed(false);
    try {
      const res = await fetch('/api/utilities/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: queryUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Could not inspect URL metadata.');
        setResult(null);
        return;
      }
      setResult(json as PreviewResponse);
    } catch {
      setError('Network error while inspecting target URL.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const buildSuggestedMetaHtml = (data: PreviewResponse): string => {
    const title = data.metadata.title || 'Your Page Title';
    const desc = data.metadata.description || 'Concise 1-2 sentence summary for social cards.';
    const img = data.metadata.image || 'https://yourdomain.com/og-cover.jpg';
    const url = data.metadata.canonicalUrl || data.finalUrl;

    const escapeAttr = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return [
      `<meta property="og:type" content="${escapeAttr(data.metadata.og.type || 'website')}" />`,
      `<meta property="og:title" content="${escapeAttr(title)}" />`,
      `<meta property="og:description" content="${escapeAttr(desc)}" />`,
      `<meta property="og:image" content="${escapeAttr(img)}" />`,
      `<meta property="og:url" content="${escapeAttr(url)}" />`,
      `<meta name="twitter:card" content="${escapeAttr(data.metadata.twitter.card || 'summary_large_image')}" />`,
      `<meta name="twitter:title" content="${escapeAttr(data.metadata.twitter.title || title)}" />`,
      `<meta name="twitter:description" content="${escapeAttr(data.metadata.twitter.description || desc)}" />`,
      `<meta name="twitter:image" content="${escapeAttr(data.metadata.twitter.image || img)}" />`,
    ].join('\n');
  };

  const handleCopyMeta = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(buildSuggestedMetaHtml(result));
    setCopiedMeta(true);
    setTimeout(() => setCopiedMeta(false), 1800);
  };

  const renderThumbnail = (aspectClass: string) => {
    const imgSrc = result?.metadata.image;
    if (!imgSrc || imageLoadFailed) {
      return (
        <div className={`${aspectClass} bg-zinc-900 flex flex-col items-center justify-center gap-1.5 text-zinc-500`}>
          <ImageIcon className="w-6 h-6" />
          <span className="text-[11px]">
            {imgSrc ? 'Image blocked hotlinking or failed to load' : 'No og:image / twitter:image found'}
          </span>
        </div>
      );
    }
    return (
      <div className={`${aspectClass} bg-zinc-900 overflow-hidden`}>
        <img
          src={imgSrc}
          alt={result?.metadata.title || 'Preview thumbnail'}
          referrerPolicy="no-referrer"
          onError={() => setImageLoadFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* URL Input Bar */}
      <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Globe className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') inspectUrl();
              }}
              placeholder="https://www.youtube.com/watch?v=... or any public webpage URL"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
            />
          </div>
          <button
            type="button"
            onClick={() => inspectUrl()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Inspect Metadata
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500">Quick tests:</span>
          {SAMPLE_URLS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setUrlInput(s.url);
                inspectUrl(s.url);
              }}
              className="px-2.5 py-1 rounded-md bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Disclaimer Banner */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-xs text-sky-200">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-400" />
            <span>{result.disclaimer}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Representative Card Preview */}
            <div className="lg:col-span-6 p-4 sm:p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Representative Card Estimate
                </h3>
                <div className="flex gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                  {(
                    [
                      { id: 'whatsapp', label: 'WhatsApp' },
                      { id: 'telegram', label: 'Telegram' },
                      { id: 'facebook', label: 'Facebook' },
                      { id: 'twitter', label: 'X / OG' },
                    ] as { id: PlatformStyle; label: string }[]
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActiveStyle(p.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        activeStyle === p.id
                          ? 'bg-emerald-500 text-zinc-950'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Rendering per Platform */}
              {activeStyle === 'whatsapp' && (
                <div className="rounded-xl overflow-hidden bg-[#1f2c34] border border-emerald-900/40 max-w-md mx-auto">
                  <div className="flex flex-col">
                    {renderThumbnail('w-full aspect-[1.91/1]')}
                    <div className="p-3 space-y-1 bg-[#182229] border-l-4 border-emerald-500">
                      <p className="text-sm font-semibold text-zinc-100 line-clamp-2">
                        {result.metadata.title || '(No title found)'}
                      </p>
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {result.metadata.description || 'No description metadata returned.'}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">{result.metadata.siteName}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeStyle === 'telegram' && (
                <div className="rounded-xl p-3 bg-[#182533] border-l-4 border-sky-400 max-w-md mx-auto space-y-2">
                  <div className="text-xs font-semibold text-sky-400 truncate">
                    {result.metadata.siteName}
                  </div>
                  <div className="text-sm font-semibold text-zinc-100 line-clamp-2">
                    {result.metadata.title || '(No title found)'}
                  </div>
                  <div className="text-xs text-zinc-300 line-clamp-3">
                    {result.metadata.description || 'No description metadata returned.'}
                  </div>
                  <div className="rounded-lg overflow-hidden border border-zinc-800/70">
                    {renderThumbnail('w-full aspect-[1.91/1]')}
                  </div>
                </div>
              )}

              {activeStyle === 'facebook' && (
                <div className="rounded-xl overflow-hidden bg-[#242526] border border-zinc-700/70 max-w-md mx-auto">
                  {renderThumbnail('w-full aspect-[1.91/1]')}
                  <div className="p-3 bg-[#3a3b3c] space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-400 truncate">
                      {new URL(result.finalUrl).hostname}
                    </p>
                    <p className="text-sm font-semibold text-zinc-100 line-clamp-1">
                      {result.metadata.title || '(No title found)'}
                    </p>
                    <p className="text-xs text-zinc-300 line-clamp-1">
                      {result.metadata.description || 'No description metadata returned.'}
                    </p>
                  </div>
                </div>
              )}

              {activeStyle === 'twitter' && (
                <div className="rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 max-w-md mx-auto">
                  {renderThumbnail('w-full aspect-[1.91/1]')}
                  <div className="p-3 space-y-1">
                    <p className="text-[11px] text-zinc-500 truncate">
                      {new URL(result.finalUrl).hostname} ·{' '}
                      {result.metadata.twitter.card || 'og fallback'}
                    </p>
                    <p className="text-sm font-semibold text-zinc-100 line-clamp-1">
                      {result.metadata.twitter.title || result.metadata.title || '(No title found)'}
                    </p>
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      {result.metadata.twitter.description ||
                        result.metadata.description ||
                        'No description metadata returned.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-800/80">
                <span className="truncate flex items-center gap-1.5">
                  {result.metadata.favicon && (
                    <img
                      src={result.metadata.favicon}
                      alt=""
                      className="w-3.5 h-3.5 rounded-sm"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  HTTP {result.status} · Final URL: {result.finalUrl}
                </span>
                <a
                  href={result.finalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 text-emerald-400 hover:underline ml-2"
                >
                  Open <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Completeness Audit & Copyable Tags */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Metadata Completeness Audit
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold ${
                      result.audit.score >= 75
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : result.audit.score >= 50
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    Score: {result.audit.score}%
                  </span>
                </div>

                <ul className="space-y-2">
                  {result.audit.issues.map((issue, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80"
                    >
                      {issue.severity === 'ok' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      {issue.severity === 'warning' && (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      {issue.severity === 'error' && (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <span className="text-zinc-300">{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Meta Snippet Helper */}
              <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Recommended Head Meta Tags
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyMeta}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 transition-colors"
                  >
                    {copiedMeta ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy HTML
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                  {buildSuggestedMetaHtml(result)}
                </pre>
              </div>
            </div>
          </div>

          {/* Parsed Metadata Inspection Table */}
          <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Extracted Raw Tags
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="py-2 pr-4 font-medium">Tag</th>
                    <th className="py-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {[
                    ['og:title', result.metadata.og.title],
                    ['og:description', result.metadata.og.description],
                    ['og:image', result.metadata.og.image],
                    ['og:site_name', result.metadata.og.siteName],
                    ['og:type', result.metadata.og.type],
                    ['twitter:card', result.metadata.twitter.card],
                    ['twitter:title', result.metadata.twitter.title],
                    ['twitter:image', result.metadata.twitter.image],
                    ['<title>', result.metadata.basic.title],
                    ['meta[name=description]', result.metadata.basic.description],
                    ['canonical', result.metadata.basic.canonical],
                  ].map(([tag, val]) => (
                    <tr key={tag}>
                      <td className="py-2 pr-4 font-mono text-emerald-400 whitespace-nowrap">{tag}</td>
                      <td className="py-2 text-zinc-300 break-all">
                        {val || <span className="text-zinc-600 italic">not present</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
