import React from 'react';
import {
  Link2,
  MousePointerClick,
  Film,
  ArrowRight,
  Copy,
  QrCode,
  BarChart3,
  Wrench,
  Smartphone,
  Info,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  DashboardView,
  GeneratedLinkResult,
  GlobalAnalyticsDashboard,
  JobsSummaryData,
  LinkRecord,
  PlatformAnalyticsSummary,
  ServerHealthStatus,
} from '../../types';
import { UrlGenerator } from '../UrlGenerator';
import { ResultCard } from '../ResultCard';
import { PlatformIcon } from '../PlatformIcon';
import { formatBytes } from '../../utils/fileHelpers';

interface OverviewViewProps {
  summary: PlatformAnalyticsSummary | null;
  recentLinks: LinkRecord[];
  analyticsPreview: GlobalAnalyticsDashboard | null;
  jobsSummary: JobsSummaryData | null;
  health: ServerHealthStatus | null;
  currentResult: GeneratedLinkResult | null;
  sampleUrl: string;
  loading: boolean;
  error: string | null;
  onRetryLoad: () => void;
  onLinkGenerated: (res: GeneratedLinkResult) => void;
  onOpenQr: (result: GeneratedLinkResult) => void;
  onOpenSimulator: () => void;
  onOpenAnalyticsModal: (code?: string) => void;
  onInspectMedia: (url: string) => void;
  onNavigate: (view: DashboardView, utilitySubTab?: 'qr' | 'preview' | 'compressor') => void;
  onCopyText: (text: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  summary,
  recentLinks,
  analyticsPreview,
  jobsSummary,
  health,
  currentResult,
  sampleUrl,
  loading,
  error,
  onRetryLoad,
  onLinkGenerated,
  onOpenQr,
  onOpenSimulator,
  onOpenAnalyticsModal,
  onInspectMedia,
  onNavigate,
  onCopyText,
}) => {
  const totalLinks = summary?.totalLinks ?? 0;
  const totalClicks = summary?.totalClicks ?? 0;
  const mobileClicks = (summary?.devices.android ?? 0) + (summary?.devices.ios ?? 0);
  const mobilePct = totalClicks > 0 ? Math.round((mobileClicks / totalClicks) * 100) : 0;
  const totalMediaJobs = jobsSummary?.summary.totalJobs ?? 0;

  const platformRows = [
    {
      id: 'youtube' as const,
      label: 'YouTube',
      links: summary?.byPlatform.youtube.links ?? 0,
      clicks: summary?.byPlatform.youtube.clicks ?? 0,
      barColor: 'bg-red-500',
    },
    {
      id: 'instagram' as const,
      label: 'Instagram',
      links: summary?.byPlatform.instagram.links ?? 0,
      clicks: summary?.byPlatform.instagram.clicks ?? 0,
      barColor: 'bg-pink-500',
    },
    {
      id: 'facebook' as const,
      label: 'Facebook',
      links: summary?.byPlatform.facebook.links ?? 0,
      clicks: summary?.byPlatform.facebook.clicks ?? 0,
      barColor: 'bg-blue-500',
    },
  ];

  const toGeneratedResult = (link: LinkRecord): GeneratedLinkResult => ({
    platform: link.platform,
    link,
    shortUrl: `${window.location.origin}/${link.code}`,
    parsed: {
      platform: link.platform,
      type: link.url_type,
      cleanUrl: link.clean_url || link.clean_youtube_url,
      androidIntentUrl: link.clean_url,
      iosDeepLinkUrl: link.clean_url,
      iosPreferUniversalLink: link.platform === 'instagram',
      webFallbackUrl: link.clean_url || link.original_url,
    },
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-600 dark:text-rose-300">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetryLoad}
            className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Compact KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Total Smart Links</span>
            <Link2 className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">
            {loading && !summary ? '—' : totalLinks.toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">YouTube, Instagram &amp; Facebook</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Total Clicks</span>
            <MousePointerClick className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">
            {loading && !summary ? '—' : totalClicks.toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Verified server redirect hits</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Mobile Traffic</span>
            <Smartphone className="w-4 h-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">
            {loading && !summary ? '—' : `${mobilePct}%`}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            {mobileClicks.toLocaleString()} Android &amp; iOS clicks
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Media Studio Jobs</span>
            <Film className="w-4 h-4 text-violet-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">
            {loading && !jobsSummary ? '—' : totalMediaJobs.toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            {jobsSummary?.summary.completedJobs ?? 0} completed · {jobsSummary?.summary.queuedJobs ?? 0} queued
          </p>
        </div>
      </div>

      {/* Primary Quick Smart Link Generator */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Create Universal Smart Link
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Generate deep-linking short URLs for YouTube, Instagram, or Facebook with browser fallback.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate('utilities', 'qr')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-500" />
              QR Studio
            </button>
            <button
              type="button"
              onClick={() => onNavigate('utilities', 'preview')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 transition-colors"
            >
              <Wrench className="w-3.5 h-3.5 text-sky-500" />
              Preview Tester
            </button>
          </div>
        </div>

        <div className="lt-adaptive-surface [&>section]:!py-0 [&>section]:!px-0 [&>section]:!max-w-none [&>section]:!mx-0">
          <UrlGenerator onSuccess={onLinkGenerated} initialUrl={sampleUrl} />
        </div>

        {currentResult && (
          <div className="lt-adaptive-surface pt-2 [&>div]:!max-w-none [&>div]:!px-0 [&>div]:!mt-2">
            <ResultCard
              result={currentResult}
              onOpenQr={() => onOpenQr(currentResult)}
              onOpenSimulator={onOpenSimulator}
              onOpenAnalytics={() => onOpenAnalyticsModal(currentResult.link.code)}
              onInspectMedia={onInspectMedia}
            />
          </div>
        )}
      </div>

      {/* Platform Distribution + Media Infrastructure Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Platform Breakdown */}
        <div className="lg:col-span-6 p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Platform Distribution
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-400"
            >
              Full Analytics <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3.5">
            {platformRows.map((p) => {
              const linkPct = totalLinks > 0 ? Math.round((p.links / totalLinks) * 100) : 0;
              return (
                <div key={p.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-zinc-800 dark:text-zinc-200">
                      <PlatformIcon platform={p.id} className="w-3.5 h-3.5" />
                      {p.label}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
                      <strong className="text-zinc-900 dark:text-zinc-100">{p.links}</strong> links ·{' '}
                      {p.clicks} clicks ({linkPct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.barColor} transition-all duration-300`}
                      style={{ width: `${linkPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Media Studio Usage & Infrastructure Status */}
        <div className="lg:col-span-6 p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Media Studio &amp; Worker Telemetry
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('media')}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500 hover:text-emerald-400"
            >
              Open Studio <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
              <span className="text-zinc-500 block">Processed In</span>
              <span className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100 block">
                {formatBytes(jobsSummary?.summary.totalInputBytes)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
              <span className="text-zinc-500 block">Output Data</span>
              <span className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100 block">
                {formatBytes(jobsSummary?.summary.totalOutputBytes)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
              <span className="text-zinc-500 block">WASM Limit</span>
              <span className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100 block">
                {health?.capabilities.limits.browserWasmMaxMb ?? 100} MB
              </span>
            </div>
          </div>

          {health?.capabilities.objectStorageConfigured ? (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                S3/R2 object storage is configured. Server worker queue is available for oversized media up to{' '}
                {health.capabilities.limits.workerMaxMb} MB.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-700 dark:text-amber-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Optional S3/R2 storage is not configured; browser WASM and Canvas processing remain fully active without server uploads.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Recent Smart Links & Recent Click Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Links */}
        <div className="lg:col-span-6 p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Recent Smart Links</h2>
            <button
              type="button"
              onClick={() => onNavigate('links')}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-400"
            >
              Manage All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentLinks.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4 text-center">
              No Smart Links created yet. Paste a YouTube, Instagram, or Facebook URL above to begin.
            </p>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {recentLinks.slice(0, 5).map((link) => (
                <div key={link.code} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <PlatformIcon platform={link.platform} className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {link.title}
                      </p>
                      <p className="text-[11px] font-mono text-zinc-500 truncate">
                        /{link.code} · {link.click_count} clicks
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onCopyText(`${window.location.origin}/${link.code}`)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      title="Copy short link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenQr(toGeneratedResult(link))}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      title="Show QR code"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAnalyticsModal(link.code)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      title="Inspect link analytics"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Click Activity */}
        <div className="lg:col-span-6 p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Recent Redirect Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-400"
            >
              View Stream <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {!analyticsPreview || analyticsPreview.recentClicks.length === 0 ? (
            <div className="py-6 text-center space-y-1">
              <Clock className="w-5 h-5 text-zinc-400 mx-auto" />
              <p className="text-xs text-zinc-500">
                No recorded clicks yet. Opening any short URL logs real device and browser telemetry here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {analyticsPreview.recentClicks.slice(0, 5).map((click, idx) => (
                <div key={`${click.link_code}-${idx}`} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      /{click.link_code} · <span className="capitalize">{click.device_type}</span> ({click.os_name})
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {click.browser_name} · Referrer: {click.referrer}
                    </p>
                  </div>
                  <span className="text-[11px] text-zinc-500 shrink-0 font-mono">
                    {click.created_at.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
