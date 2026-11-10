import React, { useState, useEffect } from 'react';
import { Video, Image as ImageIcon, LayoutTemplate, Music, Info } from 'lucide-react';
import { VideoConverterTab } from './media/VideoConverterTab';
import { ImageStudioTab } from './media/ImageStudioTab';
import { ThumbnailStudioTab } from './media/ThumbnailStudioTab';
import { AudioStudioTab } from './media/AudioStudioTab';

interface MediaToolsSectionProps {
  externalUrl?: string;
  embedded?: boolean;
  objectStorageConfigured?: boolean;
  browserWasmMaxMb?: number;
}

type MediaStudioTab = 'video' | 'image' | 'thumbnail' | 'audio';

export const MediaToolsSection: React.FC<MediaToolsSectionProps> = ({
  externalUrl,
  embedded = false,
  objectStorageConfigured,
  browserWasmMaxMb = 100,
}) => {
  const [activeTab, setActiveTab] = useState<MediaStudioTab>('video');

  useEffect(() => {
    if (externalUrl) {
      setActiveTab('thumbnail');
    }
  }, [externalUrl]);

  const tabs: Array<{ id: MediaStudioTab; label: string; icon: React.ReactNode; activeClass: string }> = [
    {
      id: 'video',
      label: 'Video Converter',
      icon: <Video className="w-4 h-4" />,
      activeClass: 'bg-red-600 text-white shadow-md shadow-red-600/25',
    },
    {
      id: 'image',
      label: 'Image Studio',
      icon: <ImageIcon className="w-4 h-4" />,
      activeClass: 'bg-blue-600 text-white shadow-md shadow-blue-600/25',
    },
    {
      id: 'thumbnail',
      label: 'Thumbnail Studio',
      icon: <LayoutTemplate className="w-4 h-4" />,
      activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25',
    },
    {
      id: 'audio',
      label: 'Audio Studio',
      icon: <Music className="w-4 h-4" />,
      activeClass: 'bg-purple-600 text-white shadow-md shadow-purple-600/25',
    },
  ];

  return (
    <section
      id="media-tools"
      className={embedded ? 'lt-adaptive-surface space-y-4' : 'py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'}
    >
      {!embedded && (
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            Creator Media Studio
          </h2>
          <p className="mt-4 text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
            Convert your own video and audio files, optimize images in batches, and edit high-resolution thumbnails directly in your browser.
          </p>
        </div>
      )}

      {objectStorageConfigured === false && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-700 dark:text-amber-300">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Browser-First Processing Active:</strong> Media files up to {browserWasmMaxMb} MB convert locally in your browser without uploads. Optional S3/R2 worker storage for larger background jobs is not configured on this server — check <strong>Settings → Server &amp; Infrastructure</strong> for setup status.
          </span>
        </div>
      )}

      <div className="glass-card rounded-2xl p-4 sm:p-6 shadow-sm">
        {/* Four Primary Studio Module Tabs */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 p-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl w-full sm:w-fit mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition ${
                activeTab === tab.id ? tab.activeClass : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Active Module Workspace */}
        {activeTab === 'video' && <VideoConverterTab />}
        {activeTab === 'image' && <ImageStudioTab />}
        {activeTab === 'thumbnail' && <ThumbnailStudioTab initialUrl={externalUrl} />}
        {activeTab === 'audio' && <AudioStudioTab />}
      </div>
    </section>
  );
};
