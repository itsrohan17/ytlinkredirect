import React, { useState, useEffect, useCallback } from 'react';
import {
  Menu,
  Sun,
  Moon,
  Plus,
  LayoutDashboard,
  Link2,
  BarChart3,
  Film,
  Wrench,
  Settings,
  Check,
} from 'lucide-react';
import { DashboardSidebar } from './components/dashboard/DashboardSidebar';
import { OverviewView } from './components/dashboard/OverviewView';
import { SmartLinksView } from './components/dashboard/SmartLinksView';
import { AnalyticsView } from './components/dashboard/AnalyticsView';
import { SettingsView } from './components/dashboard/SettingsView';
import { MediaToolsSection } from './components/MediaToolsSection';
import { UtilitiesSection, UtilityTab } from './components/UtilitiesSection';
import { QrCodeModal } from './components/QrCodeModal';
import { DeviceSimulatorModal } from './components/DeviceSimulatorModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import {
  DashboardView,
  GeneratedLinkResult,
  GlobalAnalyticsDashboard,
  JobsSummaryData,
  LinkRecord,
  PlatformAnalyticsSummary,
  ServerHealthStatus,
  UserPreferences,
} from './types';
import {
  applyThemeToDocument,
  loadUserPreferences,
  resetUserPreferences,
  saveUserPreferences,
} from './utils/preferences';

const STORAGE_KEY = 'yt_linktwin_history';

const VIEW_META: Record<DashboardView, { title: string; subtitle: string }> = {
  overview: {
    title: 'Overview',
    subtitle: 'Smart Link creation, platform totals, and studio telemetry',
  },
  links: {
    title: 'Smart Links',
    subtitle: 'Search, filter, copy, edit, and manage redirect links',
  },
  analytics: {
    title: 'Analytics',
    subtitle: 'Aggregated click trends, platform breakdown, and recent activity',
  },
  media: {
    title: 'Media Studio',
    subtitle: 'Video conversion, batch image studio, thumbnail extraction, and audio tools',
  },
  utilities: {
    title: 'Utilities',
    subtitle: 'QR Code Studio, Social Preview Tester, and File Compressor',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Workspace preferences and server infrastructure status',
  },
};

export const App: React.FC = () => {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const loaded = loadUserPreferences();
    applyThemeToDocument(loaded.theme);
    return loaded;
  });

  const [activeView, setActiveView] = useState<DashboardView>(preferences.defaultView);
  const [utilityInitialTab, setUtilityInitialTab] = useState<UtilityTab>('qr');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Dashboard telemetry states
  const [summary, setSummary] = useState<PlatformAnalyticsSummary | null>(null);
  const [recentLinks, setRecentLinks] = useState<LinkRecord[]>([]);
  const [analyticsPreview, setAnalyticsPreview] = useState<GlobalAnalyticsDashboard | null>(null);
  const [jobsSummary, setJobsSummary] = useState<JobsSummaryData | null>(null);
  const [health, setHealth] = useState<ServerHealthStatus | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Generator + Modals state
  const [currentResult, setCurrentResult] = useState<GeneratedLinkResult | null>(null);
  const [history, setHistory] = useState<GeneratedLinkResult[]>([]);
  const [sampleUrl] = useState<string>('');
  const [mediaInspectUrl, setMediaInspectUrl] = useState<string>('');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrTargetResult, setQrTargetResult] = useState<GeneratedLinkResult | null>(null);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsCode, setAnalyticsCode] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const [sumRes, recRes, anaRes, jobsRes, healthRes] = await Promise.all([
        fetch('/api/links/summary'),
        fetch('/api/links/recent'),
        fetch('/api/links/analytics?range=30d&activityLimit=5'),
        fetch('/api/jobs/summary'),
        fetch('/api/health'),
      ]);

      if (sumRes.ok) {
        const sJson = await sumRes.json();
        if (sJson?.summary) setSummary(sJson.summary);
      }
      if (recRes.ok) {
        const rJson = await recRes.json();
        if (Array.isArray(rJson?.links)) setRecentLinks(rJson.links);
      }
      if (anaRes.ok) {
        const aJson = await anaRes.json();
        if (aJson?.analytics) setAnalyticsPreview(aJson.analytics);
      }
      if (jobsRes.ok) {
        const jJson = await jobsRes.json();
        if (jJson?.summary) setJobsSummary(jJson);
      }
      if (healthRes.ok) {
        const hJson = await healthRes.json();
        if (hJson?.capabilities) setHealth(hJson);
      }

      if (!sumRes.ok && !recRes.ok) {
        setDashboardError('Unable to fetch dashboard data from server.');
      }
    } catch {
      setDashboardError('Network error connecting to LinkTwin API.');
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
    loadDashboardData();
  }, [loadDashboardData]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const handleCopyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    showToast('Short link copied to clipboard');
  };

  const handleUpdatePreferences = (patch: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const next = saveUserPreferences({ ...prev, ...patch });
      return next;
    });
  };

  const handleResetPreferences = () => {
    const next = resetUserPreferences();
    setPreferences(next);
    showToast('Preferences reset to defaults');
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    showToast('Local quick history cleared');
  };

  const handleLinkGenerated = (result: GeneratedLinkResult) => {
    setCurrentResult(result);
    try {
      const filtered = history.filter((item) => item.link.code !== result.link.code);
      const updated = [result, ...filtered].slice(0, 20);
      setHistory(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    loadDashboardData();
    setRefreshSignal((s) => s + 1);
  };

  const handleNavigate = (view: DashboardView, utilitySubTab?: UtilityTab) => {
    if (utilitySubTab) setUtilityInitialTab(utilitySubTab);
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInspectMedia = (url: string) => {
    setMediaInspectUrl(url);
    setActiveView('media');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openQrModal = (result?: GeneratedLinkResult) => {
    const target = result || currentResult;
    if (target) {
      setQrTargetResult(target);
      setQrModalOpen(true);
    }
  };

  const openAnalyticsModal = (code?: string) => {
    const targetCode = code || currentResult?.link.code;
    if (targetCode) {
      setAnalyticsCode(targetCode);
      setAnalyticsOpen(true);
    }
  };

  const viewMeta = VIEW_META[activeView];

  return (
    <div className="min-h-screen bg-[#f4f4f6] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex selection:bg-red-500/30">
      <DashboardSidebar
        activeView={activeView}
        onSelectView={(v) => handleNavigate(v)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        totalLinks={summary?.totalLinks}
        health={health}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Top Bar */}
        <header className="h-14 sticky top-0 z-20 px-4 sm:px-6 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate">
                {viewMeta.title}
              </h1>
              <p className="hidden sm:block text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {viewMeta.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                handleUpdatePreferences({
                  theme: preferences.theme === 'dark' ? 'light' : 'dark',
                })
              }
              aria-label={`Switch to ${preferences.theme === 'dark' ? 'light' : 'dark'} theme`}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              title={`Theme: ${preferences.theme}`}
            >
              {preferences.theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-zinc-700" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView('overview');
                setTimeout(() => {
                  document.getElementById('url-input')?.focus();
                }, 60);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Link</span>
            </button>
          </div>
        </header>

        {/* Workspace Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 max-w-7xl w-full mx-auto">
          {activeView === 'overview' && (
            <OverviewView
              summary={summary}
              recentLinks={recentLinks}
              analyticsPreview={analyticsPreview}
              jobsSummary={jobsSummary}
              health={health}
              currentResult={currentResult}
              sampleUrl={sampleUrl}
              loading={dashboardLoading}
              error={dashboardError}
              onRetryLoad={loadDashboardData}
              onLinkGenerated={handleLinkGenerated}
              onOpenQr={openQrModal}
              onOpenSimulator={() => setSimulatorOpen(true)}
              onOpenAnalyticsModal={openAnalyticsModal}
              onInspectMedia={handleInspectMedia}
              onNavigate={handleNavigate}
              onCopyText={handleCopyText}
            />
          )}

          {activeView === 'links' && (
            <SmartLinksView
              compactTables={preferences.compactTables}
              onOpenQr={openQrModal}
              onOpenAnalyticsModal={(c) => openAnalyticsModal(c)}
              onLinksMutated={() => {
                loadDashboardData();
                setRefreshSignal((s) => s + 1);
              }}
              refreshSignal={refreshSignal}
            />
          )}

          {activeView === 'analytics' && (
            <AnalyticsView
              compactTables={preferences.compactTables}
              onOpenLinkAnalytics={(c) => openAnalyticsModal(c)}
              refreshSignal={refreshSignal}
            />
          )}

          {activeView === 'media' && (
            <MediaToolsSection
              embedded
              externalUrl={mediaInspectUrl}
              objectStorageConfigured={health?.capabilities.objectStorageConfigured}
              browserWasmMaxMb={health?.capabilities.limits.browserWasmMaxMb}
            />
          )}

          {activeView === 'utilities' && (
            <UtilitiesSection
              embedded
              initialTab={utilityInitialTab}
              defaultQrSize={preferences.defaultQrSize}
              defaultQrEc={preferences.defaultQrEc}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              preferences={preferences}
              onUpdatePreferences={handleUpdatePreferences}
              onResetPreferences={handleResetPreferences}
              onClearLocalHistory={handleClearHistory}
              localHistoryCount={history.length}
              health={health}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile Quick Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#0d0d10]/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-6"
      >
        {(
          [
            { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
            { id: 'links', label: 'Links', icon: <Link2 className="w-4 h-4" /> },
            { id: 'analytics', label: 'Stats', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'media', label: 'Media', icon: <Film className="w-4 h-4" /> },
            { id: 'utilities', label: 'Tools', icon: <Wrench className="w-4 h-4" /> },
            { id: 'settings', label: 'Config', icon: <Settings className="w-4 h-4" /> },
          ] as Array<{ id: DashboardView; label: string; icon: React.ReactNode }>
        ).map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`py-2 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-16 lg:bottom-6 right-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium shadow-lg">
          <Check className="w-3.5 h-3.5 text-emerald-500" />
          {toastMsg}
        </div>
      )}

      {/* Existing Modals */}
      <div className="lt-adaptive-surface">
        <QrCodeModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          shortUrl={qrTargetResult?.shortUrl || ''}
          title={qrTargetResult?.link.title || ''}
          platform={qrTargetResult?.link.platform || 'youtube'}
        />

        <DeviceSimulatorModal
          isOpen={simulatorOpen}
          onClose={() => setSimulatorOpen(false)}
          result={currentResult}
        />

        <AnalyticsModal
          isOpen={analyticsOpen}
          onClose={() => setAnalyticsOpen(false)}
          code={analyticsCode}
        />
      </div>
    </div>
  );
};

export default App;
