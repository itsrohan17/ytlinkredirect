import React, { useState, Suspense } from 'react';
import { Download, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { UrlGenerator } from './components/UrlGenerator';
import { ResultCard } from './components/ResultCard';
import { Footer } from './components/Footer';
import { AppView, GeneratedLinkResult } from './types';

const ThumbnailDownloader = React.lazy(() =>
  import('./components/ThumbnailDownloader').then((m) => ({ default: m.ThumbnailDownloader }))
);
const AiThumbnailGenerator = React.lazy(() =>
  import('./components/AiThumbnailGenerator').then((m) => ({ default: m.AiThumbnailGenerator }))
);

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>('links');
  const [currentResult, setCurrentResult] = useState<GeneratedLinkResult | null>(null);
  const [thumbnailTargetUrl, setThumbnailTargetUrl] = useState<string>('');
  const [aiTopic, setAiTopic] = useState<string>('');

  const handleOpenThumbnails = (url?: string) => {
    if (url) setThumbnailTargetUrl(url);
    setActiveView('thumbnails');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAi = (topic?: string) => {
    if (topic) setAiTopic(topic);
    setActiveView('ai');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-red-500/30 selection:text-red-200">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[520px] pointer-events-none -z-10 radial-glow" />

      <Navbar activeView={activeView} onSelectView={setActiveView} />

      <main className="flex-1 pb-16">
        {activeView === 'links' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <Hero />

            <UrlGenerator onSuccess={setCurrentResult} />

            {currentResult && (
              <ResultCard
                result={currentResult}
                onDownloadThumbnails={(url) => handleOpenThumbnails(url)}
              />
            )}

            {/* Concise Quick-Access Cards to the 2 Thumbnail Tools */}
            <div className="max-w-3xl mx-auto mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleOpenThumbnails()}
                className="group text-left p-5 rounded-2xl glass-card hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Download className="w-4 h-4" />
                  </span>
                  <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </div>
                <h2 className="text-sm font-bold text-white">YouTube Thumbnail Downloader</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Download official HD, SD, and HQ thumbnails from YouTube videos and Shorts.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAi()}
                className="group text-left p-5 rounded-2xl glass-card hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </div>
                <h2 className="text-sm font-bold text-white">AI Thumbnail Generator</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Create 16:9 thumbnail artwork with NVIDIA FLUX.1-dev and customize headlines cleanly.
                </p>
              </button>
            </div>
          </div>
        )}

        <Suspense
          fallback={
            <div className="py-20 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin text-red-500" />
              Loading tool...
            </div>
          }
        >
          {activeView === 'thumbnails' && (
            <ThumbnailDownloader
              initialUrl={thumbnailTargetUrl}
              onOpenAiGenerator={(t) => handleOpenAi(t)}
            />
          )}

          {activeView === 'ai' && <AiThumbnailGenerator initialTopic={aiTopic} />}
        </Suspense>
      </main>

      <Footer />
    </div>
  );
};

export default App;
