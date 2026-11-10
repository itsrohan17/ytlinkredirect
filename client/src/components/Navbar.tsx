import React from 'react';
import { Play, Link2, Download, Sparkles } from 'lucide-react';
import { AppView } from '../types';

interface NavbarProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
}

const NAV_ITEMS: Array<{ id: AppView; label: string; icon: React.ReactNode }> = [
  { id: 'links', label: 'Smart Links', icon: <Link2 className="w-4 h-4" /> },
  { id: 'thumbnails', label: 'Thumbnail Downloader', icon: <Download className="w-4 h-4" /> },
  { id: 'ai', label: 'AI Thumbnail Generator', icon: <Sparkles className="w-4 h-4" /> },
];

export const Navbar: React.FC<NavbarProps> = ({ activeView, onSelectView }) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-[#09090b]/85 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onSelectView('links')}
          className="flex items-center gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-white shadow-md shadow-red-600/20">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white">
            Link<span className="text-red-500">Twin</span>
          </span>
        </button>

        {/* Desktop 3-Tab Navigation */}
        <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800 p-1 rounded-xl">
          {NAV_ITEMS.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                  active
                    ? 'bg-zinc-800 text-white shadow-xs border border-zinc-700/80'
                    : 'text-zinc-400 hover:text-zinc-100 border border-transparent'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mobile Compact 3-Tab Strip */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden border-t border-zinc-800/80 px-2 py-1.5 grid grid-cols-3 gap-1 bg-[#09090b]"
      >
        {NAV_ITEMS.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-semibold transition-colors ${
                active
                  ? 'bg-zinc-800 text-white border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.icon}
              <span className="truncate">{item.label.replace(' Generator', '').replace(' Downloader', 's')}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
