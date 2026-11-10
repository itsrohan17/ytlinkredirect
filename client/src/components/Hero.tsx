import React from 'react';
import { Smartphone, ShieldCheck, Share2, Zap } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';

export const Hero: React.FC = () => {
  return (
    <div className="relative pt-12 pb-8 sm:pt-16 sm:pb-12 text-center overflow-hidden">
      {/* Background glow decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[320px] bg-red-600/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      {/* Supported Platform Pills */}
      <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs font-semibold tracking-wide mb-6 shadow-sm">
        <span className="flex items-center gap-1.5 text-red-400">
          <PlatformIcon platform="youtube" className="w-3.5 h-3.5" />
          YouTube
        </span>
        <span className="text-zinc-700">&bull;</span>
        <span className="flex items-center gap-1.5 text-pink-400">
          <PlatformIcon platform="instagram" className="w-3.5 h-3.5" />
          Instagram
        </span>
        <span className="text-zinc-700">&bull;</span>
        <span className="flex items-center gap-1.5 text-blue-400">
          <PlatformIcon platform="facebook" className="w-3.5 h-3.5" />
          Facebook
        </span>
      </div>

      {/* Title */}
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.15]">
        Universal Social Links That{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-pink-500 to-blue-500">
          Open in Native Apps
        </span>
      </h1>

      {/* Subtitle */}
      <p className="mt-5 text-base sm:text-lg lg:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
        Convert YouTube, Instagram, and Facebook URLs into smart deep links. Route mobile visitors into native apps via Android App Links &amp; iOS Universal Links with reliable browser fallback.
      </p>

      {/* Feature Badges */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-zinc-300">
        <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800/80 px-3 py-1.5 rounded-lg shadow-sm">
          <Smartphone className="w-4 h-4 text-red-400" />
          <span>Android Intents &amp; iOS Universal Links</span>
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800/80 px-3 py-1.5 rounded-lg shadow-sm">
          <Share2 className="w-4 h-4 text-pink-400" />
          <span>Rich WhatsApp &amp; Telegram Previews</span>
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800/80 px-3 py-1.5 rounded-lg shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Safe Browser Fallback Always</span>
        </div>
      </div>
    </div>
  );
};
