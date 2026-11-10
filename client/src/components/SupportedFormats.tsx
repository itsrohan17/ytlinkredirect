import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Platform } from '../types';
import { PlatformIcon, getPlatformMeta } from './PlatformIcon';

interface SupportedFormatsProps {
  onSelectSample: (url: string) => void;
}

export const SupportedFormats: React.FC<SupportedFormatsProps> = ({ onSelectSample }) => {
  const formats: Array<{
    platform: Platform;
    type: string;
    urlPattern: string;
    desc: string;
    sampleUrl: string;
    label: string;
  }> = [
    {
      platform: 'youtube',
      type: 'YouTube Videos & Timestamps',
      urlPattern: 'youtube.com/watch?v=... & youtu.be/...',
      desc: 'Full-length videos with preserved quality and exact timestamp parameters.',
      sampleUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43s',
      label: 'Try YouTube Video Sample',
    },
    {
      platform: 'youtube',
      type: 'YouTube Shorts',
      urlPattern: 'youtube.com/shorts/...',
      desc: 'Vertical Shorts that launch directly into the native YouTube Shorts player.',
      sampleUrl: 'https://www.youtube.com/shorts/5-x1qKq2f1Q',
      label: 'Try YouTube Shorts Sample',
    },
    {
      platform: 'youtube',
      type: 'YouTube Playlists & Channels',
      urlPattern: 'youtube.com/@handle & playlist?list=...',
      desc: 'Open channel pages with 1-tap Subscribe or full playlist queues directly in app.',
      sampleUrl: 'https://www.youtube.com/@mkbhd',
      label: 'Try YouTube Channel Sample',
    },
    {
      platform: 'instagram',
      type: 'Instagram Reels',
      urlPattern: 'instagram.com/reel/...',
      desc: 'Routes mobile visitors to the Instagram app via Android App Intents & iOS Universal Links.',
      sampleUrl: 'https://www.instagram.com/reel/C0xampleReel1/',
      label: 'Try Instagram Reel Sample',
    },
    {
      platform: 'instagram',
      type: 'Instagram Posts & Profiles',
      urlPattern: 'instagram.com/p/... & /{username}',
      desc: 'Share posts, carousels, and profile pages with clean browser fallback.',
      sampleUrl: 'https://www.instagram.com/instagram/',
      label: 'Try Instagram Profile Sample',
    },
    {
      platform: 'facebook',
      type: 'Facebook Reels, Videos & Pages',
      urlPattern: 'facebook.com/reel/... & fb.watch/...',
      desc: 'Supports Reels, Watch videos, posts, groups, and Page/Profile links safely.',
      sampleUrl: 'https://www.facebook.com/watch/?v=10153231379946729',
      label: 'Try Facebook Video Sample',
    },
  ];

  return (
    <section id="supported-types" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
          <span>Three Supported Platforms</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Supported Formats Across YouTube, Instagram &amp; Facebook
        </h2>
        <p className="mt-4 text-base text-zinc-400">
          Automatic URL normalization preserves IDs and parameters. Click any example below to test in the generator.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {formats.map((fmt, idx) => {
          const meta = getPlatformMeta(fmt.platform);
          return (
            <div
              key={idx}
              className="group relative glass-card rounded-2xl p-6 border border-zinc-800/80 hover:border-zinc-700 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <PlatformIcon platform={fmt.platform} className={`w-5 h-5 ${meta.iconColor}`} />
                  </div>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 truncate max-w-[180px]">
                    {fmt.urlPattern}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-1.5">{fmt.type}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-4">{fmt.desc}</p>
              </div>

              <button
                onClick={() => onSelectSample(fmt.sampleUrl)}
                className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-900/90 group-hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 group-hover:text-white transition"
              >
                <span className="truncate">{fmt.label}</span>
                <ArrowUpRight className="w-4 h-4 ml-1 flex-shrink-0" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
