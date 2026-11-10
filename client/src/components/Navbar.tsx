import React from 'react';
import { Play, Zap, Download, Wrench } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';

interface NavbarProps {
  onScrollTo: (id: string) => void;
  recentCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ onScrollTo, recentCount }) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-[#09090b]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 via-rose-600 to-red-700 text-white shadow-lg shadow-red-600/25 group-hover:shadow-red-600/40 transition-all duration-300">
            <Play className="w-5 h-5 fill-current ml-0.5" />
            <div className="absolute -inset-1 rounded-xl bg-red-600/20 blur-sm group-hover:bg-red-600/30 -z-10 transition-all" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-white">
                Link<span className="text-red-500">Twin</span>
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 rounded-md">
                Universal
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              YouTube &bull; Instagram &bull; Facebook
            </p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-zinc-400">
          <button
            onClick={() => onScrollTo('generator')}
            className="hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-red-500" />
            Smart Links
          </button>
          <button
            onClick={() => onScrollTo('media-tools')}
            className="hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Media Studio
          </button>
          <button
            onClick={() => onScrollTo('utilities-toolkit')}
            className="hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Wrench className="w-3.5 h-3.5 text-sky-400" />
            Utilities
          </button>
          <button
            onClick={() => onScrollTo('comparison')}
            className="hover:text-white transition-colors"
          >
            Why Smart Links
          </button>
          <button
            onClick={() => onScrollTo('supported-types')}
            className="hover:text-white transition-colors"
          >
            Platforms
          </button>
          <button
            onClick={() => onScrollTo('faq')}
            className="hover:text-white transition-colors"
          >
            FAQ
          </button>
          {recentCount > 0 && (
            <button
              onClick={() => onScrollTo('recent-history')}
              className="hover:text-white transition-colors flex items-center gap-1.5 text-zinc-300 bg-zinc-800/60 px-2.5 py-1 rounded-full text-xs border border-zinc-700/60"
            >
              <span>History</span>
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {recentCount}
              </span>
            </button>
          )}
        </nav>

        {/* Supported Platform Icons Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 shadow-sm">
          <PlatformIcon platform="youtube" className="w-4 h-4 text-red-500" />
          <PlatformIcon platform="instagram" className="w-3.5 h-3.5 text-pink-500" />
          <PlatformIcon platform="facebook" className="w-3.5 h-3.5 text-blue-500" />
          <span className="hidden sm:inline text-zinc-400 pl-1 border-l border-zinc-700">
            3 Platforms Ready
          </span>
        </div>
      </div>
    </header>
  );
};
