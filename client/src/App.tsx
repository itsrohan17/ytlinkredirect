import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { UrlGenerator } from './components/UrlGenerator';
import { ResultCard } from './components/ResultCard';
import { ComparisonSection } from './components/ComparisonSection';
import { HowItWorks } from './components/HowItWorks';
import { SupportedFormats } from './components/SupportedFormats';
import { RecentHistory } from './components/RecentHistory';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { QrCodeModal } from './components/QrCodeModal';
import { DeviceSimulatorModal } from './components/DeviceSimulatorModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import { GeneratedLinkResult } from './types';

const STORAGE_KEY = 'yt_linktwin_history';

export const App: React.FC = () => {
  const [currentResult, setCurrentResult] = useState<GeneratedLinkResult | null>(null);
  const [history, setHistory] = useState<GeneratedLinkResult[]>([]);
  const [sampleUrl, setSampleUrl] = useState<string>('');

  // Modals state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrTargetResult, setQrTargetResult] = useState<GeneratedLinkResult | null>(null);

  const [simulatorOpen, setSimulatorOpen] = useState(false);

  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsCode, setAnalyticsCode] = useState<string>('');

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // Save history to localStorage
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

    // Smooth scroll to result
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
      {/* Background ambient radial gradients */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none -z-10 radial-glow" />

      {/* Navbar */}
      <Navbar onScrollTo={handleScrollTo} recentCount={history.length} />

      {/* Main Container */}
      <main className="flex-1 pb-16">
        <Hero />

        {/* Generator Section */}
        <UrlGenerator 
          onSuccess={handleLinkGenerated} 
          initialUrl={sampleUrl}
        />

        {/* Active Result Card */}
        {currentResult && (
          <ResultCard
            result={currentResult}
            onOpenQr={() => openQrModal(currentResult)}
            onOpenSimulator={() => setSimulatorOpen(true)}
            onOpenAnalytics={() => openAnalytics(currentResult.link.code)}
          />
        )}

        {/* Recent Generated Links History */}
        <RecentHistory
          history={history}
          onClearHistory={handleClearHistory}
          onOpenQr={openQrModal}
          onOpenAnalytics={openAnalytics}
        />

        {/* Comparison Section */}
        <ComparisonSection />

        {/* How It Works */}
        <HowItWorks />

        {/* Supported Formats Showcase */}
        <SupportedFormats onSelectSample={handleSelectSample} />

        {/* FAQ Section */}
        <FaqSection />
      </main>

      {/* Footer */}
      <Footer />

      {/* Modals */}
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
