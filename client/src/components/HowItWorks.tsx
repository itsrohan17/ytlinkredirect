import React from 'react';
import { ClipboardCheck, Cpu, Share2 } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      num: '01',
      icon: <ClipboardCheck className="w-6 h-6 text-red-500" />,
      title: 'Paste Any Supported URL',
      desc: 'Paste a YouTube video, Shorts, playlist, or channel; an Instagram Reel, post, or profile; or a Facebook Reel, video, post, or page link.',
    },
    {
      num: '02',
      icon: <Cpu className="w-6 h-6 text-pink-400" />,
      title: 'Platform Detection & Deep Link',
      desc: 'Our engine automatically identifies the platform, preserves IDs & parameters, configures Android Intents and iOS Universal Links, and builds OpenGraph cards.',
    },
    {
      num: '03',
      icon: <Share2 className="w-6 h-6 text-blue-400" />,
      title: 'Share Anywhere & Track Analytics',
      desc: 'Post to WhatsApp, Telegram, Instagram, Facebook, or Discord. Track clicks, devices, browsers, referrers, and countries in real time.',
    },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
          <span>Simple 3-Step Process</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          How LinkTwin Works
        </h2>
        <p className="mt-4 text-base text-zinc-400">
          Zero coding, no extra apps for your audience, and persistent links with safe browser fallback.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="relative glass-card rounded-2xl p-6 sm:p-8 border border-zinc-800/80 hover:border-zinc-700 transition duration-300"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-md">
                {step.icon}
              </div>
              <span className="font-mono text-2xl font-black text-zinc-700">{step.num}</span>
            </div>

            <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
