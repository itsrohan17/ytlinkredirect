import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  Monitor, 
  Play, 
  ExternalLink, 
  CheckCircle2, 
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { GeneratedLinkResult } from '../types';

interface DeviceSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: GeneratedLinkResult;
}

type SimulatorPlatform = 'android' | 'ios' | 'instagram' | 'desktop';

export const DeviceSimulatorModal: React.FC<DeviceSimulatorModalProps> = ({
  isOpen,
  onClose,
  result,
}) => {
  const [platform, setPlatform] = useState<SimulatorPlatform>('android');
  const [redirected, setRedirected] = useState(false);
  const [promptOpen, setPromptOpen] = useState(true);

  if (!isOpen) return null;

  const { link, shortUrl, parsed } = result;

  const handleReset = () => {
    setRedirected(false);
    setPromptOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div 
        className="relative w-full max-w-4xl rounded-2xl glass-card border border-zinc-700/80 p-5 sm:p-7 shadow-2xl text-left my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Interactive Redirection Simulator</span>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  Live Test
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Experience how your link behaves on different operating systems & apps
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 my-4">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800 text-xs sm:text-sm">
            <button
              onClick={() => { setPlatform('android'); handleReset(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                platform === 'android'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Android App</span>
            </button>

            <button
              onClick={() => { setPlatform('ios'); handleReset(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                platform === 'ios'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>iPhone (iOS)</span>
            </button>

            <button
              onClick={() => { setPlatform('instagram'); handleReset(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                platform === 'instagram'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <span>Instagram In-App</span>
            </button>

            <button
              onClick={() => { setPlatform('desktop'); handleReset(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                platform === 'desktop'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800/60 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo</span>
          </button>
        </div>

        {/* Simulator Frame Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Simulated Screen */}
          <div className="lg:col-span-7 flex justify-center">
            {platform === 'desktop' ? (
              /* Desktop Browser Window Mockup */
              <div className="w-full rounded-xl bg-zinc-900 border border-zinc-700/80 shadow-2xl overflow-hidden font-sans">
                <div className="h-9 bg-zinc-800 px-3 flex items-center gap-2 border-b border-zinc-700">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="flex-1 max-w-sm mx-auto bg-zinc-950 px-3 py-1 rounded-md text-[11px] text-zinc-300 font-mono truncate">
                    {redirected ? link.clean_youtube_url : shortUrl}
                  </div>
                </div>

                <div className="p-6 text-center min-h-[260px] flex flex-col items-center justify-center bg-zinc-950">
                  {redirected ? (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Instant Desktop 302 Redirection</h4>
                      <p className="text-xs text-zinc-400 max-w-sm">
                        Desktop visitors bypass the mobile interstitial and instantly land on the native YouTube video page!
                      </p>
                      <div className="pt-2">
                        <a
                          href={link.clean_youtube_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 underline"
                        >
                          <span>Visit destination page</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-zinc-400">Click below to test instant 302 redirect:</p>
                      <button
                        onClick={() => setRedirected(true)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-red-600/30"
                      >
                        Simulate Link Click
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Mobile Phone Mockup */
              <div className="relative w-[280px] sm:w-[310px] h-[540px] rounded-[36px] bg-black border-4 border-zinc-700 shadow-2xl p-3 flex flex-col justify-between overflow-hidden">
                {/* Mobile Notch / Island */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-zinc-800 rounded-full z-20 flex items-center justify-end pr-2">
                  <div className="w-2 h-2 rounded-full bg-zinc-950" />
                </div>

                {/* Mobile Screen Content */}
                <div className="w-full h-full rounded-[26px] bg-[#09090b] overflow-hidden flex flex-col pt-8 pb-3 px-3 relative text-center">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1 mb-3">
                    <span>9:41</span>
                    <span className="font-mono text-[9px] uppercase">
                      {platform === 'android' ? 'Android 14' : platform === 'ios' ? 'iOS 18' : 'Instagram'}
                    </span>
                    <span>100%</span>
                  </div>

                  {/* Redirection Content */}
                  {redirected ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-3 animate-fadeIn space-y-3 bg-zinc-900/60 rounded-xl">
                      <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center text-white shadow-xl shadow-red-600/50">
                        <Play className="w-6 h-6 fill-current ml-0.5" />
                      </div>
                      <h4 className="text-xs font-bold text-white">YouTube App Launched!</h4>
                      <p className="text-[11px] text-zinc-400">
                        Video opened directly in native player. User is signed in with Google, can 1-tap Like and Subscribe.
                      </p>
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                        100% Success
                      </span>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-between py-2 text-left">
                      {/* Mini Preview */}
                      <div>
                        <div className="w-full aspect-video rounded-lg overflow-hidden bg-zinc-800 mb-2 relative">
                          <img
                            src={link.thumbnail_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
                              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] font-bold text-white line-clamp-1">{link.title}</p>
                        <p className="text-[10px] text-zinc-400 mb-3">{link.author_name}</p>
                      </div>

                      {/* Simulated iOS Dialog if iOS */}
                      {platform === 'ios' && promptOpen && (
                        <div className="bg-zinc-800/95 border border-zinc-700 p-3 rounded-xl shadow-xl text-center space-y-2 mb-3 animate-fadeIn">
                          <p className="text-[11px] font-semibold text-white">
                            Open this page in &quot;YouTube&quot;?
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                            <button
                              onClick={() => setPromptOpen(false)}
                              className="py-1 rounded bg-zinc-700 text-zinc-300"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => setRedirected(true)}
                              className="py-1 rounded bg-red-600 text-white"
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Main Simulated CTA Button */}
                      <div className="space-y-2">
                        <button
                          onClick={() => setRedirected(true)}
                          className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/30 transition"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Open in YouTube App</span>
                        </button>
                        
                        <p className="text-[9px] text-center text-zinc-500">
                          Auto-launching in 1s...
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Home Indicator */}
                  <div className="w-20 h-1 bg-zinc-700 rounded-full mx-auto mt-2" />
                </div>
              </div>
            )}
          </div>

          {/* Explanation Panel */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>
                  {platform === 'android' && 'Android Intent Deep Linking'}
                  {platform === 'ios' && 'iOS Universal & URI Scheme'}
                  {platform === 'instagram' && 'In-App Browser Workaround'}
                  {platform === 'desktop' && 'Instant HTTP 302 Desktop Redirect'}
                </span>
              </h4>

              <p className="text-xs text-zinc-400 leading-relaxed">
                {platform === 'android' &&
                  'On Android, we construct an intent:// URI targeting package com.google.android.youtube. The Android OS automatically catches this intent and opens the native YouTube application without showing any browser prompt.'}
                {platform === 'ios' &&
                  'On iOS, the YouTube app registers the youtube:// scheme. We automatically trigger this deep link. If the user does not have the app installed, our smart timer detects it and redirects seamlessly to the web version.'}
                {platform === 'instagram' &&
                  'In Instagram and TikTok, embedded WebViews block certain native app redirects. LinkTwin displays an optimized prompt with a 1-tap app launch button and helpful instructions to open in external browser.'}
                {platform === 'desktop' &&
                  'Desktop computers already open YouTube natively in high performance. We detect Desktop user agents and execute an immediate HTTP 302 redirect with all original parameters intact.'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 font-mono text-[11px] space-y-1.5 text-zinc-300">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans font-semibold">
                Constructed Deep Link:
              </div>
              <div className="text-red-400 break-all select-all">
                {platform === 'android' ? parsed.androidIntentUrl : parsed.iosSchemeUrl}
              </div>
            </div>

            <div className="text-xs text-zinc-500">
              💡 <strong>Creator Benefit:</strong> Every user who opens via the YouTube app is automatically logged into their Google account, allowing them to subscribe, comment, and like with 1 tap.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
