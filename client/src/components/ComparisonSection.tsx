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
          Why Standard Social Links Hurt Your Growth
        </h2>
        <p className="mt-4 text-base text-zinc-400">
          When you share normal YouTube, Instagram, or Facebook links on WhatsApp, Instagram, or Telegram, mobile viewers are often trapped in logged-out embedded browsers.
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
                Normal Social Link
              </span>
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Trapped in In-App WebViews</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Opens inside embedded in-app browsers instead of the native YouTube, Instagram, or Facebook app.
            </p>

            <ul className="space-y-3.5 text-sm text-zinc-300">
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span><strong>User is logged out:</strong> Viewers cannot like, follow, comment, or subscribe without signing in again.</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span><strong>OAuth blocks:</strong> Embedded WebViews block Google and social logins for security reasons.</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span><strong>Inferior playback:</strong> Lower video resolution and missing native app gestures for Reels and Shorts.</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span><strong>High audience drop-off:</strong> Visitors close the browser rather than typing their password.</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-zinc-800/80 flex items-center gap-2 text-xs text-red-400/90 font-medium">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span>Result: Lost followers, lower retention, wasted traffic</span>
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

            <h3 className="text-xl font-bold text-white mb-2">Direct Native App Routing</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Uses Android Intents, Android App Links, and iOS Universal Links wherever supported by the OS.
            </p>

            <ul className="space-y-3.5 text-sm text-zinc-200">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Seamless engagement:</strong> Viewers land directly in their logged-in YouTube, Instagram, or Facebook app.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>1-tap follow &amp; subscribe:</strong> Zero login prompts, zero friction.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Native playback quality:</strong> Full HD/4K video, Shorts, and Reels player experience.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Guaranteed browser fallback:</strong> Automatically opens cleanly in the web browser when the app is unavailable.</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-zinc-800/80 flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Result: Higher conversion across YouTube, Instagram &amp; Facebook</span>
          </div>
        </div>
      </div>
    </section>
  );
};
