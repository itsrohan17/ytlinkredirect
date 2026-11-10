import React, { useState, useEffect } from 'react';
import {
  X,
  BarChart3,
  RefreshCw,
  TrendingUp,
  Clock,
  Globe,
  Compass,
  MapPin,
} from 'lucide-react';
import { LinkStats, Platform } from '../types';
import { PlatformIcon, getPlatformMeta } from './PlatformIcon';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ isOpen, onClose, code }) => {
  const [stats, setStats] = useState<LinkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/links/${encodeURIComponent(code)}/stats`);
      const text = await res.text();
      let data: any = {};
      if (text && text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(text.slice(0, 150) || `Server error (${res.status})`);
        }
      }
      if (!res.ok) throw new Error(data?.error || `Failed to load stats (${res.status})`);
      setStats(data.stats);
    } catch (err: any) {
      setError(err.message || 'Error fetching analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen, code]);

  if (!isOpen) return null;

  const totalClicks = stats?.totalClicks || 0;
  const androidClicks = stats?.devices.android || 0;
  const iosClicks = stats?.devices.ios || 0;
  const desktopClicks = stats?.devices.desktop || 0;

  const androidPct = totalClicks > 0 ? Math.round((androidClicks / totalClicks) * 100) : 0;
  const iosPct = totalClicks > 0 ? Math.round((iosClicks / totalClicks) * 100) : 0;
  const desktopPct = totalClicks > 0 ? Math.round((desktopClicks / totalClicks) * 100) : 0;

  const platform: Platform = stats?.link.platform || 'youtube';
  const brandMeta = getPlatformMeta(platform);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div
        className="relative w-full max-w-4xl rounded-2xl glass-card border border-zinc-700/80 p-5 sm:p-7 shadow-2xl text-left my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex flex-wrap items-center gap-2">
                <span>Real-Time Link Analytics</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                  /{code}
                </span>
                {stats && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${brandMeta.badgeClass}`}
                  >
                    <PlatformIcon platform={platform} className="w-3 h-3" />
                    {brandMeta.label}
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-400">
                Privacy-respecting metrics: devices, browsers, referrers &amp; countries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStats}
              disabled={loading}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition disabled:opacity-50"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading && !stats ? (
          <div className="py-16 text-center text-zinc-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-red-500" />
            <p className="text-xs">Loading link analytics...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-400">
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : stats ? (
          <div className="mt-5 space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-xs text-zinc-400">Total Clicks</span>
                <p className="text-2xl font-extrabold text-white mt-1">{totalClicks}</p>
                <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 mt-1">
                  <TrendingUp className="w-3 h-3" /> Live tracked
                </span>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-xs text-zinc-400">Android Users</span>
                <p className="text-2xl font-extrabold text-red-400 mt-1">{androidClicks}</p>
                <span className="text-[10px] text-zinc-500 mt-1">{androidPct}% of total</span>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-xs text-zinc-400">iOS Users</span>
                <p className="text-2xl font-extrabold text-blue-400 mt-1">{iosClicks}</p>
                <span className="text-[10px] text-zinc-500 mt-1">{iosPct}% of total</span>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-xs text-zinc-400">In-App WebViews</span>
                <p className="text-2xl font-extrabold text-amber-400 mt-1">{stats.inAppCount}</p>
                <span className="text-[10px] text-zinc-500 mt-1">IG / FB WebViews</span>
              </div>
            </div>

            {/* Device Distribution Progress */}
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                Device Distribution
              </h4>

              <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${androidPct}%` }}
                  className="bg-red-500 transition-all duration-500"
                  title={`Android: ${androidClicks}`}
                />
                <div
                  style={{ width: `${iosPct}%` }}
                  className="bg-blue-500 transition-all duration-500"
                  title={`iOS: ${iosClicks}`}
                />
                <div
                  style={{ width: `${desktopPct}%` }}
                  className="bg-emerald-500 transition-all duration-500"
                  title={`Desktop: ${desktopClicks}`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between text-xs mt-3 text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>Android ({androidClicks})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>iOS ({iosClicks})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Desktop ({desktopClicks})</span>
                </div>
              </div>
            </div>

            {/* Referrers, Browsers & Countries Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Top Referrers */}
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-red-400" />
                  <span>Referrers</span>
                </h4>
                {Object.keys(stats.referrers || {}).length === 0 ? (
                  <p className="text-xs text-zinc-500">No referrers recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(stats.referrers).map(([ref, count]) => (
                      <div key={ref} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-medium truncate max-w-[140px]">
                          {ref}
                        </span>
                        <span className="text-zinc-400 font-mono px-2 py-0.5 rounded bg-zinc-800">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Browsers */}
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-blue-400" />
                  <span>Browsers</span>
                </h4>
                {Object.keys(stats.browsers || {}).length === 0 ? (
                  <p className="text-xs text-zinc-500">No browser data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(stats.browsers).map(([browser, count]) => (
                      <div key={browser} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-medium truncate max-w-[140px]">
                          {browser}
                        </span>
                        <span className="text-zinc-400 font-mono px-2 py-0.5 rounded bg-zinc-800">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Countries */}
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Countries</span>
                </h4>
                {Object.keys(stats.countries || {}).length === 0 ? (
                  <p className="text-xs text-zinc-500">No country data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(stats.countries).map(([country, count]) => (
                      <div key={country} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-medium truncate max-w-[140px]">
                          {country}
                        </span>
                        <span className="text-zinc-400 font-mono px-2 py-0.5 rounded bg-zinc-800">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Clicks Stream */}
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Recent Click Activity</span>
              </h4>

              {stats.recentClicks.length === 0 ? (
                <p className="text-xs text-zinc-500">No clicks yet. Share your link to see live data!</p>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {stats.recentClicks.slice(0, 8).map((c, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center justify-between gap-2 text-[11px] p-2 rounded bg-zinc-950/60 border border-zinc-800/60"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded uppercase font-bold text-[9px] ${
                            c.device_type === 'android'
                              ? 'bg-red-500/10 text-red-400'
                              : c.device_type === 'ios'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-emerald-500/10 text-emerald-400'
                          }`}
                        >
                          {c.device_type}
                        </span>
                        <span className="text-zinc-300">
                          {c.os_name} &bull; {c.browser_name}
                        </span>
                        {c.country && c.country !== 'Unknown' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                            {c.country}
                          </span>
                        )}
                      </div>
                      <span className="text-zinc-500 font-mono text-[10px]">
                        {c.referrer} &bull; {c.created_at.split(' ')[1] || c.created_at}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
