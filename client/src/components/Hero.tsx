import React from 'react';
import { PlatformIcon } from './PlatformIcon';

export const Hero: React.FC = () => {
  return (
    <div className="pt-10 pb-6 sm:pt-14 sm:pb-8 text-center">
      <div className="inline-flex items-center gap-3 px-3.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs font-medium mb-5">
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

      <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-[1.15]">
        App-First Social Links &amp; YouTube Thumbnails
      </h1>

      <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
        Route visitors straight into YouTube, Instagram, and Facebook mobile apps with safe browser fallback.
      </p>
    </div>
  );
};
