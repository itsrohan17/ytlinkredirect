import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { UrlGenerator } from './components/UrlGenerator';
import { ResultCard } from './components/ResultCard';
import { MediaToolsSection } from './components/MediaToolsSection';
import { UtilitiesSection } from './components/UtilitiesSection';
import { ComparisonSection } from './components/ComparisonSection';
import { HowItWorks } from './components/HowItWorks';
import { SupportedFormats } from './components/SupportedFormats';
import { RecentHistory } from './components/RecentHistory';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { QrCodeModal } from './components/QrCodeModal';
import { DeviceSimulatorModal } from './components/DeviceSimulatorModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import { PlatformIcon } from './components/PlatformIcon';
import { GeneratedLinkResult, PlatformAnalyticsSummary } from './types';

const STORAGE_KEY = 'yt_linktwin_history';

export const App: React.FC = () => {
  const [currentResult, setCurrentResult] = useState<GeneratedLinkResult | null>(null);
  const [history, setHistory] = useState<GeneratedLinkResult[]>([]);
  const [sampleUrl, setSampleUrl] = useState<string>('');
  const [mediaInspectUrl, setMediaInspectUrl] = useState<string>('');
  const [summary, setSummary] = useState<PlatformAnalyticsSummary | null>(null);

  // Modals state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrTargetResult, setQrTargetResult] = useState<GeneratedLinkResult | null>(null);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsCode, setAnalyticsCode] = useState<string>('');

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/links/summary');
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) {
          const data = JSON.parse(text);
          if (data?.summary) setSummary(data.summary);
        }
      }
    } catch {}
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {}
    fetchSummary();
  }, []);

  const saveToHistory = (newResult: GeneratedLinkResult) => {
    try {
      const filtered = history.filter((item) => item.link.code !== newResult.link.code);
      const updated = [newResult, ...filtered].slice(0, 20);
      setHistory(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleLinkGenerated = (result: GeneratedLinkResult) => {
    setCurrentResult(result);
    saveToHistory(result);
    fetchSummary();

    setTimeout(() => {
      const el = document.getElementById('generator');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  const handleSelectSample = (url: string) => {
    setSampleUrl(url);
    const el = document.getElementById('generator');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleInspectMedia = (url: string) => {
    setMediaInspectUrl(url);
    const el = document.getElementById('media-tools');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const openQrModal = (result?: GeneratedLinkResult) => {
    const target = result || currentResult;
    if (target) {
      setQrTargetResult(target);
      setQrModalOpen(true);
    }
  };

  const openAnalytics = (code?: string) => {
    const targetCode = code || currentResult?.link.code;
    if (targetCode) {
      setAnalyticsCode(targetCode);
      setAnalyticsOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-red-500/30 selection:text-red-200">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none -z-10 radial-glow" />

      <Navbar onScrollTo={handleScrollTo} recentCount={history.length} />

      <main className="flex-1 pb-16">
        <Hero />

        <UrlGenerator onSuccess={handleLinkGenerated} initialUrl={sampleUrl} />

        {currentResult && (
          <ResultCard
            result={currentResult}
            onOpenQr={() => openQrModal(currentResult)}
            onOpenSimulator={() => setSimulatorOpen(true)}
            onOpenAnalytics={() => openAnalytics(currentResult.link.code)}
            onInspectMedia={handleInspectMedia}
          />
        )}

        {/* Platform Analytics Summary Strip */}
        {summary && summary.totalLinks > 0 && (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-6">
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">Platform Telemetry:</span>
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <PlatformIcon platform="youtube" className="w-3.5 h-3.5 text-red-500" />
                  <strong className="text-white">{summary.byPlatform.youtube.links}</strong> links &bull;{' '}
                  {summary.byPlatform.youtube.clicks} clicks
                </span>
                <span className="flex items-center gap-1.5">
                  <PlatformIcon platform="instagram" className="w-3.5 h-3.5 text-pink-500" />
                  <strong className="text-white">{summary.byPlatform.instagram.links}</strong> links &bull;{' '}
                  {summary.byPlatform.instagram.clicks} clicks
                </span>
                <span className="flex items-center gap-1.5">
                  <PlatformIcon platform="facebook" className="w-3.5 h-3.5 text-blue-500" />
                  <strong className="text-white">{summary.byPlatform.facebook.links}</strong> links &bull;{' '}
                  {summary.byPlatform.facebook.clicks} clicks
                </span>
              </div>
            </div>
          </div>
        )}

        <RecentHistory
          history={history}
          onClearHistory={handleClearHistory}
          onOpenQr={openQrModal}
          onOpenAnalytics={openAnalytics}
        />

        <MediaToolsSection externalUrl={mediaInspectUrl} />

        <UtilitiesSection />

        <ComparisonSection />

        <HowItWorks />

        <SupportedFormats onSelectSample={handleSelectSample} />

        <FaqSection />
      </main>

      <Footer />

      {qrTargetResult && (
        <QrCodeModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          shortUrl={qrTargetResult.shortUrl}
          title={qrTargetResult.link.title}
        />
      )}

      {currentResult && (
        <DeviceSimulatorModal
          isOpen={simulatorOpen}
          onClose={() => setSimulatorOpen(false)}
          result={currentResult}
        />
      )}

      <AnalyticsModal
        isOpen={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        code={analyticsCode}
      />
    </div>
  );
};

export default App;
