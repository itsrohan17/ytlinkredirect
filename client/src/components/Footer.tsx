import React from 'react';
import { Play, ArrowUp, Code2, ShieldCheck, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full border-t border-zinc-800/80 bg-zinc-950/90 py-12 text-zinc-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-zinc-800/60">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-md shadow-red-600/30">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
            <div>
              <span className="font-bold text-white text-sm">
                Link<span className="text-red-500">Twin</span>
              </span>
              <p className="text-[11px] text-zinc-500">
                High-Conversion Smart YouTube Redirect Links
              </p>
            </div>
          </div>

          {/* Quick Badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              100% Free &amp; Permanent
            </span>
            <span className="text-zinc-700">&bull;</span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Code2 className="w-3.5 h-3.5 text-blue-400" />
              REST API Supported
            </span>
          </div>

          {/* Scroll to Top */}
          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition border border-zinc-800"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-zinc-500 text-[11px]">
          <p>
            &copy; {new Date().getFullYear()} LinkTwin. Not affiliated with or endorsed by YouTube or Google LLC.
          </p>
          <p className="flex items-center justify-center gap-1">
            Built for YouTube creators, artists &amp; marketers.
          </p>
        </div>
      </div>
    </footer>
  );
};
