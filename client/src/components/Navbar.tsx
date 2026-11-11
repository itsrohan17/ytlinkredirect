import React, { useState } from 'react';
import { Link2, Download, Maximize2, Menu, X } from 'lucide-react';
import { AppView } from '../types';

interface NavbarProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
}

const NAV_ITEMS: Array<{
  id: AppView;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'links', label: 'Smart Links', shortLabel: 'Links', icon: Link2 },
  { id: 'thumbnails', label: 'Thumbnail Downloader', shortLabel: 'Thumbnails', icon: Download },
  { id: 'upscaler', label: 'Image Upscaler', shortLabel: 'Upscaler', icon: Maximize2 },
];

export const Navbar: React.FC<NavbarProps> = ({ activeView, onSelectView }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSelect = (view: AppView) => {
    onSelectView(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.07] bg-[#0a0a0d]/85 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand Mark */}
        <button
          type="button"
          onClick={() => handleSelect('links')}
          className="flex items-center gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/70 rounded-lg pr-1"
        >
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-b from-zinc-800 to-zinc-900 border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] group-hover:border-rose-500/50 transition-colors">
            <svg
              className="w-4 h-4 text-rose-500 group-hover:scale-105 transition-transform"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-bold text-[16px] tracking-tight text-white">
              Link<span className="text-rose-500">Twin</span>
            </span>
          </div>
        </button>

        {/* Desktop Centered Navigation */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-zinc-900/70 border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
        >
          {NAV_ITEMS.map((item) => {
            const active = activeView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/70 ${
                  active
                    ? 'bg-zinc-800/95 text-white border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.45)]'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-rose-400' : 'text-zinc-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Subtle Desktop Utility Label */}
        <div className="hidden lg:flex items-center gap-2 text-[11px] font-medium text-zinc-500">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500/90 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <span>YT &middot; IG &middot; FB Routing</span>
        </div>

        {/* Mobile Menu Trigger */}
        <div className="flex md:hidden items-center gap-2">
          <span className="text-xs font-medium text-zinc-300 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/[0.08]">
            {NAV_ITEMS.find((i) => i.id === activeView)?.shortLabel}
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="p-2 rounded-lg bg-zinc-900/90 border border-white/[0.08] text-zinc-300 hover:text-white hover:border-white/[0.15] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/70"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden border-t border-white/[0.07] bg-[#0e0e13]/95 backdrop-blur-xl px-4 py-3 space-y-1.5 animate-fadeIn"
        >
          {NAV_ITEMS.map((item) => {
            const active = activeView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-zinc-800/90 text-white border border-white/[0.1]'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${active ? 'text-rose-400' : 'text-zinc-500'}`} />
                  {item.label}
                </span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
};
