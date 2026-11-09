import React from 'react';
import { Play, Film, ListMusic, UserCheck, Clock, ArrowUpRight } from 'lucide-react';

interface SupportedFormatsProps {
  onSelectSample: (url: string) => void;
}

export const SupportedFormats: React.FC<SupportedFormatsProps> = ({ onSelectSample }) => {
  const formats = [
    {
      type: 'Standard Videos',
      icon: <Play className="w-5 h-5 text-red-500 fill-current" />,
      urlPattern: 'youtube.com/watch?v=...',
      desc: 'Full length videos with preserved audio tracks and quality.',
      sampleUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      label: 'Rick Astley - Never Gonna Give You Up',
    },
    {
      type: 'YouTube Shorts',
      icon: <Film className="w-5 h-5 text-rose-400" />,
      urlPattern: 'youtube.com/shorts/...',
      desc: 'Vertical mobile shorts that launch directly into the Shorts viewer.',
      sampleUrl: 'https://www.youtube.com/shorts/5-x1qKq2f1Q',
      label: 'Sample YouTube Shorts',
    },
    {
      type: 'Playlists',
      icon: <ListMusic className="w-5 h-5 text-amber-400" />,
      urlPattern: 'youtube.com/playlist?list=...',
      desc: 'Full playlists and mixes that open right into the playlist queue.',
      sampleUrl: 'https://www.youtube.com/playlist?list=PLrAXtmErZgOdP_8GztsuKi9nvNLw_Vn4p',
      label: 'Music Playlist Sample',
    },
    {
      type: 'Creator Channels',
      icon: <UserCheck className="w-5 h-5 text-blue-400" />,
      urlPattern: 'youtube.com/@handle',
      desc: 'Channel handles and IDs with 1-tap Subscribe button right in the app.',
      sampleUrl: 'https://www.youtube.com/@mkbhd',
      label: '@mkbhd Channel',
    },
    {
      type: 'Timestamped Links',
      icon: <Clock className="w-5 h-5 text-emerald-400" />,
      urlPattern: 'youtu.be/ID?t=120s',
      desc: 'Jump directly to the exact chapter or second in the YouTube video.',
      sampleUrl: 'https://youtu.be/dQw4w9WgXcQ?t=43',
      label: 'Jump to 0:43 timestamp',
    },
  ];

  return (
    <section id="supported-types" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
          <span>Universal Compatibility</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Supported YouTube Link Formats
        </h2>
        <p className="mt-4 text-base text-zinc-400">
          LinkTwin supports every format YouTube offers. Click any example below to test immediately in the generator.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {formats.map((fmt, idx) => (
          <div
            key={idx}
            className="group relative glass-card rounded-2xl p-6 border border-zinc-800/80 hover:border-red-500/30 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  {fmt.icon}
                </div>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                  {fmt.urlPattern}
                </span>
              </div>

              <h3 className="text-base font-bold text-white mb-1.5">{fmt.type}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">{fmt.desc}</p>
            </div>

            <button
              onClick={() => onSelectSample(fmt.sampleUrl)}
              className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-900/90 group-hover:bg-red-500/10 border border-zinc-800 group-hover:border-red-500/20 text-xs font-semibold text-zinc-300 group-hover:text-red-400 transition"
            >
              <span className="truncate">{fmt.label}</span>
              <ArrowUpRight className="w-4 h-4 ml-1 flex-shrink-0" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};
