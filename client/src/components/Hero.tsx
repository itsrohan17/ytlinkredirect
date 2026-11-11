import React from 'react';
import { PlatformIcon } from './PlatformIcon';

export const Hero: React.FC = () => {
  return (
    <section className="pt-10 pb-8 sm:pt-14 sm:pb-10 text-center relative">
      {/* Subtle supported platform strip */}
      <div className="inline-flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-zinc-900/80 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] text-[12px] font-medium mb-6">
        <span className="inline-flex items-center gap-1.5 text-zinc-200">
          <PlatformIcon platform="youtube" className="w-3.5 h-3.5 text-red-500" />
          <span>YouTube</span>
        </span>
        <span className="w-px h-3 bg-white/10" aria-hidden="true" />
        <span className="inline-flex items-center gap-1.5 text-zinc-200">
          <PlatformIcon platform="instagram" className="w-3.5 h-3.5 text-pink-500" />
          <span>Instagram</span>
        </span>
        <span className="w-px h-3 bg-white/10" aria-hidden="true" />
        <span className="inline-flex items-center gap-1.5 text-zinc-200">
          <PlatformIcon platform="facebook" className="w-3.5 h-3.5 text-blue-500" />
          <span>Facebook</span>
        </span>
      </div>

      <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.03em] text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-400 max-w-2xl mx-auto leading-[1.1]">
        App-first smart links for creators.
      </h1>

      <p className="mt-4 text-sm sm:text-[15px] text-zinc-400 max-w-xl mx-auto leading-relaxed">
        Route mobile visitors straight into native YouTube, Instagram, and Facebook apps instead of broken in-app browsers—with safe web fallback on every device.
      </p>
    </section>
  );
};
