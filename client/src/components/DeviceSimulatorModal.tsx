import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Monitor,
  ExternalLink,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Globe,
} from 'lucide-react';
import { GeneratedLinkResult, Platform } from '../types';
import { PlatformIcon, getPlatformMeta } from './PlatformIcon';

interface DeviceSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: GeneratedLinkResult;
}

type SimulatorPlatform = 'android' | 'ios' | 'inapp' | 'desktop';

export const DeviceSimulatorModal: React.FC<DeviceSimulatorModalProps> = ({
  isOpen,
  onClose,
  result,
}) => {
  const [simMode, setSimMode] = useState<SimulatorPlatform>('android');
  const [redirected, setRedirected] = useState(false);
  const [promptOpen, setPromptOpen] = useState(true);

  if (!isOpen) return null;

  const { link, shortUrl, parsed } = result;
  const targetPlatform: Platform = link.platform || parsed?.platform || 'youtube';
  const brandMeta = getPlatformMeta(targetPlatform);

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
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
              <PlatformIcon platform={targetPlatform} className={`w-5 h-5 ${brandMeta.iconColor}`} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{brandMeta.label} Redirection Simulator</span>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  Interactive
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Preview how this {brandMeta.label} smart link behaves across mobile and desktop
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
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800 text-xs sm:text-sm">
            <button
              onClick={() => {
                setSimMode('android');
                handleReset();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                simMode === 'android'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android Intent</span>
            </button>

            <button
              onClick={() => {
                setSimMode('ios');
                handleReset();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                simMode === 'ios'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>iPhone (iOS)</span>
            </button>

            <button
              onClick={() => {
                setSimMode('inapp');
                handleReset();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                simMode === 'inapp'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>In-App WebView</span>
            </button>

            <button
              onClick={() => {
                setSimMode('desktop');
                handleReset();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                simMode === 'desktop'
                  ? 'bg-emerald-600 text-white shadow-sm'
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
          <div className="lg:col-span-7 flex justify-center">
            {simMode === 'desktop' ? (
              <div className="w-full rounded-xl bg-zinc-900 border border-zinc-700/80 shadow-2xl overflow-hidden font-sans">
                <div className="h-9 bg-zinc-800 px-3 flex items-center gap-2 border-b border-zinc-700">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="flex-1 max-w-sm mx-auto bg-zinc-950 px-3 py-1 rounded-md text-[11px] text-zinc-300 font-mono truncate">
                    {redirected ? link.clean_url || link.clean_youtube_url : shortUrl}
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
                        Desktop visitors bypass the mobile interstitial and go straight to {brandMeta.label} in their web browser.
                      </p>
                      <div className="pt-2">
                        <a
                          href={link.clean_url || link.clean_youtube_url}
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
                        className={`px-4 py-2 text-white rounded-lg text-xs font-bold transition shadow-lg ${brandMeta.buttonClass}`}
                      >
                        Simulate Link Click
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative w-[280px] sm:w-[310px] h-[540px] rounded-[36px] bg-black border-4 border-zinc-700 shadow-2xl p-3 flex flex-col justify-between overflow-hidden">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-zinc-800 rounded-full z-20 flex items-center justify-end pr-2">
                  <div className="w-2 h-2 rounded-full bg-zinc-950" />
                </div>

                <div className="w-full h-full rounded-[26px] bg-[#09090b] overflow-hidden flex flex-col pt-8 pb-3 px-3 relative text-center">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1 mb-3">
                    <span>9:41</span>
                    <span className="font-mono text-[9px] uppercase">
                      {simMode === 'android'
                        ? 'Android'
                        : simMode === 'ios'
                        ? 'iOS'
                        : 'In-App Browser'}
                    </span>
                    <span>100%</span>
                  </div>

                  {redirected ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-3 animate-fadeIn space-y-3 bg-zinc-900/60 rounded-xl">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl ${brandMeta.buttonClass}`}
                      >
                        <PlatformIcon platform={targetPlatform} className="w-6 h-6" />
                      </div>
                      <h4 className="text-xs font-bold text-white">{brandMeta.label} App Opened!</h4>
                      <p className="text-[11px] text-zinc-400">
                        User views the content natively in the {brandMeta.label} app while logged in, with full fallback protection if the app is absent.
                      </p>
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                        App Handshake Complete
                      </span>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-between py-2 text-left">
                      <div>
                        <div className="w-full aspect-video rounded-lg overflow-hidden bg-zinc-800 mb-2 relative">
                          <img
                            src={link.thumbnail_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${brandMeta.buttonClass}`}
                            >
                              <PlatformIcon platform={targetPlatform} className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] font-bold text-white line-clamp-1">{link.title}</p>
                        <p className="text-[10px] text-zinc-400 mb-3">{link.author_name}</p>
                      </div>

                      {simMode === 'ios' && !parsed.iosPreferUniversalLink && promptOpen && (
                        <div className="bg-zinc-800/95 border border-zinc-700 p-3 rounded-xl shadow-xl text-center space-y-2 mb-3 animate-fadeIn">
                          <p className="text-[11px] font-semibold text-white">
                            Open this page in &quot;{brandMeta.label}&quot;?
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
                              className={`py-1 rounded text-white ${brandMeta.buttonClass}`}
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <button
                          onClick={() => setRedirected(true)}
                          className={`w-full py-2.5 rounded-lg text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition ${brandMeta.buttonClass}`}
                        >
                          <PlatformIcon platform={targetPlatform} className="w-3.5 h-3.5" />
                          <span>Open in {brandMeta.label} App</span>
                        </button>

                        <p className="text-[9px] text-center text-zinc-500">
                          Safe browser fallback included
                        </p>
                      </div>
                    </div>
                  )}

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
                  {simMode === 'android' && 'Android App Intent + Fallback'}
                  {simMode === 'ios' &&
                    (parsed.iosPreferUniversalLink
                      ? 'iOS Verified Universal Link'
                      : 'iOS App Scheme + Smart Fallback')}
                  {simMode === 'inapp' && 'In-App WebView Guidance'}
                  {simMode === 'desktop' && 'Instant HTTP 302 Desktop Redirect'}
                </span>
              </h4>

              <p className="text-xs text-zinc-400 leading-relaxed">
                {simMode === 'android' &&
                  `On Android, we construct an intent:// URI targeting ${brandMeta.label}'s official Android package with S.browser_fallback_url. If the app is installed, Android opens it; otherwise it falls back cleanly to the browser.`}
                {simMode === 'ios' &&
                  (parsed.iosPreferUniversalLink
                    ? `For ${brandMeta.label} ${link.url_type}s, custom URL schemes do not support alphanumeric shortcodes reliably. We use verified HTTPS Universal Links so iOS launches the native app when permitted, or opens Safari cleanly.`
                    : `On iOS, we invoke ${brandMeta.label}'s documented app scheme with a visibility-timer fallback to Safari so users never hit dead links if the app isn't installed.`)}
                {simMode === 'inapp' &&
                  `Embedded WebViews (such as Instagram or Facebook in-app browsers) can restrict automatic app launches by OS policy. LinkTwin renders a fast interstitial with a manual 1-tap button and browser-switch tip.`}
                {simMode === 'desktop' &&
                  `Desktop browsers immediately receive an HTTP 302 redirect to the canonical ${brandMeta.label} URL with all query parameters preserved.`}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 font-mono text-[11px] space-y-1.5 text-zinc-300">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans font-semibold">
                Target Deep Link / Fallback:
              </div>
              <div className="text-emerald-400 break-all select-all">
                {simMode === 'android'
                  ? parsed.androidIntentUrl
                  : simMode === 'ios'
                  ? parsed.iosDeepLinkUrl
                  : parsed.webFallbackUrl}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
