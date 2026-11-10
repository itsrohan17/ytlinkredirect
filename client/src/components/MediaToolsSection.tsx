import React, { useState, useEffect } from 'react';
import { Video, Image as ImageIcon, LayoutTemplate, Music, Sparkles } from 'lucide-react';
import { VideoConverterTab } from './media/VideoConverterTab';
import { ImageStudioTab } from './media/ImageStudioTab';
import { ThumbnailStudioTab } from './media/ThumbnailStudioTab';
import { AudioStudioTab } from './media/AudioStudioTab';

interface MediaToolsSectionProps {
  externalUrl?: string;
}

type MediaStudioTab = 'video' | 'image' | 'thumbnail' | 'audio';

export const MediaToolsSection: React.FC<MediaToolsSectionProps> = ({ externalUrl }) => {
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
    <section id="media-tools" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>LinkTwin Media Studio</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Creator Media Studio
        </h2>
        <p className="mt-4 text-sm sm:text-base text-zinc-400">
          Convert your own video and audio files, optimize images in batches, and edit high-resolution thumbnails directly in your browser.
        </p>
      </div>

      <div className="glass-card rounded-2xl border border-zinc-800/90 p-5 sm:p-8 shadow-2xl">
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
