import React, { useState, Suspense } from 'react';
import { Download, Maximize2, ArrowUpRight, Loader2 } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { UrlGenerator } from './components/UrlGenerator';
import { ResultCard } from './components/ResultCard';
import { Footer } from './components/Footer';
import { AppView, GeneratedLinkResult } from './types';
import type { UpscalerInitialSource } from './components/ImageUpscaler';

const ThumbnailDownloader = React.lazy(() =>
  import('./components/ThumbnailDownloader').then((m) => ({ default: m.ThumbnailDownloader }))
);
const ImageUpscaler = React.lazy(() =>
  import('./components/ImageUpscaler').then((m) => ({ default: m.ImageUpscaler }))
);

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>('links');
  const [currentResult, setCurrentResult] = useState<GeneratedLinkResult | null>(null);
  const [thumbnailTargetUrl, setThumbnailTargetUrl] = useState<string>('');
  const [upscalerSource, setUpscalerSource] = useState<UpscalerInitialSource | null>(null);

  const handleOpenThumbnails = (url?: string) => {
    if (url) setThumbnailTargetUrl(url);
    setActiveView('thumbnails');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSendToUpscaler = (source?: UpscalerInitialSource) => {
    if (source) setUpscalerSource(source);
    setActiveView('upscaler');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen bg-[#0a0a0d] text-zinc-100 flex flex-col overflow-x-clip">
      {/* Subtle Architectural Backdrop */}
      <div className="fixed inset-x-0 top-0 h-[540px] pointer-events-none studio-ambient -z-10" aria-hidden="true" />
      <div className="fixed inset-x-0 top-0 h-[440px] pointer-events-none studio-grid -z-10" aria-hidden="true" />

      <Navbar activeView={activeView} onSelectView={setActiveView} />

      <main className="flex-1 pb-16">
        {activeView === 'links' && (
          <div key="view-links" className="max-w-5xl mx-auto px-4 sm:px-6 animate-fadeIn">
            <Hero />

            <UrlGenerator onSuccess={setCurrentResult} />

            {currentResult && (
              <ResultCard
                result={currentResult}
                onDownloadThumbnails={(url) => handleOpenThumbnails(url)}
              />
            )}

            {/* Two Focused Tool Cards */}
            <section aria-label="Creator Tools" className="max-w-3xl mx-auto mt-10">
              <div className="flex items-center justify-between mb-3 px-0.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Included Creator Tools
                </h2>
                <span className="text-[11px] text-zinc-600">Built for YouTube &amp; social assets</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tool Card 1: Thumbnail Downloader */}
                <button
                  type="button"
                  onClick={() => handleOpenThumbnails()}
                  className="group relative text-left rounded-2xl studio-panel-subtle p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-[#14141a] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 overflow-hidden"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden="true"
                  />

                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/15 transition-colors">
                      <Download className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 group-hover:text-emerald-300 transition-colors">
                      <span>1280&times;720 Source</span>
                      <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>

                  <h3 className="font-display text-[15px] font-semibold text-white">
                    YouTube Thumbnail Downloader
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    Inspect available YouTube video &amp; Shorts resolutions and download authentic source files in JPG or PNG.
                  </p>
                </button>

                {/* Tool Card 2: Image Upscaler */}
                <button
                  type="button"
                  onClick={() => handleSendToUpscaler()}
                  className="group relative text-left rounded-2xl studio-panel-subtle p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-[#14141a] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/70 overflow-hidden"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/45 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden="true"
                  />

                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:bg-rose-500/15 transition-colors">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 group-hover:text-rose-300 transition-colors">
                      <span>2&times; / 4&times; Split View</span>
                      <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>

                  <h3 className="font-display text-[15px] font-semibold text-white">
                    Image Upscaler
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    Upscale thumbnails and photos cleanly at 2&times; or 4&times; with before/after comparison and crisp detail enhancement.
                  </p>
                </button>
              </div>
            </section>
          </div>
        )}

        <Suspense
          fallback={
            <div className="py-24 flex items-center justify-center gap-2.5 text-xs font-medium text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
              <span>Loading workspace...</span>
            </div>
          }
        >
          {activeView === 'thumbnails' && (
            <div key="view-thumbnails" className="animate-fadeIn">
              <ThumbnailDownloader
                initialUrl={thumbnailTargetUrl}
                onSendToUpscaler={(src) => handleSendToUpscaler(src)}
              />
            </div>
          )}

          {activeView === 'upscaler' && (
            <div key="view-upscaler" className="animate-fadeIn">
              <ImageUpscaler initialSource={upscalerSource} />
            </div>
          )}
        </Suspense>
      </main>

      <Footer />
    </div>
  );
};

export default App;
