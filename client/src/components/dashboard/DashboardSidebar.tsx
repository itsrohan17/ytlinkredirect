import React from 'react';
import {
  LayoutDashboard,
  Link2,
  BarChart3,
  Film,
  Wrench,
  Settings,
  X,
  Database,
  Play,
} from 'lucide-react';
import { DashboardView, ServerHealthStatus } from '../../types';

interface DashboardSidebarProps {
  activeView: DashboardView;
  onSelectView: (view: DashboardView) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  totalLinks?: number;
  health?: ServerHealthStatus | null;
}

const NAV_ITEMS: Array<{
  id: DashboardView;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'links', label: 'Smart Links', icon: <Link2 className="w-4 h-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'media', label: 'Media Studio', icon: <Film className="w-4 h-4" /> },
  { id: 'utilities', label: 'Utilities', icon: <Wrench className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeView,
  onSelectView,
  mobileOpen,
  onCloseMobile,
  totalLinks,
  health,
}) => {
  const handleSelect = (view: DashboardView) => {
    onSelectView(view);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0d0d10] border-r border-zinc-200 dark:border-zinc-800/90">
      {/* Brand Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/90">
        <button
          type="button"
          onClick={() => handleSelect('overview')}
          className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg p-1"
        >
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-sm">
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-white block leading-none">
              Link<span className="text-red-500">Twin</span>
            </span>
            <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
              Smart Links &amp; Studio
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Close navigation menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Primary Sidebar Navigation" className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                active
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2.5">
                {item.icon}
                <span>{item.label}</span>
              </span>
              {item.id === 'links' && typeof totalLinks === 'number' && (
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {totalLinks}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Supported Platforms + Infrastructure Status Footer */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800/90 space-y-2.5">
        <div className="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 text-[11px] space-y-1">
          <div className="flex items-center justify-between font-medium text-zinc-700 dark:text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              {health?.capabilities?.databaseMode === 'turso'
                ? 'Turso Cloud DB'
                : health?.capabilities?.databaseMode === 'memory'
                ? 'In-Memory Fallback'
                : 'Local SQLite'}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Healthy" />
          </div>
          <div className="text-zinc-500 dark:text-zinc-400">
            Worker storage:{' '}
            {health?.capabilities?.objectStorageConfigured ? 'Configured' : 'Browser-only mode'}
          </div>
        </div>

        <p className="px-2 text-[10px] text-zinc-500 leading-tight">
          Platforms: YouTube, Instagram &amp; Facebook
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop + Panel */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-10 shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
