import React from 'react';
import { Smartphone, Zap, ShieldCheck, Share2 } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <div className="relative pt-12 pb-8 sm:pt-16 sm:pb-12 text-center overflow-hidden">
      {/* Background glow decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Pill header */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold tracking-wide uppercase mb-6 shadow-sm">
        <Zap className="w-3.5 h-3.5 text-red-500 fill-current animate-pulse" />
        <span>Next-Gen Smart Redirection Engine</span>
      </div>

      {/* Title */}
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.15]">
        Convert YouTube Links into{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-red-600">
          Smart App Redirects
        </span>
      </h1>

      {/* Subtitle */}
      <p className="mt-5 text-base sm:text-lg lg:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
        Stop losing views and subscribers to annoying in-app browsers in Instagram, TikTok, and WhatsApp.
        Our smart links automatically open the <strong>native YouTube app</strong> on iOS and Android.
      </p>

      {/* Feature Badges */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-zinc-300">
        <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800/80 px-3 py-1.5 rounded-lg shadow-sm">
          <Smartphone className="w-4 h-4 text-red-400" />
          <span>Direct iOS & Android App Launch</span>
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800/80 px-3 py-1.5 rounded-lg shadow-sm">
          <Share2 className="w-4 h-4 text-rose-400" />
          <span>Full WhatsApp & Telegram Previews</span>
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800/80 px-3 py-1.5 rounded-lg shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Browser Fallback Guarantee</span>
        </div>
      </div>
    </div>
  );
};
