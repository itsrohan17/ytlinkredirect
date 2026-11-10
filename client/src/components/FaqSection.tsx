import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export const FaqSection: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Which platforms are supported by LinkTwin?',
      a: 'LinkTwin exclusively supports YouTube (videos, Shorts, playlists, channels, live), Instagram (Reels, posts, profiles), and Facebook (Reels, Watch videos, posts, pages/profiles). All other unsupported domains are safely rejected.',
    },
    {
      q: 'How does mobile app redirection work on Android and iOS?',
      a: 'On Android, we construct official intent:// App Links targeting YouTube, Instagram, or Facebook with a safe S.browser_fallback_url. On iOS, we use verified Universal Links and documented app URI schemes where supported. Because iOS and certain in-app WebViews restrict custom URL schemes (such as Instagram Reels shortcodes), we transparently rely on Universal Links and provide a 1-tap button plus a reliable browser fallback.',
    },
    {
      q: 'What happens if the native app is not installed?',
      a: 'If the YouTube, Instagram, or Facebook app is unavailable, our smart fallback automatically directs the visitor to the canonical HTTPS web page in their mobile browser so no link ever breaks.',
    },
    {
      q: 'Will WhatsApp and Telegram show rich previews?',
      a: 'Yes! When social bots and messaging crawlers (such as WhatsApp, Telegram, Discord, or X) request a short link, our server responds with full OpenGraph and App Links metadata so chat cards display thumbnails, titles, and creator details.',
    },
    {
      q: 'What is included in the Media Studio?',
      a: 'Media Studio includes four modules: Video Converter (convert and trim your own videos with browser FFmpeg WebAssembly or an optional background worker), Image Studio (batch convert, resize, crop, and compress JPG/PNG/WebP/AVIF), Thumbnail Studio (retrieve permitted YouTube/Instagram/Facebook preview thumbnails and edit with text/shapes), and Audio Studio (convert, trim, and visualize waveforms). We do not scrape private content or provide social media video downloading.',
    },
    {
      q: 'Are existing YouTube short links and analytics preserved?',
      a: 'Yes. All previously created YouTube short links, custom slugs, and historical analytics remain 100% intact and continue redirecting seamlessly.',
    },
  ];

  const toggleFaq = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-16 sm:py-24 max-w-4xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Frequently Asked Questions</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Everything You Need to Know
        </h2>
        <p className="mt-4 text-base text-zinc-400">
          Transparent answers about deep linking, platform policies, and analytics.
        </p>
      </div>

      <div className="space-y-3.5">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className="rounded-2xl glass-card border border-zinc-800/80 overflow-hidden transition"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 text-white hover:text-red-400 transition"
              >
                <span className="font-bold text-sm sm:text-base">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 flex-shrink-0 text-zinc-400 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-red-500' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-zinc-800/50 animate-fadeIn">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
