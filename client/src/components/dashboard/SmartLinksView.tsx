import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Copy,
  Check,
  QrCode,
  BarChart3,
  Edit3,
  Trash2,
  ExternalLink,
  Plus,
  Loader2,
  AlertCircle,
  Lock,
  ChevronLeft,
  ChevronRight,
  Link2,
} from 'lucide-react';
import { GeneratedLinkResult, LinkRecord, PaginatedLinksResult, Platform } from '../../types';
import { PlatformIcon } from '../PlatformIcon';
import { UrlGenerator } from '../UrlGenerator';

interface SmartLinksViewProps {
  compactTables?: boolean;
  onOpenQr: (result: GeneratedLinkResult) => void;
  onOpenAnalyticsModal: (code: string) => void;
  onLinksMutated: () => void;
  refreshSignal: number;
}

export const SmartLinksView: React.FC<SmartLinksViewProps> = ({
  compactTables = false,
  onOpenQr,
  onOpenAnalyticsModal,
  onLinksMutated,
  refreshSignal,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [platform, setPlatform] = useState<'all' | Platform>('all');
  const [sort, setSort] = useState<'newest' | 'most_clicks' | 'oldest'>('newest');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PaginatedLinksResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(false);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Inline Edit Modal/Row State
  const [editingLink, setEditingLink] = useState<LinkRecord | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Delete Confirmation State
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '12',
        platform,
        sort,
      });
      if (debouncedQuery) params.set('q', debouncedQuery);

      const res = await fetch(`/api/links?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Failed to load Smart Links.');
        return;
      }
      setData({ links: json.links || [], pagination: json.pagination });
    } catch {
      setError('Network error while loading Smart Links.');
    } finally {
      setLoading(false);
    }
  }, [page, platform, sort, debouncedQuery, refreshSignal]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleCopy = async (code: string) => {
    const shortUrl = `${window.location.origin}/${code}`;
    await navigator.clipboard.writeText(shortUrl);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1600);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink) return;
    setActionError(null);
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/links/${editingLink.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          originalUrl: editUrl.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json?.error || 'Could not update link.');
        return;
      }
      setEditingLink(null);
      await fetchLinks();
      onLinksMutated();
    } catch {
      setActionError('Network error while updating link.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (code: string) => {
    setActionError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/links/${code}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json?.error || 'Could not delete link.');
        return;
      }
      setConfirmDeleteCode(null);
      await fetchLinks();
      onLinksMutated();
    } catch {
      setActionError('Network error while deleting link.');
    } finally {
      setDeleting(false);
    }
  };

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

  const cellPad = compactTables ? 'py-2 px-3' : 'py-3 px-4';

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search short code, title, creator, or URL..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {(['all', 'youtube', 'instagram', 'facebook'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPlatform(p);
                  setPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  platform === p
                    ? 'bg-red-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <select
            aria-label="Sort links"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as 'newest' | 'most_clicks' | 'oldest');
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-red-500"
          >
            <option value="newest">Newest First</option>
            <option value="most_clicks">Most Clicks</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowCreator((v) => !v)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {showCreator ? 'Hide Generator' : 'New Smart Link'}
        </button>
      </div>

      {showCreator && (
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 lt-adaptive-surface [&>section]:!py-0 [&>section]:!px-0 [&>section]:!max-w-none">
          <UrlGenerator
            onSuccess={() => {
              setShowCreator(false);
              fetchLinks();
              onLinksMutated();
            }}
          />
        </div>
      )}

      {actionError && (
        <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-600 dark:text-rose-300">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {actionError}
          </span>
          <button type="button" onClick={() => setActionError(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {editingLink && (
        <form
          onSubmit={handleSaveEdit}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-emerald-500/40 space-y-3 shadow-md"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Edit Smart Link <span className="font-mono text-red-500">/{editingLink.code}</span>
            </h3>
            <span className="text-[11px] text-zinc-500">Short code /{editingLink.code} stays preserved</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Display Title</label>
              <input
                type="text"
                required
                maxLength={200}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                Destination URL (YouTube, Instagram, or Facebook)
              </label>
              <input
                type="url"
                required
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingLink(null)}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-60"
            >
              {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      )}

      {/* Links Table / Empty / Loading / Error */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center gap-2 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin text-red-500" />
            <span className="text-xs">Loading Smart Links...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{error}</p>
            <button
              type="button"
              onClick={fetchLinks}
              className="px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : !data || data.links.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Link2 className="w-7 h-7 text-zinc-400 mx-auto" />
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              No Smart Links match your filter
            </p>
            <p className="text-xs text-zinc-500">
              {debouncedQuery || platform !== 'all'
                ? 'Try clearing your search or platform filter.'
                : 'Click "New Smart Link" above to create your first deep link.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500 bg-zinc-50/80 dark:bg-zinc-950/60">
                  <th className={cellPad}>Short Link</th>
                  <th className={cellPad}>Destination</th>
                  <th className={cellPad}>Created</th>
                  <th className={cellPad}>Clicks</th>
                  <th className={`${cellPad} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80">
                {data.links.map((link) => {
                  const shortUrl = `${window.location.origin}/${link.code}`;
                  const isDeletingConfirm = confirmDeleteCode === link.code;

                  return (
                    <tr
                      key={link.code}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/35 transition-colors"
                    >
                      <td className={`${cellPad} whitespace-nowrap`}>
                        <div className="flex items-center gap-2">
                          <PlatformIcon platform={link.platform} className="w-4 h-4 shrink-0" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <a
                                href={shortUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono font-semibold text-red-600 dark:text-red-400 hover:underline"
                              >
                                /{link.code}
                              </a>
                              <button
                                type="button"
                                onClick={() => handleCopy(link.code)}
                                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500"
                                title="Copy short URL"
                              >
                                {copiedCode === link.code ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <span className="text-[10px] uppercase text-zinc-500">
                              {link.platform} · {link.url_type}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className={`${cellPad} max-w-[280px]`}>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {link.title}
                        </p>
                        <a
                          href={link.clean_url || link.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 truncate inline-flex items-center gap-1 max-w-full"
                        >
                          <span className="truncate">{link.clean_url || link.original_url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>

                      <td className={`${cellPad} whitespace-nowrap text-xs text-zinc-500 font-mono`}>
                        {link.created_at.slice(0, 10)}
                      </td>

                      <td className={`${cellPad} whitespace-nowrap font-mono font-semibold text-zinc-900 dark:text-zinc-100`}>
                        {link.click_count.toLocaleString()}
                      </td>

                      <td className={`${cellPad} whitespace-nowrap text-right`}>
                        {isDeletingConfirm ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDelete(link.code)}
                              disabled={deleting}
                              className="px-2 py-1 rounded bg-rose-600 text-white text-[11px] font-semibold"
                            >
                              {deleting ? 'Deleting...' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteCode(null)}
                              className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-[11px]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenQr(toGeneratedResult(link))}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              title="QR Code"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenAnalyticsModal(link.code)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              title="Link Analytics"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </button>
                            {link.canManage ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingLink(link);
                                    setEditTitle(link.title);
                                    setEditUrl(link.original_url);
                                    setActionError(null);
                                  }}
                                  className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                  title="Edit link"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteCode(link.code)}
                                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                  title="Delete link"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <span
                                className="p-1.5 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                                title="Legacy or created in another session (read-only)"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data && data.pagination.total > 0 && (
          <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span>
              Showing page <strong>{data.pagination.page}</strong> of{' '}
              <strong>{data.pagination.totalPages}</strong> ({data.pagination.total} total links)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
