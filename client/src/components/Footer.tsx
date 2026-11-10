import React from 'react';
import { Play } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-zinc-800/80 bg-zinc-950/90 py-8 text-zinc-500 text-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-red-600 flex items-center justify-center text-white">
            <Play className="w-3 h-3 fill-current ml-0.5" />
          </div>
          <span className="font-bold text-zinc-200">
            Link<span className="text-red-500">Twin</span>
          </span>
          <span className="text-zinc-600">&bull;</span>
          <span>Smart Links &amp; YouTube Thumbnails</span>
        </div>

        <p className="text-center sm:text-right text-[11px]">
          &copy; {new Date().getFullYear()} LinkTwin. Not affiliated with YouTube, Instagram, or Facebook.
        </p>
      </div>
    </footer>
  );
};
