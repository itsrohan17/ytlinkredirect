import React from 'react';
import { XCircle, CheckCircle2, TrendingDown, TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';

export const ComparisonSection: React.FC = () => {
  return (
    <section id="comparison" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
          <span>Side-by-Side Comparison</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Why Standard YouTube Links Hurt Your Growth
        </h2>
        <p className="mt-4 text-base text-zinc-400">
          When you post a normal YouTube link on Instagram bio, TikTok, or WhatsApp, it traps viewers in a restricted in-app browser.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {/* Normal Link (Bad) */}
        <div className="relative rounded-2xl bg-zinc-950/80 border border-red-950/80 p-6 sm:p-8 flex flex-col justify-between overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-3xl rounded-full" />
          
          <div>
            <div className="flex items-center justify-between mb-6">
              <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-500" />
                Normal YouTube Link
              </span>
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Trapped in In-App Browsers</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Opens inside Instagram / TikTok / WhatsApp WebViews instead of the native app.
            </p>

            <ul className="space-y-3.5 text-sm text-zinc-300">
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span><strong>User is logged out:</strong> YouTube prompts them to sign in before liking or commenting.</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span><strong>Lost subscriptions:</strong> Google blocks OAuth login inside embedded WebViews for security.</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span><strong>Inferior playback:</strong> Capped video quality, stuttering, and lacking native landscape gestures.</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span><strong>75%+ audience drop-off:</strong> Viewers close the in-app browser without interacting.</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-zinc-800/80 flex items-center gap-2 text-xs text-red-400/90 font-medium">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span>Result: Lost subscribers, lower retention, wasted traffic</span>
          </div>
        </div>

        {/* LinkTwin Smart Link (Good) */}
        <div className="relative rounded-2xl bg-zinc-900/90 border border-emerald-500/30 p-6 sm:p-8 flex flex-col justify-between shadow-2xl shadow-emerald-950/20 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />

          <div>
            <div className="flex items-center justify-between mb-6">
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                LinkTwin Smart Link
              </span>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Direct Native YouTube App</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Instantly triggers the YouTube app on iOS & Android using smart intent deep links.
            </p>

            <ul className="space-y-3.5 text-sm text-zinc-200">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Instant 1-tap engagement:</strong> Viewers are already signed into their Google accounts.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Instant subscribe & like:</strong> No passwords, no 2FA hurdles, no sign-in popups.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Full 4K HDR playback:</strong> Runs in native YouTube player with background audio and recommendations.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Guaranteed fallback:</strong> Automatically loads YouTube in web browser if app is not installed.</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-zinc-800/80 flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Result: Up to 3.5x higher subscriber conversion rate</span>
          </div>
        </div>
      </div>
    </section>
  );
};
