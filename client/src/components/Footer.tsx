import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-white/[0.06] bg-[#0a0a0d] py-7 text-zinc-500 text-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-md bg-zinc-900 border border-white/[0.1] flex items-center justify-center">
            <span className="w-2 h-2 rounded-sm bg-rose-500" />
          </div>
          <span className="font-display font-semibold text-zinc-300">
            Link<span className="text-rose-500">Twin</span>
          </span>
          <span className="text-zinc-700">&bull;</span>
          <span className="text-zinc-500">Smart Links &middot; Thumbnail Downloader &middot; Image Upscaler</span>
        </div>

        <p className="text-center sm:text-right text-[11px] text-zinc-500">
          &copy; {new Date().getFullYear()} LinkTwin. Not affiliated with YouTube, Instagram, or Facebook.
        </p>
      </div>
    </footer>
  );
};
