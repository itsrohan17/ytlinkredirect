import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Globe,
  Smartphone,
  Monitor,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MousePointerClick,
  Info,
} from 'lucide-react';
import { GlobalAnalyticsDashboard, Platform } from '../../types';
import { PlatformIcon } from '../PlatformIcon';

interface AnalyticsViewProps {
  compactTables?: boolean;
  onOpenLinkAnalytics: (code: string) => void;
  refreshSignal: number;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  compactTables = false,
  onOpenLinkAnalytics,
  refreshSignal,
}) => {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [platform, setPlatform] = useState<'all' | Platform>('all');
  const [activityPage, setActivityPage] = useState(1);

  const [data, setData] = useState<GlobalAnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        range,
        platform,
        activityPage: String(activityPage),
        activityLimit: '10',
      });
      const res = await fetch(`/api/links/analytics?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Failed to load analytics.');
        return;
      }
      setData(json.analytics);
    } catch {
      setError('Network error while loading analytics.');
    } finally {
      setLoading(false);
    }
  }, [range, platform, activityPage, refreshSignal]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const maxDayClicks = data
    ? Math.max(1, ...data.timeline.map((t) => t.clicks))
    : 1;

  const cellPad = compactTables ? 'py-2 px-3' : 'py-2.5 px-4';

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {(
              [
                { id: '7d', label: 'Last 7d' },
                { id: '30d', label: '30d' },
                { id: '90d', label: '90d' },
                { id: 'all', label: 'All Time' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setRange(opt.id);
                  setActivityPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  range === opt.id
                    ? 'bg-red-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {(['all', 'youtube', 'instagram', 'facebook'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPlatform(p);
                  setActivityPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  platform === p
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center gap-2 text-zinc-500">
          <Loader2 className="w-6 h-6 animate-spin text-red-500" />
          <span className="text-xs">Aggregating analytics...</span>
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-rose-500/30 text-center space-y-2">
          <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
          <p className="text-sm font-medium">{error}</p>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : (
        data && (
          <>
            {/* Summary Metric Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Clicks in Range</span>
                  <MousePointerClick className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
                  {data.totalClicksInRange.toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>In-App Browsers</span>
                  <Smartphone className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
                  {data.inAppClicksInRange.toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Android + iOS</span>
                  <Smartphone className="w-4 h-4 text-sky-500" />
                </div>
                <div className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
                  {(data.devices.android + data.devices.ios).toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Desktop Clicks</span>
                  <Monitor className="w-4 h-4 text-violet-500" />
                </div>
                <div className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
                  {data.devices.desktop.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Click Trends Over Time */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-red-500" />
                  Daily Click Trend ({range === 'all' ? 'All Time' : `Last ${range}`})
                </h2>
                <span className="text-xs text-zinc-500">{data.timeline.length} active days</span>
              </div>

              {data.timeline.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  No recorded clicks in this date range yet.
                </div>
              ) : (
                <div className="flex items-end gap-1.5 h-36 pt-4 overflow-x-auto">
                  {data.timeline.map((pt) => {
                    const heightPct = Math.max(8, Math.round((pt.clicks / maxDayClicks) * 100));
                    return (
                      <div
                        key={pt.date}
                        className="flex-1 min-w-[22px] max-w-[48px] flex flex-col items-center gap-1 group"
                        title={`${pt.date}: ${pt.clicks} clicks`}
                      >
                        <span className="text-[10px] font-mono text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          {pt.clicks}
                        </span>
                        <div className="w-full h-24 flex items-end">
                          <div
                            className="w-full rounded-t-md bg-red-500/80 hover:bg-red-500 transition-colors"
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-mono text-zinc-500 truncate max-w-full">
                          {pt.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Platform, Device & Geographic Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Platform + Devices */}
              <div className="lg:col-span-6 p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-5">
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Platform Breakdown (Clicks)
                  </h3>
                  {(['youtube', 'instagram', 'facebook'] as const).map((plat) => {
                    const cnt = data.byPlatform[plat];
                    const pct =
                      data.totalClicksInRange > 0
                        ? Math.round((cnt / data.totalClicksInRange) * 100)
                        : 0;
                    const color =
                      plat === 'youtube'
                        ? 'bg-red-500'
                        : plat === 'instagram'
                        ? 'bg-pink-500'
                        : 'bg-blue-500';
                    return (
                      <div key={plat} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="flex items-center gap-1.5 capitalize font-medium">
                            <PlatformIcon platform={plat} className="w-3.5 h-3.5" />
                            {plat}
                          </span>
                          <span className="font-mono text-zinc-500">
                            {cnt} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-4 gap-2 text-center text-xs">
                  {(
                    [
                      ['Android', data.devices.android],
                      ['iOS', data.devices.ios],
                      ['Desktop', data.devices.desktop],
                      ['Other', data.devices.other],
                    ] as const
                  ).map(([label, val]) => (
                    <div
                      key={label}
                      className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800"
                    >
                      <span className="text-[11px] text-zinc-500 block">{label}</span>
                      <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Honest Geographic Telemetry */}
              <div className="lg:col-span-6 p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-sky-500" />
                    Geographic Telemetry
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {data.geo.knownGeoClicks} verified · {data.geo.unknownGeoClicks} unattributed
                  </span>
                </div>

                {!data.geo.hasReliableGeoData ? (
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                    <span>
                      No verified country headers recorded in this range ({data.geo.unknownGeoClicks}{' '}
                      clicks marked Unknown). Country data appears automatically when requests arrive via Vercel Edge or Cloudflare geo headers without guessing IP locations.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.geo.countries.map((c) => (
                      <div
                        key={c.country}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800"
                      >
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {c.country}
                        </span>
                        <span className="font-mono text-zinc-500">{c.clicks} clicks</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Top Referrers & Browsers */}
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-zinc-500 block mb-1.5">
                      Top Referrers
                    </span>
                    {data.topReferrers.length === 0 ? (
                      <span className="text-zinc-500">None yet</span>
                    ) : (
                      <ul className="space-y-1">
                        {data.topReferrers.slice(0, 4).map((r) => (
                          <li key={r.name} className="flex justify-between text-zinc-600 dark:text-zinc-300">
                            <span className="truncate pr-2">{r.name}</span>
                            <span className="font-mono text-zinc-500">{r.clicks}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-zinc-500 block mb-1.5">
                      Top Browsers
                    </span>
                    {data.topBrowsers.length === 0 ? (
                      <span className="text-zinc-500">None yet</span>
                    ) : (
                      <ul className="space-y-1">
                        {data.topBrowsers.slice(0, 4).map((b) => (
                          <li key={b.name} className="flex justify-between text-zinc-600 dark:text-zinc-300">
                            <span className="truncate pr-2">{b.name}</span>
                            <span className="font-mono text-zinc-500">{b.clicks}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Top Performing Links */}
            {data.topLinks.length > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Top Performing Smart Links
                </h3>
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {data.topLinks.map((link) => (
                    <div key={link.code} className="py-2 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex items-center gap-2">
                        <PlatformIcon platform={link.platform} className="w-4 h-4 shrink-0" />
                        <span className="font-mono font-semibold text-red-500">/{link.code}</span>
                        <span className="truncate text-zinc-700 dark:text-zinc-300">{link.title}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-semibold">{link.click_count} clicks</span>
                        <button
                          type="button"
                          onClick={() => onOpenLinkAnalytics(link.code)}
                          className="text-red-500 hover:underline font-medium"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Paginated Recent Click Activity */}
            <div className="rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Recent Click Log
                </h3>
                <span className="text-xs text-zinc-500 font-mono">
                  {data.activityPagination.total} total events
                </span>
              </div>

              {data.recentClicks.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500">
                  No click events recorded in this filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase text-zinc-500 bg-zinc-50/80 dark:bg-zinc-950/60">
                        <th className={cellPad}>Short Code</th>
                        <th className={cellPad}>Device &amp; OS</th>
                        <th className={cellPad}>Browser</th>
                        <th className={cellPad}>Referrer</th>
                        <th className={cellPad}>Country</th>
                        <th className={cellPad}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {data.recentClicks.map((c, idx) => (
                        <tr key={`${c.link_code}-${idx}`}>
                          <td className={`${cellPad} font-mono text-red-500`}>/{c.link_code}</td>
                          <td className={`${cellPad} capitalize`}>
                            {c.device_type} · {c.os_name}
                          </td>
                          <td className={cellPad}>
                            {c.browser_name}
                            {c.is_in_app_browser ? ' (In-App)' : ''}
                          </td>
                          <td className={cellPad}>{c.referrer}</td>
                          <td className={cellPad}>{c.country}</td>
                          <td className={`${cellPad} font-mono text-zinc-500`}>
                            {c.created_at.slice(0, 19).replace('T', ' ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {data.activityPagination.total > 0 && (
                <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    Page {data.activityPagination.page} of {data.activityPagination.totalPages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={activityPage <= 1}
                      onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Prev
                    </button>
                    <button
                      type="button"
                      disabled={activityPage >= data.activityPagination.totalPages}
                      onClick={() => setActivityPage((p) => p + 1)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40"
                    >
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
};
